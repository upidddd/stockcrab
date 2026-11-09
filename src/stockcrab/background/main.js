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
  if (msg.type === "premove") return runPremove(msg);
});

// Firefox suspends idle MV3 background pages and the worker would die with it.
// An open port from the content script and a periodic API call keep it alive.
browser.runtime.onConnect.addListener(() => {});
setInterval(() => browser.runtime.getPlatformInfo(), 15000);
