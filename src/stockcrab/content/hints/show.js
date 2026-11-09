//! StockCrab · Show and rerender
//! Draws a set of marks and lists them in the panel; redraws the last answer when a look setting changes.
//! File: content/hints/show.js. A content script (runs on chess.com and lichess pages); files of one kind share a single global scope and load in the order of manifest.json.

// Draw the marks on the board and list them in the panel.
function show(board, marks, animate = false) {
  drawMarks(board, marks, animate);
  listMoves(marks, animate);
}

// Look-only settings (colours, scores, ...) redraw the last answer without asking the engine again.
function rerender() {
  const board = getBoard();
  if (!board) return;
  if (!lastView) return;
  const marks = lastView.mine
    ? marksForMyTurn(lastView.res, settings.others, lastView.fen)
    : marksForPremove(lastView.res, lastView.fen);
  if (!marks.length) return;
  show(board, marks);
  if (lastView.mine) setStatus(bestStatus(marks, lastView.res), "ok");
}
