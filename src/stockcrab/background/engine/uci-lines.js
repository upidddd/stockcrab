//! StockCrab · UCI line builder
//! Reads the engine's info lines: only exact scores, lines from the last complete depth.
//! File: background/engine/uci-lines.js. A background script (hosts the engine); files of one kind share a single global scope and load in the order of manifest.json.

// Only exact scores are kept (an aspiration-window "lowerbound"/"upperbound" is not a result), and every
// line is remembered per depth, so the answer can be built from one finished iteration instead of a mix.
function parseInfo(req, line) {
  if (!req.hist || !line.startsWith("info") || !line.includes(" pv ")) return;
  if (/\b(lowerbound|upperbound)\b/.test(line)) return;
  const depth = Number(/ depth (\d+)/.exec(line)?.[1]);
  const mpv = Number(/ multipv (\d+)/.exec(line)?.[1] ?? 1);
  const cp = /score cp (-?\d+)/.exec(line);
  const mate = /score mate (-?\d+)/.exec(line);
  const pv = (/ pv (.+)$/.exec(line)?.[1] || "").trim().split(/\s+/).filter(Boolean);
  const move = pv[0];
  if (!move || !depth || (!cp && !mate)) return;
  const m = mate ? Number(mate[1]) : 0;
  const score = mate ? (m > 0 ? 100000 - m : -100000 - m) : Number(cp[1]);
  const byDepth = req.hist.get(mpv) ?? new Map();
  byDepth.set(depth, { depth, move, pv, score, mate: m });
  while (byDepth.size > 4) byDepth.delete(Math.min(...byDepth.keys())); // only the latest few depths matter
  req.hist.set(mpv, byDepth);
}

// The lines of the last COMPLETE iteration: the deepest depth that every line reached, in the engine's own order.
function finalLines(req) {
  const idx = [...req.hist.keys()].sort((a, b) => a - b);
  if (!idx.length) return { lines: [], depth: 0 };
  const sets = idx.map((i) => new Set(req.hist.get(i).keys()));
  const common = [...sets[0]].filter((d) => sets.every((st) => st.has(d))).sort((a, b) => b - a);
  if (common.length) return { lines: idx.map((i) => req.hist.get(i).get(common[0])), depth: common[0] };
  const latest = idx.map((i) => {
    const m = req.hist.get(i);
    return m.get(Math.max(...m.keys()));
  });
  return { lines: latest, depth: Math.min(...latest.map((l) => l.depth)) };
}

// The deepest result recorded for one particular move (used when the engine plays a move that is not among the lines).
function deepestFor(req, move) {
  let best = null;
  for (const byDepth of req.hist.values()) {
    for (const rec of byDepth.values()) if (rec.move === move && (!best || rec.depth > best.depth)) best = rec;
  }
  return best;
}
