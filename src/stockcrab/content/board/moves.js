//! StockCrab · Move finder
//! Plays a move on a board map and finds which move turned one position into the next (the lichess reader uses it for the side to move).
//! File: content/board/moves.js. A content script (runs on chess.com and lichess pages); files of one kind share a single global scope and load in the order of manifest.json.

// A sacrifice: a minor piece or more lands on a square where the opponent takes it (the engine's own line) and
// nothing is taken back there, while the piece is worth clearly more than what it captured.
// Plays an engine move (UCI) on a board map. Legality is the engine's business; this only moves the pieces.
function applyUci(map, move) {
  const from = move.slice(0, 2);
  const to = move.slice(2, 4);
  const piece = map[from];
  if (!piece) return;
  const role = piece.toLowerCase();
  const white = piece === piece.toUpperCase();
  if (role === "p" && from[0] !== to[0] && !map[to]) delete map[to[0] + from[1]]; // en passant
  if (role === "k" && Math.abs(FILES.indexOf(from[0]) - FILES.indexOf(to[0])) === 2) {
    const king = to[0] > from[0]; // castling: the rook jumps too
    const rookFrom = (king ? "h" : "a") + from[1];
    map[(king ? "f" : "d") + from[1]] = map[rookFrom];
    delete map[rookFrom];
  }
  delete map[from];
  map[to] = move[4] ? (white ? move[4].toUpperCase() : move[4].toLowerCase()) : piece;
}

function placementOf(map) {
  const rows = [];
  for (let rank = 8; rank >= 1; rank--) {
    let row = "";
    let empty = 0;
    for (const f of FILES) {
      const p = map[f + rank];
      if (p) {
        if (empty) row += empty;
        empty = 0;
        row += p;
      } else empty++;
    }
    rows.push(row + (empty || ""));
  }
  return rows.join("/");
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
