// Strength: one Elo scale, 200 – 3800, on every Stockfish model.
//
// Inside the model's own UCI_Elo range the engine limits itself. Below it the engine plays at its lowest Elo and the
// move is then picked among its MultiPV lines, worse moves getting more likely the lower the Elo. Above it the
// engine plays at full strength with a node budget that grows with the Elo; 3800 has no budget at all.

const ELO_MIN = 200;
const ELO_MAX = 3800;
const WEAK_LINES = 8; // lines to pick from below the model's own range

// Node budget between the top of the model's range and ELO_MAX: 40k nodes at the top, 4M just under ELO_MAX.
function eloNodes(elo, top) {
  const t = Math.max(0, Math.min(1, (elo - top) / (ELO_MAX - top)));
  return Math.round(Math.exp(Math.log(4e4) + t * (Math.log(4e6) - Math.log(4e4))));
}

// Sets the strength options for one search; marks the request with `weak` (Elo below the model's lowest) and `eloNodes`.
function setStrength(req, model) {
  const elo = Math.max(ELO_MIN, Math.min(ELO_MAX, Number.isFinite(req.elo) ? req.elo : ELO_MAX));
  const [lo, hi] = model.elo || [1320, 3190];
  req.weak = 0;
  req.eloNodes = 0;
  // the panel keeps the Elo inside the model's own range; its top is full strength
  if (elo >= hi) {
    if (!model.noElo) option("UCI_LimitStrength", false);
    if (!model.crab) option("Skill Level", 20);
    return;
  }
  if (model.noElo) option("Skill Level", Math.max(0, Math.min(20, Math.round(((elo - lo) / (hi - lo)) * 20))));
  else {
    if (!model.crab) option("Skill Level", 20);
    option("UCI_LimitStrength", true);
    option("UCI_Elo", Math.max(lo, elo));
  }
  if (elo < lo) req.weak = lo - elo;
}

// Expected score of a line for the side to move (mates are 0 or 1).
function expectedScore(line) {
  if (line.mate) return line.mate > 0 ? 1 : 0;
  return 1 / (1 + Math.exp(-0.00368208 * line.score));
}

// Same position, same Elo: same move.
function seededRandom(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  h += 0x6d2b79f5;
  let t = h;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// A move below the model's lowest Elo: each line weighted by how much expected score it gives away.
function pickWeak(req, lines) {
  const list = lines.filter((l) => l && l.move).sort((a, b) => b.score - a.score);
  if (list.length < 2) return list[0]?.move;
  const spread = Math.min(1, req.weak / 1120) * 0.25; // 0.25 at 200 Elo below a 1320 model
  if (spread < 0.002) return list[0].move;
  const top = expectedScore(list[0]);
  const weights = list.map((l) => Math.exp(-(top - expectedScore(l)) / spread));
  let r = seededRandom(`${req.fen} ${(req.moves || []).join(" ")} ${req.elo}`) * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < list.length; i++) {
    r -= weights[i];
    if (r <= 0) return list[i].move;
  }
  return list[list.length - 1].move;
}
