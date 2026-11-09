//! StockCrab · Move classifier
//! Great and Miss helpers, the classifier itself, and how a score is written (pawns, centipawns, win chance).
//! File: content/rating/classify.js. A content script (runs on chess.com and lichess pages); files of one kind share a single global scope and load in the order of manifest.json.

// Great, as in chess.com's review ("critical to the outcome"): the move is the best one and every other move is
// clearly worse. Either it was the only good move (the next best gives up 10 win-chance points, an expected-points
// drop of 0.10), or it decides the outcome: the next best leaves the same class of position one step lower, with
// at least 5 points between them (losing -> equal, equal -> winning; the classes are below 30%, 30-70%, above 70%).
function isCritical(lines, rec) {
  const rival = lines.find((l) => l.move !== rec.move);
  if (!rival) return false;
  const mine = winPct(rec.score);
  const other = winPct(rival.score);
  const gap = mine - other;
  if (mine < 8) return false; // nothing to find in a lost position
  if (gap >= 10) return true;
  return gap >= 5 && ((mine >= 70 && other < 70) || (mine >= 30 && other < 30));
}

function classifyMove(lines, rec, fen) {
  const best = lines[0];
  if (!best || !rec) return null;
  const pct = (l) => winPct(l.score);
  const loss = Math.max(0, pct(best) - pct(rec));
  if (!Number.isFinite(loss)) return null; // a line without a usable score: no verdict
  if (lines.length === 1 && rec.move === best.move) return QUALITY.forced; // the engine found a single legal move
  if (loss < 5 && isBookMove(fen, rec.move)) return QUALITY.book; // theory
  const top = rec.move === best.move || loss < 0.05; // "Best" is the engine's first choice and nothing else
  if (top || loss <= 2) {
    // Brilliant, from chess.com's description ("a good piece sacrifice", best or nearly best, not in a bad position
    // afterwards, not completely winning without it): a piece is left en prise AND the engine's line does not win
    // it back (checked at 4, 6 and 8 plies); the position is not worse than about -0.7, and no other move wins
    // by itself (at most 70%, about +2.4).
    const rival = lines.find((l) => l.move !== rec.move);
    if (isSacrifice(fen, rec) && pct(rec) >= 45 && (rival ? pct(rival) < 70 : pct(rec) < 90)) return QUALITY.brilliant;
    if (!top) return QUALITY.excellent; // nearly best, up to 2 points behind: its own rating, Excellent
    if (isCritical(lines, rec)) return QUALITY.great;
    return QUALITY.best;
  }
  if (loss <= 5) return QUALITY.good;
  if (loss <= 10) return QUALITY.inaccuracy;
  if (loss <= 20) return QUALITY.mistake;
  return QUALITY.blunder;
}

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
