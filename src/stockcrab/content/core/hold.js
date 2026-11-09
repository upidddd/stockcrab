//! StockCrab · Hold tracker
//! Knows when a piece is in the user's hand, so nothing is read or recalculated until it is dropped.
//! File: content/core/hold.js. A content script (runs on chess.com and lichess pages); files of one kind share a single global scope and load in the order of manifest.json.

// While a piece is in the user's hand the board is in an in-between state (the piece is off its square, its
// origin may be highlighted). Nothing is read or recalculated until it is dropped.
let pointerDown = false;
let pointerAt = 0; // when the button went down: a pointerup that never arrives (released outside the window) expires
let releasedAt = 0;
document.addEventListener("pointerdown", (e) => {
  const b = getBoard();
  if (b && e.composedPath && e.composedPath().includes(b)) {
    pointerDown = true;
    pointerAt = Date.now();
  }
}, true);
const release = () => {
  if (pointerDown) releasedAt = Date.now();
  pointerDown = false;
};
for (const ev of ["pointerup", "pointercancel", "dragend", "mouseup"]) document.addEventListener(ev, release, true);
window.addEventListener("blur", release);
const isHolding = (board) =>
  (pointerDown && Date.now() - pointerAt < 20000) || Date.now() - releasedAt < 200 || !!(board.querySelector && board.querySelector(".dragging, .piece.dragging, piece.dragging"));
