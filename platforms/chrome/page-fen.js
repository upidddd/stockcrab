//! StockCrab · chess.com position bridge (Chrome)
//! Runs in the page's own world (Chrome has no wrappedJSObject): publishes the game's FEN on the board element,
//! where the Board reader picks it up (data-sp-fen / data-sp-ts), exactly like the injected script does in Firefox.
//! File: platforms/chrome/page-fen.js, a MAIN-world content script in the Chrome build only.

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
