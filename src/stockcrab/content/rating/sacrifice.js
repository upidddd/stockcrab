//! StockCrab · Sacrifice detector
//! Plays the engine's line on a board map and tells whether a piece is really given up (for Brilliant).
//! File: content/rating/sacrifice.js. A content script (runs on chess.com and lichess pages); files of one kind share a single global scope and load in the order of manifest.json.

const PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

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

const materialOf = (map, white) => {
  let sum = 0;
  for (const p of Object.values(map)) if ((p === p.toUpperCase()) === white) sum += PIECE_VALUE[p.toLowerCase()];
  return sum;
};

// How much material the mover is down after the engine's own line (4 to 8 plies, ending with the mover to move
// again). A piece given up and not won back within that line shows as 3, a rook 5, a queen 9.
function sacrificeDeficit(fen, pv) {
  if (!fen || !pv || pv.length < 4) return 0;
  const map = boardOf(fen);
  const mover = map[pv[0].slice(0, 2)];
  if (!mover) return 0;
  const white = mover === mover.toUpperCase();
  const balance = () => materialOf(map, white) - materialOf(map, !white);
  const start = balance();
  const plies = Math.min(pv.length, 8) & ~1;
  // The deficit must hold at every checkpoint (after 4, 6 and 8 plies): an exchange cut off in the middle, or a
  // piece won back a little later, is not a sacrifice.
  let deficit = Infinity;
  for (let i = 0; i < plies; i++) {
    applyUci(map, pv[i]);
    if (i % 2 === 1 && i >= 3) deficit = Math.min(deficit, start - balance());
  }
  return deficit === Infinity ? 0 : deficit;
}

// Pieces of `white` (or black) that attack the square, as { sq, v }: pawns, knights, kings and sliders with a clear line.
const SEE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
function attackersOnto(map, file, rank, white) {
  const out = [];
  const own = (p) => p && (p === p.toUpperCase()) === white;
  const look = (f, r) => (f >= 0 && f < 8 && r >= 1 && r <= 8 ? (map[FILES[f] + r] ?? null) : undefined);
  const add = (f, r) => out.push({ sq: FILES[f] + r, v: SEE_VALUE[map[FILES[f] + r].toLowerCase()] });
  const pr = rank + (white ? -1 : 1);
  for (const df of [-1, 1]) if (look(file + df, pr) === (white ? "P" : "p")) add(file + df, pr);
  for (const [df, dr] of [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]) {
    if (look(file + df, rank + dr) === (white ? "N" : "n")) add(file + df, rank + dr);
  }
  for (let df = -1; df <= 1; df++) for (let dr = -1; dr <= 1; dr++) {
    if ((df || dr) && look(file + df, rank + dr) === (white ? "K" : "k")) add(file + df, rank + dr);
  }
  for (const [df, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const straight = df === 0 || dr === 0;
    for (let k = 1; k < 8; k++) {
      const p = look(file + df * k, rank + dr * k);
      if (p === undefined) break;
      if (p) {
        const t = p.toLowerCase();
        if (own(p) && (t === "q" || (straight ? t === "r" : t === "b"))) add(file + df * k, rank + dr * k);
        break;
      }
    }
  }
  return out;
}

// Static exchange on one square: what `white` nets by capturing the piece standing there, if both sides keep
// recapturing with their cheapest piece and may stop as soon as going on loses material. 0 = nothing to win.
function exchangeGain(map, sq, white) {
  const f = FILES.indexOf(sq[0]);
  const r = Number(sq[1]);
  const swap = (side, depth) => {
    const target = map[sq];
    if (!target || depth > 12) return 0;
    const list = attackersOnto(map, f, r, side);
    if (!list.length) return 0;
    const a = list.reduce((x, y) => (y.v < x.v ? y : x));
    const mover = map[a.sq];
    map[sq] = mover;
    delete map[a.sq];
    const gain = SEE_VALUE[target.toLowerCase()] - swap(!side, depth + 1);
    map[a.sq] = mover;
    map[sq] = target;
    return Math.max(0, gain);
  };
  return swap(white, 0);
}

// After the move, can the opponent win at least two points of material on the square of one of my pieces
// (a knight or more) by taking it? That is what makes a move a piece sacrifice.
function leavesPieceHanging(fen, move) {
  const map = boardOf(fen);
  const mover = map[move.slice(0, 2)];
  if (!mover) return false;
  const white = mover === mover.toUpperCase();
  applyUci(map, move);
  return Object.entries(map).some(([sq, p]) => {
    const t = p.toLowerCase();
    return (p === p.toUpperCase()) === white && t !== "k" && t !== "p" && exchangeGain(map, sq, !white) >= 2;
  });
}
const isSacrifice = (fen, rec) => sacrificeDeficit(fen, rec.pv) >= 2.5 && leavesPieceHanging(fen, rec.move);
