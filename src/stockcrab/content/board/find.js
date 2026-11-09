//! StockCrab · Board finder
//! Finds the game's board element on chess.com (and asks the lichess finder for lichess).
//! File: content/board/find.js. A content script (runs on chess.com and lichess pages); files of one kind share a single global scope and load in the order of manifest.json.

// chess.com: the big board of the game (a page can also hold small boards: a puzzle, a preview, the opponent's profile)
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
