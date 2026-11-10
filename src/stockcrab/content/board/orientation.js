// Board orientation and which colour the user plays.

// Colour at the bottom: the site's flag, cross-checked by piece positions.
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

// The colour the user plays.
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
