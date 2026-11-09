//! StockCrab · Score text
//! How a score is written on the board and in the panel: pawns, centipawns or win chance.
//! File: content/hints/score.js. A content script (runs on chess.com and lichess pages); files of one kind share a single global scope and load in the order of manifest.json.

const winPct = (cp) => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);

// A real minus sign reads better next to digits than a hyphen.
const minus = (str) => str.replace("-", "−");

function scoreText(line, sign) {
  if (!line || (!line.mate && !Number.isFinite(line.score))) return ""; // never show "NaN"
  if (line.mate) {
    const m = line.mate * sign;
    return m > 0 ? `M${m}` : `−M${-m}`;
  }
  const cp = line.score * sign;
  if (settings.scoreUnits === "cp") return (cp > 0 ? "+" : "") + minus(String(Math.round(cp)));
  if (settings.scoreUnits === "win") return Math.round(winPct(cp)) + "%";
  const p = cp / 100;
  return (p > 0 ? "+" : "") + minus(p.toFixed(2));
}
