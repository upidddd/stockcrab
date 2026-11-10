// Chrome: publishes chess.com's FEN on the board element (page world).

setInterval(() => {
  document.querySelectorAll("wc-chess-board, chess-board").forEach((b) => {
    try {
      const f = b.game && b.game.getFEN && b.game.getFEN();
      if (typeof f === "string") {
        b.setAttribute("data-sp-fen", f);
        b.setAttribute("data-sp-ts", String(Date.now()));
      }
    } catch (e) {}
  });
}, 150);
