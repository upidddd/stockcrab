//! StockCrab · Search queue
//! One search at a time: a newer request replaces the one waiting.
//! File: background/engine/queue.js. A background script (hosts the engine); files of one kind share a single global scope and load in the order of manifest.json.

// Queue one search. Resolves with the engine's answer, or {move: null} if a newer search replaced it.
function submit(msg) {
  if (dead) {
    dead = false;
    crashes = [];
    spawn();
  }
  return new Promise((resolve) => {
    const req = {
      id: msg.id, fen: msg.fen, elo: msg.elo, movetime: msg.movetime, aggression: msg.aggression,
      multipv: msg.multipv, moves: msg.moves, goCmd: msg.goCmd, hash: msg.hash, depth: msg.depth,
    };
    // Never leave the caller hanging: answer with an error if the engine stays silent.
    const timer = setTimeout(() => {
      if (busy === req) busy = null;
      if (pending === req) pending = null;
      resolve({ id: req.id, move: null, error: `engine timeout [${lastLine || "no output"}]` });
    }, (msg.movetime ?? 2000) + (ready ? 8000 : bootMs() + 15000));
    req.resolve = (v) => {
      clearTimeout(timer);
      resolve(v);
    };
    if (pending) pending.resolve({ id: pending.id, move: null });
    if (!ready) {
      pending = req;
    } else if (busy) {
      pending = req;
      send("stop");
    } else {
      start(req);
    }
  });
}
