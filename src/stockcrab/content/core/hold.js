// Tracks a piece held by the mouse, so the board is not read mid-drag.

let pointerDown = false;
let pointerAt = 0; // pointerdown time; a lost pointerup expires
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
