//! StockCrab · Opening book
//! Tells whether the position after a move is opening theory (uses data/opening-book.js).
//! File: content/rating/book.js. A content script (runs on chess.com and lichess pages); files of one kind share a single global scope and load in the order of manifest.json.

// Same hash as the one that built data/opening-book.js (FNV-1a and a djb2-style sum over the key, in base 36).
function hashKey(str) {
  let a = 0x811c9dc5;
  let b = 5381;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = (Math.imul(b, 33) + c) >>> 0;
  }
  return a.toString(36) + "." + b.toString(36);
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

// Opening theory: the position after this move is on one of the named opening lines.
function isBookMove(fen, move) {
  const book = globalThis.STOCKCRAB_BOOK;
  if (!book || !fen) return false;
  const map = boardOf(fen);
  if (!map[move.slice(0, 2)]) return false;
  applyUci(map, move);
  return book.has(hashKey(placementOf(map) + (fen.split(" ")[1] === "w" ? " b" : " w")));
}
