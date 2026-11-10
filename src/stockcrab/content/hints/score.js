// Score formatting.

const winPct = (cp) => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);

const minus = (str) => str.replace("-", "−");

function scoreText(line, sign) {
  if (!line || (!line.mate && !Number.isFinite(line.score))) return "";
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
