//! StockCrab · Main loop
//! Every 250 ms: read the board, ask the engine, draw the answer; retries after a failure.
//! File: content/core/tick.js. A content script (runs on chess.com and lichess pages); files of one kind share a single global scope and load in the order of manifest.json.

// A position read from the screen that cannot exist (a piece caught in the middle of a move, two pieces on a square):
// nothing is calculated from it. Returns the reason, or null.
function fenImpossible(fen) {
  const rows = fen.split(" ")[0].split("/");
  if (rows.length !== 8) return "not 8 ranks";
  const side = (re) => (fen.split(" ")[0].match(re) || []).length;
  if (side(/[A-Z]/g) > 16 || side(/[a-z]/g) > 16) return "more than 16 pieces of one colour";
  if (side(/P/g) > 8 || side(/p/g) > 8) return "more than 8 pawns";
  if (/[Pp]/.test(rows[0]) || /[Pp]/.test(rows[7])) return "a pawn on the first or last rank";
  return null;
}

const kingCount = (fen) => (fen.split(" ")[0].match(/[kK]/g) || []).length;
const pieceCount = (fen) => (fen.split(" ")[0].match(/[a-z]/gi) || []).length;

// A request that failed (the background page was asleep, the engine timed out) is asked again after a pause that
// grows with every failure (2 s, 4 s ... 15 s), instead of waiting for the position to change.
function retryLater(id) {
  if (id !== requestId) return;
  retryAt = Date.now() + Math.min(15000, 2000 * 2 ** Math.min(failures, 4));
  failures++;
  lastKey = null;
  candidateKey = null;
}

async function tick() {
  mountPanel();

  if (!settings.enabled) {
    if (lastKey !== null) {
      clearMarks(true);
      current = null;
      lastView = null;
      listMoves([]);
    }
    lastKey = null;
    return;
  }

  const board = getBoard();
  if (!board) {
    setStatus("Board not found");
    return;
  }
  if (SITE === "lichess" && !lichessAllowed()) {
    if (lastKey !== null) {
      clearMarks(true);
      current = null;
      lastView = null;
      listMoves([]);
      lastKey = null;
    }
    setStatus("lichess: works vs the computer and in analysis");
    return;
  }

  if (current) {
    const r = board.getBoundingClientRect();
    if (current.size !== `${Math.round(r.width)}x${Math.round(r.height)}`) drawMarks(board, current.marks);
  }

  if (isHolding(board)) {
    candidateKey = null; // hold everything as it is until the piece is dropped and the board has settled
    return;
  }
  if (Date.now() < retryAt) return; // the last request failed: wait a little before asking again

  let fen = readFen(board);
  if (fenSource === "dom" || fenSource === "lichess") {
    // a position read from the screen: check that it can exist, and repair a misread side to move
    const checked = sanitiseFen(fen);
    if (kingCount(fen) === 2 && !checked.ok) {
      setStatus("Position looks illegal (both kings attacked): the board was misread", "err");
      return;
    }
    if (checked.ok && checked.flipped) {
      fen = checked.fen;
      fenSource += "+turn";
    }
  }
  lastRead = `${fenSource} · ${fen}`;
  if ((fenSource.startsWith("dom") || fenSource.startsWith("lichess")) && fenImpossible(fen)) {
    candidateKey = null; // the board is changing under our eyes: wait for it to settle
    return;
  }
  if (kingCount(fen) !== 2) {
    if (lastKey !== null) {
      clearMarks(true);
      current = null;
      lastView = null;
      listMoves([]);
      lastKey = null;
    }
    setStatus(`Can't read the board (${pieceCount(fen)} pieces found)`, "err");
    return;
  }
  const key = [fen, ...QUERY_KEYS.map((k) => settings[k])].join("|");
  if (key === lastKey) return;
  if (key !== candidateKey) {
    candidateKey = key;
    return;
  }
  lastKey = key;
  const id = ++requestId;
  clearMarks(true);
  current = null;
  lastView = null;
  listMoves([]);

  // "Whoever is to move" (analysis boards, puzzles, playing both sides): every position is mine
  const mine = settings.side === "turn" || fen.split(" ")[1] === myColour(board);
  playedMark = settings.ratePlayed && ratedFor && ratedFor.fen === fen ? ratedFor.mark : null;
  if (!keepAlive) {
    try {
      keepAlive = browser.runtime.connect();
      keepAlive.onDisconnect.addListener(() => (keepAlive = null));
    } catch (e) {}
  }
  if (settings.ratePlayed && lastMine && lastMine.fen !== fen) {
    const mark = await ratePlayedMove(id, fen);
    if (id !== requestId) return;
    ratedFor = mark ? { fen, mark } : null;
    playedMark = mark;
    if (mark) show(board, [], true);
  }
  if (!mine && !settings.premove) {
    setStatus("Opponent's turn");
    return;
  }
  if (mine && !(lastMine && lastMine.fen === fen)) {
    // the value of my previous move counts only if the opponent's reply really is one move from that position
    const prevPct = afterMine && inferPlayed(afterMine.fen, fen) ? afterMine.pct : null;
    lastMine = { fen, res: null, prevPct }; // known from now on, even if I move before the hint is ready
    afterMine = null;
  }
  setStatus(mine ? "Thinking…" : `Opponent's turn, checking for a ${settings.premoveMode === "safe" ? "safe " : ""}premove…`, "busy");
  let res;
  try {
    res = await browser.runtime.sendMessage(
      mine
        ? {
            type: "hint", id, fen,
            elo: settings.elo, movetime: settings.movetime, depth: settings.depth, hash: settings.hash,
            aggression: settings.aggression,
            // "Great" (the only good move) needs a second line to compare with, so the labels ask for at least two
            multipv: Math.max(1 + settings.others, settings.showIcon || settings.showQuality ? 2 : 1),
          }
        : {
            type: "premove", id, fen,
            movetime: settings.movetime, hash: settings.hash, gap: settings.safeGap, per: settings.premovePer,
            mode: settings.premoveMode, likelyCount: settings.likelyCount, likelyWithin: settings.likelyWithin,
            obviousLead: settings.obviousLead, replyGap: settings.replyGap,
            pawnTrade: settings.pawnTrade, tradeTolerance: settings.tradeTolerance,
          },
    );
  } catch (e) {
    setStatus("Error: " + e.message, "err");
    console.error("[stockcrab]", e);
    retryLater(id);
    return;
  }
  if (!res) {
    setStatus("No reply from the engine", "err");
    retryLater(id);
    return;
  }
  if (res.id !== requestId) return;
  if (res.error) {
    setStatus(res.error, "err");
    retryLater(id);
    return;
  }
  failures = 0;
  if (!mine) {
    const marks = marksForPremove(res, fen);
    if (!marks.length) {
      if (playedMark) show(board, [], false);
      const why = ["they have several good moves", "your reply needs thought"].includes(res.reason) ? res.reason : null;
      setStatus(
        settings.premoveMode === "smart" && why
          ? `No premove: ${why}`
          : settings.premoveMode === "safe"
            ? "Opponent's turn: no safe premove"
            : "Opponent's turn: no premove",
      );
      return;
    }
    lastView = { mine, res, fen };
    show(board, marks, true);
    setStatus(premoveStatus(res), "ok");
    return;
  }
  if (!res.move || res.move === "(none)") {
    setStatus("No legal moves (game over?)", "err");
    return;
  }
  lastView = { mine, res, fen };
  if (lastMine && lastMine.fen === fen) lastMine.res = res;
  const marks = marksForMyTurn(res, settings.others, fen);
  show(board, marks, true);
  setStatus(bestStatus(marks, res), "ok");
}
