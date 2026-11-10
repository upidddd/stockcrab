// Entry point: loads the saved settings, the Alt+X hotkey, starts the timers.

// saved settings, with migration of old values
try {
  browser.storage.local.get("stockcrab").then((r) => {
    if (r.stockcrab) {
      const saved = { ...r.stockcrab };
      if (saved.engine && !saved.model) saved.model = saved.engine === "lite" ? "sf19-lite" : "sf19-full"; // old saves
      delete saved.engine;
      if (saved.colourBest === "#1f9d3a") delete saved.colourBest;
      if (saved.colourAlt === "#2f6fdd") delete saved.colourAlt;
      if ((saved.version || 1) < 3 && saved.opacity === 90) delete saved.opacity;
      if ((saved.version || 1) < 2) delete saved.showSquare;
      if (saved.colourPremove === "#d62828") delete saved.colourPremove;
      Object.assign(settings, saved, { enabled: false });
      settings.version = DEFAULTS.version;
      settings.sections = { ...DEFAULTS.sections, ...(r.stockcrab.sections || {}) };
      if (!settings.presets || typeof settings.presets !== "object") settings.presets = {};
      try {
        for (const c of CONTROLS) {
          // keep saved values inside the slider ranges
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
  if (!extensionAlive() || !settings.hotkey || !e.altKey || e.ctrlKey || e.metaKey || e.code !== "KeyX") return;
  const t = e.target;
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
  e.preventDefault();
  setEnabled(!settings.enabled);
});

async function refreshEngineInfo() {
  if (root()) syncHud(root());
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
    if (st?.notice) el.textContent = st.notice;
  } catch (e) {
    el.textContent = "Engine: no reply";
  }
}
const infoTimer = setInterval(refreshEngineInfo, 3000);

// an old copy stops when the extension is reloaded
const tickTimer = setInterval(() => {
  if (extensionAlive()) return tick();
  clearInterval(tickTimer);
  clearInterval(infoTimer);
}, 250);