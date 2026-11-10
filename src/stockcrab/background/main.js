// Message router and engine switching.

// Switches the engine model.
function setEngine(which) {
  const id = MODELS[which] ? which : which === "lite" ? "sf19-lite" : DEFAULT_MODEL;
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
    if (job) job.cancelled = true;
    return msg.opening ? hintWithBook(msg) : submit(msg);
  }
  if (msg.type === "openings") return openingNames();
  if (msg.type === "premove") return runPremove(msg);
});

// Keeps the background page alive.
browser.runtime.onConnect.addListener(() => {});
setInterval(() => browser.runtime.getPlatformInfo(), 15000);
