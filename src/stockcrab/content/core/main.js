//! StockCrab · Entry point
//! Loads the saved settings (with migration), the Alt+X hotkey, the periodic jobs: the start of everything.
//! File: content/core/main.js. A content script (runs on chess.com and lichess pages); files of one kind share a single global scope and load in the order of manifest.json.

// Load the saved settings. This is the last file to load, so everything the callback uses (the panel, the controls) exists by now.
try {
  browser.storage.local.get("stockcrab").then((r) => {
    if (r.stockcrab) {
      const saved = { ...r.stockcrab };
      if (saved.engine && !saved.model) saved.model = saved.engine === "lite" ? "sf19-lite" : "sf19-full"; // pre-model saves
      delete saved.engine;
      if (saved.colourBest === "#1f9d3a") delete saved.colourBest; // old default green
      if (saved.colourAlt === "#2f6fdd") delete saved.colourAlt; // old default blue
      if ((saved.version || 1) < 3 && saved.opacity === 90) delete saved.opacity; // the old default; hints are now more transparent
      if ((saved.version || 1) < 2) delete saved.showSquare; // the card used to show the cell name by default; it is now off
      if (saved.colourPremove === "#d62828") delete saved.colourPremove; // old default red
      Object.assign(settings, saved, { enabled: false });
      settings.version = DEFAULTS.version; // migrated: the next load must not redo the resets above
      settings.sections = { ...DEFAULTS.sections, ...(r.stockcrab.sections || {}) };
      try {
        for (const c of CONTROLS) {
          // a saved value of the wrong type or outside the slider's range must not break the panel or the engine request
          if (c.type === "range" && !(Number.isFinite(settings[c.key]) && settings[c.key] >= c.min && settings[c.key] <= c.max)) {
            settings[c.key] = Math.min(c.max, Math.max(c.min, Number.isFinite(Number(settings[c.key])) ? Number(settings[c.key]) : DEFAULTS[c.key]));
          }
        }
      } catch (e) {}
    }
    syncPanel();
  });
} catch (e) {}

document.addEventListener("keydown", (e) => {
  if (!settings.hotkey || !e.altKey || e.ctrlKey || e.metaKey || e.code !== "KeyX") return;
  const t = e.target;
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
  e.preventDefault();
  setEnabled(!settings.enabled);
});

async function refreshEngineInfo() {
  const el = root()?.querySelector(".einfo");
  if (!el) return;
  if (!settings.enabled) {
    el.textContent = "Off";
    return;
  }
  try {
    const st = await browser.runtime.sendMessage({ type: "status" });
    const state = !st ? "no reply" : st.engineError ? "error" : st.ready ? "ready" : "starting…";
    el.textContent = st ? `${st.modelName || "Engine"} · ${state}` : "Engine: no reply";
    el.title = st?.notice || "";
    if (st?.notice) el.textContent = st.notice; // e.g. "Stockfish 17.1 Full did not start, using Stockfish 19 Full"
  } catch (e) {
    el.textContent = "Engine: no reply";
  }
}
setInterval(refreshEngineInfo, 3000);

probeIconFiles();
setInterval(tick, 250);