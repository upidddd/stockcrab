//! StockCrab · Orientation
//! Which colour is at the bottom of the board, and which colour the user plays.
//! File: content/board/orientation.js. A content script (runs on chess.com and lichess pages); files of one kind share a single global scope and load in the order of manifest.json.

// Which colour is at the bottom of the board? The site's own orientation flag decides. The pieces' heights are
// only a cross-check, and only while many pieces are on the board: in an endgame the average height of a side's
// few pieces says very little (it can even point the wrong way), which used to flip "who is who".
function chooseBottom(flag, items) {
  const white = items.filter((i) => i.white);
  const black = items.filter((i) => !i.white);
  if (items.length >= 20 && white.length && black.length) {
    const avg = (a) => a.reduce((sum, i) => sum + i.y, 0) / a.length;
    const geo = avg(white) > avg(black) ? "w" : "b";
    if (geo !== flag) return geo;
  }
  return flag;
}

// The colour the user plays: the manual choice, else chess.com's own "playing as", else the colour at the bottom.
function myColour(board) {
  if (settings.side === "w" || settings.side === "b") return settings.side;
  try {
    const p = board.wrappedJSObject?.game?.getPlayingAs?.();
    if (p === 1) return "w";
    if (p === 2) return "b";
  } catch (e) {}
  return bottomColour(board);
}

function bottomColour(board) {
  if (SITE === "lichess") return lichessBottom(board);
  const items = [];
  board.querySelectorAll(".piece").forEach((el) => {
    if (el.classList.contains("dragging")) return;
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    const cls = [...el.classList];
    if (cls.some((c) => /^w[pnbrqk]$/.test(c))) items.push({ white: true, y: r.top + r.height / 2 });
    else if (cls.some((c) => /^b[pnbrqk]$/.test(c))) items.push({ white: false, y: r.top + r.height / 2 });
  });
  return chooseBottom(board.classList.contains("flipped") ? "b" : "w", items);
}
