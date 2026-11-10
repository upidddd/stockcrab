// Pawn-trade premove rule.

const FILES_ = "abcdefgh";

function boardMap(fen) {
  const map = {};
  fen.split(" ")[0].split("/").forEach((row, i) => {
    let f = 0;
    for (const c of row) {
      if (/\d/.test(c)) f += Number(c);
      else {
        map[FILES_[f] + (8 - i)] = c;
        f++;
      }
    }
  });
  return map;
}

// Their pawn-takes-pawn captures and our pawn retakes.
function pawnTrades(fen, legal) {
  const map = boardMap(fen);
  const weAreWhite = fen.split(" ")[1] === "b";
  const theirPawn = weAreWhite ? "p" : "P";
  const ourPawn = weAreWhite ? "P" : "p";
  const theirDir = weAreWhite ? -1 : 1;
  const ourDir = -theirDir;
  const out = [];
  for (const [sq, piece] of Object.entries(map)) {
    if (piece !== theirPawn) continue;
    const f = FILES_.indexOf(sq[0]);
    const r = Number(sq[1]);
    for (const df of [-1, 1]) {
      const tf = f + df;
      const tr = r + theirDir;
      if (tf < 0 || tf > 7 || tr < 1 || tr > 8) continue;
      const target = FILES_[tf] + tr;
      if (map[target] !== ourPawn) continue;
      const capture = sq + target;
      if (!legal.has(capture)) continue;
      const defenders = [];
      for (const [s2, p2] of Object.entries(map)) {
        if (p2 !== ourPawn) continue;
        const f2 = FILES_.indexOf(s2[0]);
        if (Math.abs(f2 - tf) === 1 && Number(s2[1]) + ourDir === tr) defenders.push(s2 + target);
      }
      if (defenders.length) out.push({ capture, target, defenders });
    }
  }
  return out;
}

async function pawnTradePremove(msg, mine, ctx) {
  const legal = new Set(ctx.all.lines.map((l) => l.move));
  const trades = pawnTrades(msg.fen, legal);
  if (!trades.length) return null;
  const rank = new Map(ctx.all.lines.map((l, i) => [l.move, i]));
  trades.sort((a, b) => rank.get(a.capture) - rank.get(b.capture));
  const base = { id: msg.id, fen: msg.fen, elo: 3190, aggression: 0, hash: msg.hash, nnue: msg.nnue, uci: msg.uci };
  const per = msg.per || Math.max(120, Math.min(300, Math.round((msg.movetime || 4000) / 25)));
  const tolerance = msg.tradeTolerance ?? 100;
  for (const t of trades.slice(0, 3)) {
    if (mine.cancelled) return null;
    const any = await submit({ ...base, moves: [t.capture], multipv: 1, movetime: per, goCmd: `go movetime ${per}` });
    if (mine.cancelled || any.error || !any.lines || !any.lines[0]) continue;
    const rec = await submit({ ...base, moves: [t.capture], multipv: 1, movetime: per, goCmd: `go movetime ${per} searchmoves ${t.defenders.join(" ")}` });
    if (mine.cancelled || rec.error || !rec.lines || !rec.lines[0]) continue;
    const retake = rec.lines[0];
    if (!t.defenders.includes(retake.move)) continue;
    if (any.lines[0].score - retake.score > tolerance) continue;
    return { id: msg.id, mode: "pawn", premove: retake.move, expect: t.capture, score: retake.score, mate: retake.mate, tested: 2 };
  }
  return null;
}
