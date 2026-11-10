// Shows an answer on the board and in the panel.

function show(board, marks, animate = false) {
  drawMarks(board, marks, animate);
  listMoves(marks, animate);
}

// Redraws the last answer after a look setting changes.
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
