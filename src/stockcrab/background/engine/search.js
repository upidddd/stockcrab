//! StockCrab · Search runner
//! Sends a search to the engine (strength, hash, position, go) and answers when it ends.
//! File: background/engine/search.js. A background script (hosts the engine); files of one kind share a single global scope and load in the order of manifest.json.

let lastFen = null;
function pieces(fen) {
  return (fen.split(" ")[0].match(/[a-z]/gi) || []).length;
}
const START_PLACEMENT = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";
// A new game starts at the initial setup or when material jumps up; otherwise keep the hash.
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
  send(`setoption name MultiPV value ${Math.min(256, Math.max(req.multipv ?? 1, req.aggression > 0 ? 2 : 1))}`);
  const model = MODELS[modelId];
  if (req.elo >= 3190) {
    send("setoption name UCI_LimitStrength value false");
    if (model.noElo) send("setoption name Skill Level value 20");
  } else if (model.noElo) {
    // no UCI_Elo in this build: map the Elo range onto Skill Level 0..20
    send(`setoption name Skill Level value ${Math.max(0, Math.min(20, Math.round(((req.elo - 1320) / (3190 - 1320)) * 20)))}`);
  } else {
    send("setoption name UCI_LimitStrength value true");
    send(`setoption name UCI_Elo value ${req.elo}`);
  }
  const hash = Math.min(req.hash || 128, model.maxHash);
  if (hash !== currentHash) {
    send(`setoption name Hash value ${hash}`);
    currentHash = hash;
  }
  send(`position fen ${req.fen}${req.moves && req.moves.length ? " moves " + req.moves.join(" ") : ""}`);
  send(req.goCmd ?? (req.depth > 0 ? `go depth ${req.depth} movetime ${req.movetime}` : `go movetime ${req.movetime}`));
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
    // The evaluation shown for the move must belong to that very move: the line it is in, or its own deepest record.
    const chosen = lines.find((l) => l.move === move) || deepestFor(done, move);
    done.resolve({
      id: done.id, move, depth, chosen: chosen ? { move: chosen.move, score: chosen.score, mate: chosen.mate, depth: chosen.depth, pv: chosen.pv } : null,
      lines: lines.map((c) => ({ move: c.move, pv: c.pv, score: c.score, mate: c.mate, depth: c.depth })),
    });
  }
}
