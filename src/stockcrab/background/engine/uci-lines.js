// Parses the engine's info lines.

// Keeps exact scores per line and depth.
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
  while (byDepth.size > 4) byDepth.delete(Math.min(...byDepth.keys()));
  req.hist.set(mpv, byDepth);
}

// Lines of the last complete depth.
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

// Deepest result for one move.
function deepestFor(req, move) {
  let best = null;
  for (const byDepth of req.hist.values()) {
    for (const rec of byDepth.values()) if (rec.move === move && (!best || rec.depth > best.depth)) best = rec;
  }
  return best;
}
