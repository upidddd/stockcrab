//! StockCrab · Played-move rater
//! Finds the move the user just played and rates it; also show() and rerender() for what is on the board.
//! File: content/rating/played-move.js. A content script (runs on chess.com and lichess pages); files of one kind share a single global scope and load in the order of manifest.json.

// The rating of the move I just played (see ratePlayedMove) is drawn together with whatever else is on the board.
let lastMine = null; // { fen, res }: my last position with the engine's lines, to rate the move I play from it
let playedMark = null; // the rating drawn on the target cell of my last move
let afterMine = null; // { pct, fen }: win chance of my last played move (my view) and the position after it, to see whether the opponent's reply was a mistake
let ratedFor = null; // { fen, mark }: the position that rating belongs to, so a re-read of it keeps the rating

function show(board, marks, animate = false) {
  drawMarks(board, playedMark && settings.ratePlayed && settings.showRatings !== false ? marks.concat(playedMark) : marks, animate);
  listMoves(marks, animate);
}

// The move that turned `before` into `after` (one move by the side to move in `before`), as "e2e4"/"e7e8q", or null.
function inferPlayed(before, after) {
  if (!before || !after) return null;
  const map0 = boardOf(before);
  const map1 = boardOf(after);
  const white = before.split(" ")[1] === "w";
  const target = after.split(" ")[0];
  const mine = (p) => p && (p === p.toUpperCase()) === white;
  const froms = Object.keys(map0).filter((sq) => mine(map0[sq]) && map1[sq] !== map0[sq]);
  const tos = Object.keys(map1).filter((sq) => mine(map1[sq]) && map1[sq] !== map0[sq]);
  for (const from of froms) {
    for (const to of tos) {
      const promo = map0[from].toLowerCase() === "p" && (to[1] === "8" || to[1] === "1") ? ["q", "r", "b", "n"] : [""];
      for (const p of promo) {
        const trial = boardOf(before);
        applyUci(trial, from + to + p);
        if (placementOf(trial) === target) return from + to + p;
      }
    }
  }
  return null;
}

// Miss, as in chess.com's review: "you fail to capitalize on your opponent's mistake". Their last move gave me at
// least 10 win-chance points (the best I can do now is that much better than the value my own previous move had),
// there was something to win (the position is now clearly in my favour), and my move lost 5 to 20 points of it
// (a smaller slip is only an Inaccuracy, a bigger one stays a Blunder).
function isMiss(lines, rec, prevPct) {
  if (prevPct == null || !lines[0] || !rec) return false;
  const best = winPct(lines[0].score);
  const mine = winPct(rec.score);
  return best - prevPct >= 10 && best >= 55 && best - mine >= 5 && best - mine <= 20;
}

// Rate the move I played in the position I had hints for, the way chess.com's game review does: against the
// engine's best line. If the move is among the lines I already have, its score is known; otherwise the engine
// searches just that move to the same depth. Returns a mark for the target cell, or null.
async function ratePlayedMove(id, fen) {
  const prev = lastMine;
  lastMine = null;
  if (!prev || prev.fen === fen) return null;
  const played = inferPlayed(prev.fen, fen);
  if (!played) return null;
  let lines = prev.res && prev.res.lines ? prev.res.lines : [];
  let rec = lines.find((l) => l.move === played);
  if (!rec || !lines.length) {
    setStatus("Rating your move…", "busy");
    let r;
    try {
      // without the hint's lines (the move was played before the hint was ready) the engine finds them too
      r = await browser.runtime.sendMessage({ type: "rate", id, fen: prev.fen, move: played, withBest: !lines.length, depth: Math.max(8, Math.min((prev.res && prev.res.depth) || 18, 30)), hash: settings.hash });
    } catch (e) {
      return null;
    }
    if (!lines.length && r && r.lines) lines = r.lines;
    rec = r && r.move && (r.chosen || (r.lines && r.lines.find((l) => l.move === played)));
    if (!rec || rec.move !== played || !lines.length) return null;
  }
  let cls = classifyMove(lines, rec, prev.fen);
  if (cls && !cls.plain && isMiss(lines, rec, prev.prevPct) && (cls.id === "inaccuracy" || cls.id === "mistake")) cls = QUALITY.miss;
  afterMine = { pct: winPct(rec.score), fen }; // what my move was worth: the opponent's reply is judged against it next turn
  return cls ? { move: played, kind: "played", label: "", san: "", cls } : null;
}

// Look-only settings (colours, scores, ...) redraw the last answer without asking the engine again.
function rerender() {
  const board = getBoard();
  if (!board) return;
  if (!lastView) {
    // nothing but the rating of my last move may be on the board: it follows the look settings too
    if (settings.enabled && (playedMark || current)) show(board, []);
    return;
  }
  const marks = lastView.mine
    ? marksForMyTurn(lastView.res, settings.others, lastView.fen)
    : marksForPremove(lastView.res, lastView.fen);
  if (!marks.length) return;
  show(board, marks);
  if (lastView.mine) setStatus(bestStatus(marks, lastView.res), "ok");
}
