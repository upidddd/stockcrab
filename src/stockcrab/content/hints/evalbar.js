// Evaluation bar: White's winning chances in a thin bar beside the board (over its edge when there is no room).

let evalBar = null;
let evalWhite = null; // { cp, mate } for White, or null

// Remembers the score of the best line of a search of `fen` (the score is for the side to move).
function setEval(line, fen) {
  if (!line || (!line.mate && !Number.isFinite(line.score))) return;
  const sign = fen.split(" ")[1] === "w" ? 1 : -1;
  evalWhite = { cp: line.score * sign, mate: (line.mate || 0) * sign };
}

function clearEval() {
  evalWhite = null;
  if (evalBar) evalBar.remove();
  evalBar = null;
}

// Places and fills the bar; called by the main loop.
function placeEval(board) {
  if (!settings.enabled || !settings.evalBar || !evalWhite || !board) {
    if (evalBar) evalBar.hidden = true;
    return;
  }
  if (!evalBar || !evalBar.isConnected) {
    evalBar = document.createElement("div");
    evalBar.className = "stockcrab-eval";
    evalBar.appendChild(document.createElement("i"));
    document.documentElement.appendChild(evalBar);
  }
  const r = (SITE === "lichess" ? board.querySelector("cg-board") || board : board).getBoundingClientRect();
  if (!r.width) {
    evalBar.hidden = true;
    return;
  }
  const room = r.left >= 16;
  const w = room ? 9 : 5;
  const x = room ? r.left - w - 5 : r.left;
  const share = evalWhite.mate ? (evalWhite.mate > 0 ? 1 : 0) : 1 / (1 + Math.exp(-0.00368208 * evalWhite.cp));
  const whiteBottom = bottomColour(board) === "w";
  evalBar.hidden = false;
  evalBar.style.cssText =
    `position:fixed;left:${x}px;top:${r.top}px;width:${w}px;height:${r.height}px;z-index:9999;pointer-events:none;` +
    "border-radius:3px;overflow:hidden;background:#403d39;box-shadow:0 0 0 1px rgba(0,0,0,.25)";
  const fill = evalBar.firstChild;
  fill.style.cssText =
    `position:absolute;left:0;right:0;${whiteBottom ? "bottom" : "top"}:0;height:${(share * 100).toFixed(1)}%;background:#f2f1ee;` +
    (settings.animate ? "transition:height .35s cubic-bezier(.2,.7,.3,1)" : "");
}
