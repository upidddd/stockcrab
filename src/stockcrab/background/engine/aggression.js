//! StockCrab · Aggression picker
//! Picks a sharper move among nearly equal ones when the user asks for aggression.
//! File: background/engine/aggression.js. A background script (hosts the engine); files of one kind share a single global scope and load in the order of manifest.json.

const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function pieceAt(fen, sq) {
  const rows = fen.split(" ")[0].split("/");
  const row = rows[8 - Number(sq[1])];
  let file = 0;
  for (const c of row) {
    if (/\d/.test(c)) {
      file += Number(c);
      if (file > "abcdefgh".indexOf(sq[0])) return null;
    } else {
      if (file === "abcdefgh".indexOf(sq[0])) return c;
      file++;
    }
  }
  return null;
}

// How sharp a move is: captures (more for bigger victims), promotions, pawn advances.
function sharpness(fen, move) {
  const mover = pieceAt(fen, move.slice(0, 2));
  const victim = pieceAt(fen, move.slice(2, 4));
  const white = fen.split(" ")[1] === "w";
  let score = 0;
  if (victim) score += 10 + 4 * VALUE[victim.toLowerCase()];
  else if (mover && mover.toLowerCase() === "p" && move[0] !== move[2]) score += 12; // en passant
  if (move.length === 5) score += 25;
  if (mover && mover.toLowerCase() === "p") {
    const rank = Number(move[3]);
    score += white ? rank : 9 - rank;
  }
  return score;
}

function pickAggressive(req, lines) {
  const list = [...lines].sort((a, b) => b.score - a.score);
  const best = list[0];
  if (!best || best.mate > 0) return best?.move;
  const margin = Math.round(req.aggression * 0.25); // 0..25 cp: never trade real strength for style
  let choice = best;
  let top = sharpness(req.fen, best.move);
  for (const c of list.slice(1)) {
    if (c.mate !== 0 && c.mate < 0) continue;
    if (best.score - c.score > margin) continue;
    const sh = sharpness(req.fen, c.move);
    if (sh > top) {
      top = sh;
      choice = c;
    }
  }
  return choice.move;
}
