// Finds the game board element.

function chesscomBoard() {
  let best = null;
  let area = 0;
  document.querySelectorAll("wc-chess-board, chess-board").forEach((b) => {
    const r = b.getBoundingClientRect();
    if (r.width * r.height > area) {
      area = r.width * r.height;
      best = b;
    }
  });
  return best || document.querySelector("wc-chess-board, chess-board");
}
const getBoard = () => (SITE === "lichess" ? lichessBoard() : chesscomBoard());
