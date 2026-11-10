// Search queue: one search at a time.

// Queues a search; a newer one replaces the waiting one.
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
    // timeout
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
