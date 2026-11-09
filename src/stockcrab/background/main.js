//! StockCrab · Message router
//! Switches engines, answers the content script's messages, keeps the page alive.
//! File: background/main.js. A background script (hosts the engine); files of one kind share a single global scope and load in the order of manifest.json.

// Switch between the full and the compact network on request (the panel's "Model" setting).
function setEngine(which) {
  const id = MODELS[which] ? which : which === "lite" ? "sf19-lite" : DEFAULT_MODEL; // "lite"/"full": old saved settings
  if (engine && id === requested && id === modelId) return;
  if (job) job.cancelled = true;
  for (const r of [busy, pending]) if (r) r.resolve({ id: r.id, move: null });
  busy = null;
  pending = null;
  newGame = true;
  lastFen = null;
  try {
    engine.terminate();
  } catch (e) {}
  requested = id;
  modelId = id;
  tried = new Set([id]);
  notice = null;
  spawn();
}

browser.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === "engine") {
    setEngine(msg.which);
    return Promise.resolve({ ok: true });
  }
  if (msg.type === "status") {
    return Promise.resolve({
      ready, engineError, lastLine, engine: MODELS[modelId].file, requested, model: modelId, modelName: MODELS[modelId].name, notice,
    });
  }
  if (msg.type === "hint") {
    if (job) job.cancelled = true; // a real position request always wins over a premove check
    return submit(msg);
  }
  if (msg.type === "rate") {
    // Search ONE move (the one the user played) from the position they had, to the depth of their hint, at full
    // strength: its score is compared with the best line of that hint.
    if (job) job.cancelled = true;
    const depth = Math.max(8, Math.min(msg.depth || 18, 30));
    if (msg.withBest) {
      // no hint was finished for this position: find the best lines first, then the played move if it is not one of them
      return (async () => {
        const a = await submit({
          id: msg.id, fen: msg.fen, elo: 3190, movetime: 2500, hash: msg.hash, multipv: 3,
          goCmd: `go depth ${Math.min(depth, 20)} movetime 2500`,
        });
        if (!a.move || a.error) return a;
        const lines = a.lines || [];
        let chosen = lines.find((l) => l.move === msg.move);
        if (!chosen) {
          const b = await submit({
            id: msg.id, fen: msg.fen, elo: 3190, movetime: 2500, hash: msg.hash, multipv: 1,
            goCmd: `go depth ${Math.max(8, a.depth || depth)} movetime 2500 searchmoves ${msg.move}`,
          });
          if (!b.move || b.error) return b;
          chosen = b.chosen || (b.lines && b.lines[0]);
        }
        return { id: msg.id, move: msg.move, depth: a.depth, lines, chosen };
      })();
    }
    return submit({
      id: msg.id, fen: msg.fen, elo: 3190, movetime: 3000, hash: msg.hash, multipv: 1,
      goCmd: `go depth ${depth} movetime 3000 searchmoves ${msg.move}`,
    });
  }
  if (msg.type === "premove") return runPremove(msg);
});

// Firefox suspends idle MV3 background pages and the worker would die with it.
// An open port from the content script and a periodic API call keep it alive.
browser.runtime.onConnect.addListener(() => {});
setInterval(() => browser.runtime.getPlatformInfo(), 15000);
