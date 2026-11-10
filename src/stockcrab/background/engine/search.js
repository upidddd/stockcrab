// Runs one search.

let lastFen = null;
function pieces(fen) {
  return (fen.split(" ")[0].match(/[a-z]/gi) || []).length;
}
const START_PLACEMENT = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";
// Same game: keep the hash.
function sameGame(fen) {
  if (lastFen === null || fen.split(" ")[0] === START_PLACEMENT) return false;
  return pieces(fen) <= pieces(lastFen);
}

function start(req) {
  busy = req;
  req.hist = new Map();
  if (newGame || !sameGame(req.fen)) send("ucinewgame");
  newGame = false;
  lastFen = req.fen;
  option("MultiPV", Math.min(256, Math.max(req.multipv ?? 1, req.aggression > 0 ? 2 : 1)));
  const model = MODELS[modelId];
  const clampElo = (v) => Math.max(model.elo[0], Math.min(model.elo[1], v));
  if (model.maia) {
    option("UCI_LimitStrength", true);
    option("UCI_Elo", clampElo(req.maiaRating ?? 1500));
    option("Opponent Elo", clampElo(req.maiaOppo > 500 ? req.maiaOppo : req.maiaRating ?? 1500));
  } else if (req.strengthBy === "skill") {
    if (!model.noElo) option("UCI_LimitStrength", false);
    option("Skill Level", Math.max(0, Math.min(20, req.skill ?? 20)));
  } else if (req.elo >= 3190) {
    if (!model.noElo) option("UCI_LimitStrength", false);
    option("Skill Level", 20);
  } else if (model.noElo) {
    option("Skill Level", Math.max(0, Math.min(20, Math.round(((req.elo - 1320) / (3190 - 1320)) * 20))));
  } else {
    option("Skill Level", 20);
    option("UCI_LimitStrength", true);
    option("UCI_Elo", clampElo(req.elo));
  }
  if (!model.noElo) option("UCI_ShowWDL", !!req.wdl);
  if (model.nnue) option("Use NNUE", req.nnue !== false);
  option("Hash", Math.min(req.hash || 128, model.maxHash));
  send(`position fen ${req.fen}${req.moves && req.moves.length ? " moves " + req.moves.join(" ") : ""}`);
  const go = ["go"];
  if (req.depth > 0) go.push(`depth ${req.depth}`);
  if (req.nodes > 0) go.push(`nodes ${req.nodes}`);
  go.push(`movetime ${req.movetime}`);
  send(req.goCmd ?? go.join(" "));
}

function onEngineMessage(event) {
  const line = typeof event.data === "string" ? event.data : "";
  if (line) lastLine = line.slice(0, 80);
  if (line === "uciok") {
    if (!ready) send("isready");
  } else if (line === "readyok") {
    ready = true;
    clearInterval(hello);
    clearTimeout(bootTimer);
    if (modelId === requested) notice = null;
    applyOptions();
    if (pending) {
      const next = pending;
      pending = null;
      start(next);
    }
  } else if (line.startsWith("info")) {
    if (busy) parseInfo(busy, line);
  } else if (line.startsWith("bestmove")) {
    const done = busy;
    busy = null;
    if (pending) {
      const next = pending;
      pending = null;
      if (done) done.resolve({ id: done.id, move: null });
      start(next);
      return;
    }
    if (!done) return;
    let move = line.split(" ")[1];
    const { lines, depth } = finalLines(done);
    try {
      if (done.aggression > 0 && lines.length > 1) move = pickAggressive(done, lines) || move;
    } catch (e) {
      console.error("[sparring] aggression pick failed", e);
    }
    const chosen = lines.find((l) => l.move === move) || deepestFor(done, move);
    done.resolve({
      id: done.id, move, depth, maia: !!MODELS[modelId].maia,
      chosen: chosen ? { move: chosen.move, score: chosen.score, mate: chosen.mate, depth: chosen.depth, pv: chosen.pv, wdl: chosen.wdl, share: chosen.share } : null,
      lines: lines.map((c) => ({ move: c.move, pv: c.pv, score: c.score, mate: c.mate, depth: c.depth, wdl: c.wdl, share: c.share })),
    });
  }
}
