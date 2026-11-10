// Settings panel and HUD.

const MODEL_OPTIONS = [
  ["sf19-full", "Stockfish 19 · Full"],
  ["sf19-lite", "Stockfish 19 · Lite"],
  ["sf19-quick", "Stockfish 19 · Quick"],
  ["sf17-full", "Stockfish 17.1 · Full"],
  ["sf17-lite", "Stockfish 17.1 · Lite"],
  ["sf11", "Stockfish 11 · Classic"],
  ["sf19-asm", "Stockfish 19 · JavaScript"],
  ["fairy", "Fairy-Stockfish"],
  ["maia3", "Maia 3 · human-like"],
];

// What each model can do; the panel shows only the settings that apply.
const MODEL_INFO = {
  "sf19-full": { elo: [1320, 3190] },
  "sf19-lite": { elo: [1320, 3190] },
  "sf19-quick": { elo: [1320, 3190], quick: true },
  "sf17-full": { elo: [1320, 3190] },
  "sf17-lite": { elo: [1320, 3190] },
  "sf11": { elo: [1320, 3190], noWdl: true, maxHash: 64 },
  "sf19-asm": { elo: [1320, 3190], maxHash: 32 },
  "fairy": { elo: [500, 2850], nnue: true },
  "maia3": { maia: true },
};
const modelInfo = (s = settings) => MODEL_INFO[s.model] || {};
const searching = (s) => !modelInfo(s).maia;
const timed = (s) => searching(s) && !modelInfo(s).quick;

function eloText(v) {
  if (v >= 3190) return "max";
  const [lo, hi] = modelInfo().elo || [500, 3190];
  return v < lo ? `${lo} (lowest)` : v > hi ? `${hi} (highest)` : v;
}
const nodesText = (v) => (!v ? "off" : v < 1000 ? v + "k" : (v / 1000).toFixed(v % 1000 ? 2 : 0) + "M");
const secText = (v) => (v / 1000).toFixed(1) + " s";
const CORNERS = [["tl", "Top left"], ["tr", "Top right"], ["bl", "Bottom left"], ["br", "Bottom right"]];

const SECTIONS = [
  ["configs", "Configs", [{ key: "_configs", type: "configs" }]],
  ["engine", "Engine", [
    { key: "model", type: "select", label: "Model", opts: MODEL_OPTIONS, fx: "engine" },
    { key: "_maiaNote", type: "note", text: "Maia does not calculate: it suggests the moves people of this rating play most.", when: (s) => !searching(s) },
    { key: "_quickNote", type: "note", text: "Quick searches every position to a small fixed depth: it answers at once and plays weaker.", when: (s) => !!modelInfo(s).quick },
    { key: "maiaRating", type: "range", label: "Players' rating", min: 600, max: 2600, step: 50, fmt: (v) => v, fx: "query", when: (s) => !searching(s) },
    { key: "maiaOppo", type: "range", label: "Opponent's rating", min: 500, max: 2600, step: 50, fmt: (v) => (v <= 500 ? "same" : v), fx: "query", when: (s) => !searching(s) },
    { key: "maiaShow", type: "select", label: "Card shows", opts: [["score", "Score"], ["share", "Share of players"]], fx: "render", when: (s) => !searching(s) },
    { key: "quickDepth", type: "range", label: "Depth", min: 1, max: 20, step: 1, fmt: (v) => v, fx: "query", when: (s) => !!modelInfo(s).quick },
    { key: "strengthBy", type: "select", label: "Strength by", opts: [["elo", "Elo"], ["skill", "Skill level"]], fx: "query", when: searching },
    { key: "elo", type: "range", label: "Strength (Elo)", min: 500, max: 3190, step: 10, fmt: eloText, fx: "query", when: (s) => searching(s) && s.strengthBy !== "skill" },
    { key: "skill", type: "range", label: "Skill level", min: 0, max: 20, step: 1, fmt: (v) => (v >= 20 ? "20 (max)" : v), fx: "query", when: (s) => searching(s) && s.strengthBy === "skill" },
    { key: "movetime", type: "range", label: "Think time", min: 500, max: 30000, step: 500, fmt: secText, fx: "query", when: timed },
    { key: "depth", type: "range", label: "Max depth", min: 0, max: 40, step: 1, fmt: (v) => (v ? v : "off"), fx: "query", when: timed },
    { key: "nodes", type: "range", label: "Max nodes", min: 0, max: 5000, step: 50, fmt: nodesText, fx: "query", when: timed },
    { key: "aggression", type: "range", label: "Aggression (costs strength)", min: 0, max: 100, step: 10, fmt: (v) => v + "%", fx: "query", when: searching },
    { key: "hash", type: "range", label: "Hash memory", min: 16, max: 256, step: 16, fmt: (v) => Math.min(v, modelInfo().maxHash || 256) + " MB", fx: "query", when: searching },
    { key: "useNnue", type: "check", label: "NNUE evaluation (off = classical)", fx: "query", when: (s) => !!modelInfo(s).nnue },
    { key: "showWdl", type: "check", label: "Show win / draw / loss", fx: "query", when: (s) => !modelInfo(s).noWdl },
  ]],
  ["uci", "Engine options", [{ key: "_uci", type: "uci" }]],
  ["moves", "Moves", [
    { key: "others", type: "range", label: (s) => (searching(s) ? "Other good moves" : "Other popular moves"), min: 0, max: 3, step: 1, fmt: (v) => (v ? v : "none"), fx: "query" },
    { key: "goodWithin", type: "range", label: "“Good” = at most this far behind", min: 10, max: 150, step: 10, fmt: (v) => v + " cp", fx: "render", when: searching },
    { key: "maiaMinShare", type: "range", label: "Played by at least", min: 1, max: 30, step: 1, fmt: (v) => v + "%", fx: "render", when: (s) => !searching(s) },
    { key: "scoreUnits", type: "select", label: "Scores as", opts: [["pawns", "Pawns (+0.35)"], ["cp", "Centipawns (+35)"], ["win", "Win chance (62%)"]], fx: "render" },
    { key: "showList", type: "check", label: "Show the move list below", fx: "panel" },
  ]],
  ["opening", "Opening", [
    { key: "_openingNote", type: "note", text: "Hints follow the chosen opening while the game stays in its book, then the engine takes over." },
    { key: "openingWhite", type: "opening", label: "As White", fx: "query" },
    { key: "openingBlack", type: "opening", label: "As Black", fx: "query" },
    { key: "bookMaxLoss", type: "range", label: "Leave the book if it is worse by", min: 20, max: 500, step: 10, fmt: (v) => (v >= 500 ? "never" : v + " cp"), fx: "query", when: (s) => !!(s.openingWhite || s.openingBlack) },
  ]],
  ["premove", "Premove", [
    { key: "_premoveNote", type: "note", text: "Premoves need a model that calculates (Stockfish or Fairy-Stockfish).", when: (s) => !searching(s) },
    { key: "premove", type: "check", label: "Show a premove", fx: "query", when: searching },
    { key: "premoveMode", type: "select", label: "Style", opts: [["smart", "When it's worth it"], ["likely", "Always, just in case"], ["safe", "Only if it's safe"]], fx: "query", when: (s) => searching(s) && s.premove },
    { key: "obviousLead", type: "range", label: "Worth it: their best move leads by", min: 20, max: 400, step: 20, fmt: (v) => v + " cp", fx: "query", when: (s) => searching(s) && s.premove && s.premoveMode === "smart" },
    { key: "replyGap", type: "range", label: "Worth it: your reply leads by", min: 5, max: 100, step: 5, fmt: (v) => v + " cp", fx: "query", when: (s) => searching(s) && s.premove && s.premoveMode === "smart" },
    { key: "likelyCount", type: "range", label: "Likely opponent moves checked", min: 1, max: 8, step: 1, fmt: (v) => v, fx: "query", when: (s) => searching(s) && s.premove && s.premoveMode !== "safe" },
    { key: "likelyWithin", type: "range", label: "“Likely” = within", min: 20, max: 300, step: 20, fmt: (v) => v + " cp", fx: "query", when: (s) => searching(s) && s.premove && s.premoveMode !== "safe" },
    { key: "safeGap", type: "range", label: "“Safe”: your reply leads by", min: 5, max: 100, step: 5, fmt: (v) => v + " cp", fx: "query", when: (s) => searching(s) && s.premove && s.premoveMode === "safe" },
    { key: "premovePer", type: "range", label: "Check time per opponent move", min: 80, max: 600, step: 20, fmt: (v) => v + " ms", fx: "query", when: (s) => searching(s) && s.premove },
    { key: "pawnTrade", type: "check", label: "Premove pawn retakes", fx: "query", when: (s) => searching(s) && s.premove },
    { key: "tradeTolerance", type: "range", label: "Skip the retake if it is worse by", min: 20, max: 300, step: 20, fmt: (v) => v + " cp", fx: "query", when: (s) => searching(s) && s.premove && s.pawnTrade },
  ]],
  ["look", "Look", [
    { key: "theme", type: "select", label: "Panel theme", opts: [["auto", "Like the system"], ["light", "Light"], ["dark", "Dark"]], fx: "panel" },
    { key: "accent", type: "color", label: "Accent colour (panel, HUD, trail)", fx: "panel" },
    { key: "colourBest", type: "color", label: "Best move colour", fx: "render" },
    { key: "colourAlt", type: "color", label: "Other moves colour", fx: "render" },
    { key: "colourPremove", type: "color", label: "Premove colour", fx: "render" },
    { key: "colourOutline", type: "color", label: "Square outline colour", fx: "render" },
    { key: "lineWidth", type: "range", label: "Line width", min: 50, max: 200, step: 10, fmt: (v) => v + "%", fx: "render" },
    { key: "opacity", type: "range", label: "Opacity", min: 30, max: 100, step: 5, fmt: (v) => v + "%", fx: "render" },
    { key: "blur", type: "range", label: "Blur under the hints", min: 0, max: 12, step: 1, fmt: (v) => (v ? v + " px" : "off"), fx: "render" },
    { key: "flowColours", type: "select", label: "Flowing colours", opts: [["crab", "Crab (orange · red)"], ["duo", "Orange · cyan"], ["off", "Off"]], fx: "render" },
    { key: "showOutline", type: "check", label: "Outline the squares", fx: "render" },
    { key: "showHead", type: "check", label: "Arrow head", fx: "render" },
    { key: "showLabels", type: "check", label: "Score on the board", fx: "render" },
    { key: "showSquare", type: "check", label: "Cell name in the card", fx: "render" },
    { key: "animate", type: "check", label: "Animations", fx: "panel" },
    { key: "cursorTrail", type: "check", label: "Cursor trail", fx: "panel" },
  ]],
  ["panel", "Panel", [
    { key: "corner", type: "select", label: "Position", opts: CORNERS, fx: "panel" },
    { key: "side", type: "select", label: "I play", opts: [["auto", "Auto-detect"], ["w", "White"], ["b", "Black"], ["turn", "Whoever is to move"]], fx: "query" },
    { key: "hotkey", type: "check", label: "Alt+X turns StockCrab on/off", fx: "panel" },
    { key: "showHud", type: "check", label: "HUD with the active features", fx: "panel" },
    { key: "hudCorner", type: "select", label: "HUD position", opts: CORNERS, fx: "panel", when: (s) => s.showHud },
    { key: "checkUpdates", type: "check", label: "Check for updates", fx: "panel" },
    { key: "_update", type: "update" },
  ]],
];
const CONTROLS = SECTIONS.flatMap(([, , list]) => list);
const QUERY_KEYS = CONTROLS.filter((c) => c.fx === "query" || c.fx === "engine").map((c) => c.key);

// Configs: every setting of the panel plus the engine options, saved under a name or to a file.
const CONFIG_KEYS = CONTROLS.filter((c) => !c.key.startsWith("_")).map((c) => c.key);
let configPick = "";

function currentConfig() {
  const out = {};
  for (const k of CONFIG_KEYS) out[k] = settings[k];
  out.uci = JSON.parse(JSON.stringify(settings.uci || {}));
  return out;
}

// Only known keys with values a control accepts.
function cleanConfig(values) {
  const out = {};
  if (!values || typeof values !== "object") return out;
  for (const c of CONTROLS) {
    if (!(c.key in values)) continue;
    const v = values[c.key];
    if (c.type === "range" && Number.isFinite(v)) out[c.key] = Math.min(c.max, Math.max(c.min, v));
    else if (c.type === "check" && typeof v === "boolean") out[c.key] = v;
    else if (c.type === "select" && c.opts.some(([o]) => o === v)) out[c.key] = v;
    else if (c.type === "color" && /^#[0-9a-f]{6}$/i.test(v)) out[c.key] = v;
    else if (c.type === "opening" && typeof v === "string" && v.length <= 120) out[c.key] = v;
  }
  if (values.uci && typeof values.uci === "object") {
    out.uci = {};
    for (const [model, opts] of Object.entries(values.uci)) {
      if (!MODEL_INFO[model] || !opts || typeof opts !== "object") continue;
      const ok = Object.entries(opts).filter(([n, v]) => n.length < 60 && ["string", "number", "boolean"].includes(typeof v));
      if (ok.length) out.uci[model] = Object.fromEntries(ok);
    }
  }
  return out;
}

function applyConfig(values) {
  const model = settings.model;
  Object.assign(settings, cleanConfig(values));
  if (settings.model !== model && settings.enabled) sendEngineChoice();
  lastKey = null;
  rerender();
  syncPanel();
  loadUciOptions();
  save();
}

function configMessage(text) {
  const el = root()?.querySelector(".pre-msg");
  if (!el) return;
  el.textContent = text;
  clearTimeout(configMessage.timer);
  configMessage.timer = setTimeout(() => (el.textContent = ""), 3000);
}

const fileName = (name) => "stockcrab-" + (name || "config").replace(/[^\w.-]+/g, "-").replace(/^-|-$/g, "").toLowerCase() + ".json";

function downloadText(name, text) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  a.download = name;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}

function addConfig(name, values) {
  let n = String(name || "Config").trim().slice(0, 40) || "Config";
  if (n in settings.presets) {
    let i = 2;
    while (`${n} (${i})` in settings.presets) i++;
    n = `${n} (${i})`;
  }
  settings.presets = { ...settings.presets, [n]: values };
  configPick = n;
  return n;
}

function onConfigAction(act, shadow) {
  const nameEl = shadow.querySelector(".pre-name");
  const picked = settings.presets[configPick];
  if (act === "apply") {
    if (!picked) return configMessage("Save or load a config first");
    applyConfig(picked);
    configMessage(`Applied “${configPick}”`);
  } else if (act === "save") {
    const n = nameEl.value.trim().slice(0, 40);
    if (!n) return configMessage("Type a name first");
    settings.presets = { ...settings.presets, [n]: currentConfig() };
    configPick = n;
    nameEl.value = "";
    syncPanel();
    save();
    configMessage(`Saved “${n}”`);
  } else if (act === "delete") {
    if (!picked) return;
    const { [configPick]: gone, ...rest } = settings.presets;
    settings.presets = rest;
    configMessage(`Deleted “${configPick}”`);
    configPick = "";
    syncPanel();
    save();
  } else if (act === "export") {
    const name = picked ? configPick : "current";
    downloadText(fileName(name), JSON.stringify({ stockcrab: 2, name, settings: picked || currentConfig() }, null, 2));
    configMessage(`Saved ${fileName(name)}`);
  } else if (act === "import") {
    shadow.querySelector(".pre-file").click();
  }
}

async function onConfigFile(input) {
  const file = input.files && input.files[0];
  input.value = "";
  if (!file) return;
  try {
    if (file.size > 200000) throw new Error("too big");
    const data = JSON.parse(await file.text());
    const values = cleanConfig(data.settings || data);
    if (!Object.keys(values).length) throw new Error("no settings");
    const n = addConfig(data.name || file.name.replace(/\.json$/i, "").replace(/^stockcrab-/, ""), values);
    applyConfig(values);
    configMessage(`Loaded and applied “${n}”`);
  } catch (e) {
    configMessage("That file is not a StockCrab config");
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch (e2) {}
    ta.remove();
  }
}

const PANEL_CSS = `
  :host { all: initial; color-scheme: light dark; --accent: #e4572e; }
  * { box-sizing: border-box; }
  .box {
    --bg: #ffffff; --fg: #22252a; --muted: #6b7280; --line: #e4e6ea; --soft: #f3f4f6;
    --shine: color-mix(in srgb, var(--accent) 85%, #fff);
    position: fixed; z-index: 99999; width: 262px; padding: 10px 12px 10px;
    max-height: calc(100vh - 24px); overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin;
    background: var(--bg); color: var(--fg); border: 1px solid var(--line); border-radius: 10px;
    box-shadow: 0 6px 22px rgba(0, 0, 0, .2); color-scheme: light;
    font: 12.5px/1.35 "Inter", "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-variant-numeric: tabular-nums; -webkit-font-smoothing: antialiased;
  }
  .box.theme-dark {
    --bg: #262421; --fg: #ececec; --muted: #9d9a95; --line: #3b3835; --soft: #312e2b; --shine: color-mix(in srgb, #fff 80%, var(--accent));
    box-shadow: 0 8px 28px rgba(0, 0, 0, .5); color-scheme: dark;
  }
  @media (prefers-color-scheme: dark) {
    .box.theme-auto {
      --bg: #262421; --fg: #ececec; --muted: #9d9a95; --line: #3b3835; --soft: #312e2b; --shine: color-mix(in srgb, #fff 80%, var(--accent));
      box-shadow: 0 8px 28px rgba(0, 0, 0, .5); color-scheme: dark;
    }
  }
  .c-br { right: 12px; bottom: 12px; } .c-bl { left: 12px; bottom: 12px; }
  .c-tr { right: 12px; top: 12px; } .c-tl { left: 12px; top: 12px; }

  .hud {
    --h1: color-mix(in srgb, var(--accent) 70%, #fff); --h2: var(--accent); --h3: color-mix(in srgb, var(--accent) 45%, #fff);
    position: fixed; z-index: 99998; display: flex; flex-direction: column; align-items: flex-start;
    pointer-events: none; font: 600 13px/1.3 "Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; letter-spacing: -.005em;
  }
  .hud[hidden] { display: none; }
  .hud.h-tl { left: 0; top: 0; } .hud.h-tr { right: 0; top: 0; } .hud.h-bl { left: 0; bottom: 0; } .hud.h-br { right: 0; bottom: 0; }
  .hud.h-tr, .hud.h-br { align-items: flex-end; }
  .hud.h-bl, .hud.h-br { flex-direction: column-reverse; }
  .hud.beside.h-tl, .hud.beside.h-bl { left: 286px; }
  .hud.beside.h-tr, .hud.beside.h-br { right: 286px; }
  .hud .hl {
    padding: 1px 6px 1px 5px; background: rgba(12, 10, 10, .62); border-left: 2px solid currentColor;
    text-shadow: 1px 1px 0 rgba(0, 0, 0, .75); white-space: nowrap; animation: hudwave 2.6s linear infinite;
  }
  .hud.h-tr .hl, .hud.h-br .hl { border-left: 0; border-right: 2px solid currentColor; padding: 1px 5px 1px 6px; }
  .hud .hl span { margin-left: 3px; color: #c9c3bd; }
  .hud.still .hl { animation: none; color: var(--h2); }
  @keyframes hudwave { 0%, 100% { color: var(--h1); } 33% { color: var(--h2); } 66% { color: var(--h3); } }

  .head { display: flex; align-items: center; gap: 8px; }
  .logo { display: flex; flex: none; } .logo svg { width: 24px; height: 24px; }
  .name { flex: 1; min-width: 0; }
  .title {
    display: inline-block; font-size: 14px; font-weight: 700; letter-spacing: -.01em; line-height: 1.2; color: var(--fg);
    background: linear-gradient(105deg, var(--fg) 0 38%, var(--shine) 50%, var(--fg) 62% 100%) 100% 0 / 300% 100% no-repeat;
    -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
  }
  .box.anim .title { animation: shine 5s ease-in-out infinite; }
  @keyframes shine { 0%, 55% { background-position: 100% 0; } 85%, 100% { background-position: 0 0; } }
  .sub { font-size: 10.5px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sw { position: relative; width: 34px; height: 20px; flex: none; }
  .sw input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; z-index: 1; }
  .sw i { position: absolute; inset: 0; border-radius: 99px; background: var(--line); transition: background .15s; }
  .sw i::after { content: ""; position: absolute; top: 3px; left: 3px; width: 14px; height: 14px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0, 0, 0, .3); transition: transform .15s; }
  .sw input:checked + i { background: var(--accent); }
  .sw input:checked + i::after { transform: translateX(14px); }
  .fold { width: 22px; height: 22px; border: 0; border-radius: 6px; background: transparent; color: var(--muted); font-size: 14px; line-height: 22px; cursor: pointer; padding: 0; flex: none; }
  .fold:hover { background: var(--soft); }

  .body { margin-top: 6px; }
  details { border-top: 1px solid var(--line); margin-top: 6px; padding-top: 6px; }
  summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 8px; padding: 2px 0; user-select: none;
    font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
  summary::-webkit-details-marker { display: none; }
  summary::marker { content: ""; }
  summary::before { content: ""; width: 6px; height: 6px; flex: none; border-right: 1.6px solid currentColor; border-bottom: 1.6px solid currentColor; transform: rotate(-45deg); transition: transform .12s; }
  details[open] > summary::before { transform: rotate(45deg); }
  summary:hover { color: var(--fg); }
  .grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; margin: 8px 0 2px; }
  .lab { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-bottom: 1px; font-size: 11.5px; color: var(--muted); }
  .lab b { color: var(--fg); font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }

  input[type=range] { -moz-appearance: none; appearance: none; display: block; width: 100%; height: 16px; margin: 0; background: transparent; cursor: pointer; }
  input[type=range]:focus { outline: none; }
  input[type=range]::-moz-range-track { height: 4px; border-radius: 2px; background: var(--line); }
  input[type=range]::-moz-range-progress { height: 4px; border-radius: 2px; background: var(--accent); }
  input[type=range]::-moz-range-thumb { width: 14px; height: 14px; border-radius: 50%; background: #fff; border: 2px solid var(--accent); box-sizing: border-box; }
  input[type=range]::-webkit-slider-runnable-track { height: 4px; border-radius: 2px; background: linear-gradient(90deg, var(--accent) var(--p, 50%), var(--line) var(--p, 50%)); }
  input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; margin-top: -5px; border-radius: 50%; background: #fff; border: 2px solid var(--accent); box-sizing: border-box; }

  .chk { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 12px; }
  .chk input { width: 14px; height: 14px; margin: 0; flex: none; accent-color: var(--accent); }
  .sel { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 11.5px; color: var(--muted); }
  .sel > span { flex: 1 1 auto; min-width: 0; }
  .field, .sel select, .pre select, .pre input {
    font: inherit; font-size: 11.5px; color: var(--fg); background: var(--soft); border: 1px solid var(--line); border-radius: 6px;
    padding: 3px 6px; height: 24px; margin: 0; min-width: 0;
  }
  .sel select { flex: 0 1 auto; max-width: 150px; }
  .field:focus, .sel select:focus, .pre select:focus, .pre input:focus { outline: none; border-color: var(--accent); }
  .sel input.txt { flex: 0 1 150px; width: 150px; }
  .sel input.num { flex: none; width: 82px; text-align: right; }
  .sel input[type=color] { flex: none; width: 36px; height: 22px; padding: 0 2px; border: 1px solid var(--line); border-radius: 6px; background: var(--soft); cursor: pointer; }
  .reset, .btn { font: inherit; font-size: 11.5px; color: var(--fg); background: var(--soft); border: 1px solid var(--line); border-radius: 6px; padding: 0 10px; height: 24px; cursor: pointer; white-space: nowrap; }
  .reset { height: 28px; }
  .reset:hover, .btn:hover { border-color: var(--muted); }
  .btn { flex: none; }
  .btn.main { background: var(--accent); border-color: var(--accent); color: #fff; }
  .btn:disabled { opacity: .45; cursor: default; }
  .btn[hidden] { display: none; }
  .note { font-size: 11px; line-height: 1.4; color: var(--muted); background: var(--soft); border-radius: 6px; padding: 6px 8px; }
  .pre { display: grid; grid-template-columns: minmax(0, 1fr); gap: 6px; }
  .pre .row { display: flex; gap: 6px; align-items: center; }
  .pre select, .pre input { flex: 1; width: 0; }
  .pre .row.small .btn { flex: 1; }
  .pre-msg, .upd-msg { font-size: 11px; color: var(--muted); }
  .pre-msg:empty, .upd-msg:empty { display: none; }
  .ctl[hidden] { display: none; }

  .op { position: relative; }
  .sugg { margin-top: 4px; border: 1px solid var(--line); border-radius: 6px; background: var(--bg); overflow: hidden; }
  .sugg[hidden] { display: none; }
  .sugg button { display: block; width: 100%; text-align: left; font: inherit; font-size: 11.5px; color: var(--fg); background: none; border: 0;
    padding: 4px 8px; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sugg button:hover, .sugg button.on { background: var(--soft); color: var(--accent); }
  .uci { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; }
  .uci .sel > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .uci .changed > span, .uci .changed { color: var(--fg); font-weight: 600; }
  .upd { display: flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--muted); }
  .upd .upd-text { flex: 1; min-width: 0; }
  .upd .upd-text b { color: var(--fg); font-weight: 600; }

  .moves { margin-top: 8px; display: grid; gap: 4px; }
  .moves:empty, .no-list .moves { display: none; }
  .mv { display: flex; align-items: center; gap: 8px; padding: 4px 6px 4px 0; border-radius: 7px; background: var(--soft); overflow: hidden; }
  .mv .chip { width: 3px; align-self: stretch; flex: none; }
  .mv .nm { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 6px; }
  .mv .san { font-size: 13.5px; font-weight: 700; letter-spacing: -.01em; }
  .mv .co { font-size: 10px; color: var(--muted); white-space: nowrap; }
  .mv .dt { flex-basis: 100%; font-size: 10px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mv .tag { font-size: 9px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
  .mv .sc { font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 99px; white-space: nowrap; flex: none; }

  .status { margin-top: 8px; display: flex; align-items: center; gap: 7px; min-height: 16px; font-size: 11.5px; color: var(--muted); cursor: pointer; }
  .status::before { content: ""; width: 7px; height: 7px; border-radius: 50%; flex: none; background: var(--line); }
  .status[data-kind=ok] { color: var(--fg); } .status[data-kind=ok]::before { background: #2ea043; }
  .status[data-kind=busy]::before { background: var(--accent); }
  .status[data-kind=err] { color: #d1242f; } .status[data-kind=err]::before { background: #d1242f; }
  .off .status, .off .moves, .collapsed .body { display: none; }
  @media (max-width: 640px) { .box { left: 8px !important; right: 8px !important; width: auto; max-height: 60vh; } }
`;

const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function controlHtml(c) {
  return `<div class="ctl" data-ctl="${c.key}">${controlInner(c)}</div>`;
}

function controlInner(c) {
  if (c.type === "range") {
    return `<div class="lab"><span data-l="${c.key}">${typeof c.label === "function" ? c.label(settings) : c.label}</span><b data-v="${c.key}"></b></div>
      <input type="range" data-key="${c.key}" min="${c.min}" max="${c.max}" step="${c.step}">`;
  }
  if (c.type === "check") return `<label class="chk"><input type="checkbox" data-key="${c.key}"><span>${c.label}</span></label>`;
  if (c.type === "select") {
    const opts = c.opts.map(([v, t]) => `<option value="${v}">${t}</option>`).join("");
    return `<label class="sel"><span>${c.label}</span><select data-key="${c.key}">${opts}</select></label>`;
  }
  if (c.type === "note") return `<div class="note">${c.text}</div>`;
  if (c.type === "opening") {
    return `<div class="op"><label class="sel"><span>${c.label}</span><input class="field txt" data-key="${c.key}" placeholder="Engine only" spellcheck="false" autocomplete="off"></label><div class="sugg" hidden></div></div>`;
  }
  if (c.type === "configs") {
    return `<div class="pre">
      <div class="row"><select class="pre-list"></select><button class="btn main" data-act="apply">Apply</button><button class="btn" data-act="delete" title="Delete this config">Delete</button></div>
      <div class="row"><input class="pre-name" maxlength="40" placeholder="Name for the current settings"><button class="btn" data-act="save">Save</button></div>
      <div class="row small"><button class="btn" data-act="export">Save to file</button><button class="btn" data-act="import">Load from file</button></div>
      <input type="file" class="pre-file" accept=".json,application/json" hidden>
      <div class="pre-msg"></div>
    </div>`;
  }
  if (c.type === "uci") return `<div class="uci"></div>`;
  if (c.type === "update") {
    return `<div class="upd"><span class="upd-text"></span><button class="btn" data-up="check">Check</button><button class="btn main" data-up="install" hidden>Update</button></div><div class="upd-msg"></div>`;
  }
  return `<label class="sel"><span>${c.label}</span><input type="color" data-key="${c.key}"></label>`;
}

function mountPanel() {
  const old = document.getElementById(PANEL_ID);
  if (old && old.dataset.instance === INSTANCE) return;
  if (old) {
    old.remove();
    document.querySelectorAll(`.${MARK}, .stockcrab-trail`).forEach((el) => el.remove());
  }
  const host = document.createElement("div");
  host.id = PANEL_ID;
  host.dataset.instance = INSTANCE;
  const shadow = host.attachShadow({ mode: "open" });
  const sections = SECTIONS.map(
    ([id, title, list]) =>
      `<details data-section="${id}"><summary>${title}</summary><div class="grid">${list.map(controlHtml).join("")}${
        id === "panel" ? '<button class="reset">Reset to defaults</button>' : ""
      }</div></details>`,
  ).join("");
  shadow.innerHTML = `<style>${PANEL_CSS}</style>
    <div class="box">
      <div class="head">
        <span class="logo">${LOGO_SVG}</span>
        <div class="name"><div class="title">StockCrab</div><div class="sub einfo"></div></div>
        <label class="sw" title="Alt+X"><input type="checkbox" class="on"><i></i></label>
        <button class="fold" title="Collapse">▾</button>
      </div>
      <div class="body">${sections}</div>
      <div class="moves"></div>
      <div class="status"></div>
    </div>
    <div class="hud" hidden></div>`;
  document.body.appendChild(host);

  // click copies what was read from the page
  const statusEl = shadow.querySelector(".status");
  statusEl.title = "Click: copy the position that was read";
  statusEl.addEventListener("click", async () => {
    let who = "?";
    try {
      who = myColour(getBoard());
    } catch (e) {}
    await copyText(`${SITE} · I play ${who} · ${lastRead}`);
    const before = statusEl.textContent;
    statusEl.textContent = "Position copied";
    setTimeout(() => (statusEl.textContent = before), 1200);
  });

  shadow.querySelector(".on").addEventListener("change", (e) => setEnabled(e.target.checked));
  shadow.querySelector(".fold").addEventListener("click", () => {
    settings.collapsed = !settings.collapsed;
    syncPanel();
    save();
  });
  shadow.querySelectorAll("details").forEach((d) =>
    d.addEventListener("toggle", () => {
      if (settings.sections[d.dataset.section] === d.open) return;
      settings.sections[d.dataset.section] = d.open;
      if (d.open && d.dataset.section === "uci") loadUciOptions();
      save();
    }),
  );
  const onControl = (e) => {
    if (e.target.dataset.uci !== undefined) return onUciControl(e);
    const el = e.target.closest("[data-key]");
    if (!el) return;
    const c = CONTROLS.find((x) => x.key === el.dataset.key);
    if (!c) return;
    if ((e.type === "input") !== (c.type === "range" || c.type === "color")) return;
    const before = settings[c.key];
    settings[c.key] = c.type === "range" ? Number(el.value) : c.type === "check" ? el.checked : c.type === "opening" ? el.value.trim() : el.value;
    if (settings[c.key] === before && c.type !== "range") return;
    if (c.fx === "engine") {
      if (settings.enabled) sendEngineChoice();
      loadUciOptions();
    }
    if (c.fx === "render") rerender();
    syncPanel();
    save();
  };
  shadow.addEventListener("input", onControl);
  shadow.addEventListener("change", onControl);
  // typing in the panel must not reach the site's hotkeys
  shadow.addEventListener("keydown", (e) => {
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) && e.target.type !== "range" && e.target.type !== "checkbox") e.stopPropagation();
  });
  shadow.querySelector(".pre-list").addEventListener("change", (e) => {
    configPick = e.target.value;
    syncConfigs(shadow);
  });
  shadow.querySelector(".pre-name").addEventListener("keydown", (e) => {
    if (e.key === "Enter") onConfigAction("save", shadow);
  });
  shadow.querySelector(".pre-file").addEventListener("change", (e) => onConfigFile(e.target));
  shadow.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => onConfigAction(b.dataset.act, shadow)));
  shadow.querySelectorAll("[data-up]").forEach((b) => b.addEventListener("click", () => onUpdateAction(b.dataset.up, shadow)));
  shadow.querySelectorAll(".op").forEach(setupOpeningInput);
  shadow.querySelector(".reset").addEventListener("click", () => {
    const keep = { enabled: settings.enabled, presets: settings.presets };
    settings = { ...JSON.parse(JSON.stringify(DEFAULTS)), ...keep };
    if (settings.enabled) sendEngineChoice();
    lastKey = null;
    rerender();
    syncPanel();
    loadUciOptions();
    save();
  });
  syncPanel();
  refreshEngineInfo();
  loadUciOptions();
  refreshUpdate(false);
}

// Opening input with its own short suggestion list.
let openingNames = null;
async function loadOpeningNames() {
  if (openingNames) return openingNames;
  try {
    const names = await browser.runtime.sendMessage({ type: "openings" });
    if (Array.isArray(names)) openingNames = ["Any book line", "Gambits", ...names];
  } catch (e) {}
  return openingNames || ["Any book line", "Gambits"];
}

function setupOpeningInput(wrap) {
  const input = wrap.querySelector("input");
  const box = wrap.querySelector(".sugg");
  let items = [];
  let at = -1;
  const pick = (name) => {
    input.value = name;
    box.hidden = true;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.blur();
  };
  const show = async () => {
    const q = input.value.trim().toLowerCase();
    const names = await loadOpeningNames();
    const starts = names.filter((n) => n.toLowerCase().startsWith(q));
    const has = q ? names.filter((n) => !n.toLowerCase().startsWith(q) && n.toLowerCase().includes(q)) : [];
    items = [...starts, ...has].slice(0, 8);
    at = -1;
    box.innerHTML = items.map((n) => `<button type="button" tabindex="-1" title="${esc(n)}">${esc(n)}</button>`).join("");
    box.hidden = !items.length || document.activeElement !== input && wrap.getRootNode().activeElement !== input;
  };
  const mark = () => box.querySelectorAll("button").forEach((b, i) => b.classList.toggle("on", i === at));
  input.addEventListener("focus", show);
  input.addEventListener("input", show);
  input.addEventListener("blur", () => setTimeout(() => (box.hidden = true), 120));
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!items.length) return;
      at = (at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      mark();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (at >= 0) pick(items[at]);
      else {
        box.hidden = true;
        input.blur();
      }
    } else if (e.key === "Escape") {
      box.hidden = true;
      input.blur();
    }
  });
  box.addEventListener("mousedown", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    e.preventDefault();
    pick(b.textContent);
  });
}

// Engine options: every option the chosen engine reports, with the user's own values.
async function loadUciOptions() {
  const r = root();
  const box = r?.querySelector(".uci");
  if (!box) return;
  const model = settings.model;
  let list = null;
  try {
    list = await browser.runtime.sendMessage({ type: "options", model });
  } catch (e) {}
  if (settings.model !== model) return;
  const mine = (settings.uci || {})[model] || {};
  const name = (MODEL_OPTIONS.find(([v]) => v === model) || [, model])[1];
  if (!Array.isArray(list) || !list.length) {
    box.innerHTML = `<div class="note">${esc(name)}: its options appear here after it has started once (switch StockCrab on with this model).</div>`;
    box.dataset.model = model;
    return;
  }
  const rows = list.map((o) => {
    const v = o.name in mine ? mine[o.name] : o.def;
    const changed = o.name in mine ? " changed" : "";
    const attr = `data-uci="${esc(o.name)}"`;
    if (o.type === "check") {
      return `<label class="chk${changed}"><input type="checkbox" ${attr}${String(v) === "true" ? " checked" : ""}><span>${esc(o.name)}</span></label>`;
    }
    if (o.type === "spin") {
      return `<label class="sel${changed}"><span title="${esc(o.name)}">${esc(o.name)}</span><input class="field num" type="number" ${attr} min="${o.min ?? ""}" max="${o.max ?? ""}" value="${esc(v)}"></label>`;
    }
    if (o.type === "combo") {
      const opts = o.vars.map((x) => `<option${x === String(v) ? " selected" : ""}>${esc(x)}</option>`).join("");
      return `<label class="sel${changed}"><span title="${esc(o.name)}">${esc(o.name)}</span><select ${attr}>${opts}</select></label>`;
    }
    return `<label class="sel${changed}"><span title="${esc(o.name)}">${esc(o.name)}</span><input class="field txt" ${attr} value="${esc(v)}" spellcheck="false"></label>`;
  });
  box.innerHTML = `<div class="note">All options ${esc(name)} offers. Changed ones are in bold; the panel's own controls set the rest (strength, hash, lines).</div>${rows.join("")}<button class="btn" data-uci-reset>Reset these options</button>`;
  box.dataset.model = model;
  box.querySelector("[data-uci-reset]").addEventListener("click", () => {
    const { [model]: gone, ...rest } = settings.uci || {};
    settings.uci = rest;
    lastKey = null;
    save();
    loadUciOptions();
  });
  box.list = list;
}

function onUciControl(e) {
  const el = e.target;
  const box = el.closest(".uci");
  const o = (box.list || []).find((x) => x.name === el.dataset.uci);
  if (!o || (e.type === "input" && el.type !== "number")) return;
  let v;
  if (o.type === "check") v = el.checked;
  else if (o.type === "spin") {
    if (el.value === "" || !Number.isFinite(Number(el.value))) return;
    v = Math.round(Number(el.value));
    if (Number.isFinite(o.min)) v = Math.max(o.min, v);
    if (Number.isFinite(o.max)) v = Math.min(o.max, v);
    if (e.type === "change") el.value = v;
  } else v = el.value;
  const model = box.dataset.model;
  const mine = { ...((settings.uci || {})[model] || {}) };
  if (String(v) === String(o.def)) delete mine[o.name];
  else mine[o.name] = v;
  settings.uci = { ...(settings.uci || {}), [model]: mine };
  if (!Object.keys(mine).length) delete settings.uci[model];
  el.closest("label").classList.toggle("changed", o.name in mine);
  lastKey = null;
  save();
}

// Update row: this version, the latest release, and a way to get it.
let updateInfo = null;
async function refreshUpdate(force) {
  const r = root();
  if (!r) return;
  const text = r.querySelector(".upd-text");
  const install = r.querySelector("[data-up=install]");
  const version = browser.runtime.getManifest().version;
  if (!force && !settings.checkUpdates) {
    text.innerHTML = `Version <b>${esc(version)}</b>`;
    install.hidden = true;
    return;
  }
  if (force) text.textContent = "Checking…";
  try {
    updateInfo = await browser.runtime.sendMessage({ type: "update", force, version });
  } catch (e) {
    updateInfo = null;
  }
  if (!updateInfo) text.innerHTML = `Version <b>${esc(version)}</b>`;
  else if (updateInfo.available) text.innerHTML = `<b>${esc(updateInfo.latest)}</b> is out (you have ${esc(version)})`;
  else if (updateInfo.error && !updateInfo.latest) text.innerHTML = `Version <b>${esc(version)}</b> · could not check`;
  else text.innerHTML = `Version <b>${esc(version)}</b>${updateInfo.latest ? " · up to date" : ""}`;
  install.hidden = !updateInfo?.available;
}

async function onUpdateAction(act, shadow) {
  const msg = shadow.querySelector(".upd-msg");
  if (act === "check") return refreshUpdate(true);
  msg.textContent = "Updating…";
  let r = null;
  try {
    r = await browser.runtime.sendMessage({ type: "install-update" });
  } catch (e) {}
  if (r && r.ok) {
    msg.textContent = "Installing the update, StockCrab restarts in a moment";
    return;
  }
  msg.textContent = "Download the new version from the release page and install it";
  window.open((r && r.url) || updateInfo?.url || "https://github.com/upidddd/stockcrab/releases/latest", "_blank", "noopener");
}

function syncPanel() {
  const r = root();
  if (!r) return;
  r.host.style.setProperty("--accent", /^#[0-9a-f]{6}$/i.test(settings.accent) ? settings.accent : DEFAULTS.accent);
  const box = r.querySelector(".box");
  box.className = `box c-${settings.corner} theme-${settings.theme || "auto"}` + (settings.enabled ? "" : " off") +
    (settings.collapsed ? " collapsed" : "") + (settings.showList ? "" : " no-list") + (settings.animate ? " anim" : "");
  r.querySelector(".fold").textContent = settings.collapsed ? "▸" : "▾";
  r.querySelector(".on").checked = settings.enabled;
  r.querySelectorAll("details").forEach((d) => {
    const open = !!settings.sections[d.dataset.section];
    if (d.open !== open) d.open = open;
  });
  for (const c of CONTROLS) {
    const wrap = r.querySelector(`[data-ctl="${c.key}"]`);
    if (wrap) wrap.hidden = c.when ? !c.when(settings) : false;
    if (typeof c.label === "function") r.querySelector(`[data-l="${c.key}"]`).textContent = c.label(settings);
    const el = r.querySelector(`[data-key="${c.key}"]`);
    if (!el) continue;
    if (c.type === "check") el.checked = !!settings[c.key];
    else if (el !== r.activeElement || c.type !== "opening") el.value = settings[c.key] ?? "";
    if (c.type === "range") {
      r.querySelector(`[data-v="${c.key}"]`).textContent = c.fmt(settings[c.key]);
      el.style.setProperty("--p", ((settings[c.key] - c.min) / (c.max - c.min)) * 100 + "%");
    }
  }
  syncConfigs(r);
  syncHud(r);
}

function syncConfigs(r) {
  const list = r.querySelector(".pre-list");
  if (!list) return;
  const mine = Object.keys(settings.presets || {});
  if (!mine.includes(configPick)) configPick = mine[0] || "";
  const html = mine.length ? mine.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join("") : `<option value="">No configs yet</option>`;
  if (list.dataset.html !== html) {
    list.innerHTML = html;
    list.dataset.html = html;
  }
  list.value = configPick;
  list.disabled = !mine.length;
  r.querySelector("[data-act=apply]").disabled = !mine.length;
  r.querySelector("[data-act=delete]").disabled = !mine.length;
}

// HUD rows: every feature that is switched on, as [name, value].
function hudRows(s) {
  const optText = (key) => {
    const c = CONTROLS.find((x) => x.key === key);
    return (c.opts.find(([v]) => v === s[key]) || [, s[key]])[1];
  };
  const [model, build] = optText("model").split(" · ");
  const rows = [[model.replace(/\s+/g, ""), build ? build.replace(/^\w/, (c) => c.toUpperCase()) : ""]];
  if (searching(s)) {
    rows.push(["Strength", s.strengthBy === "skill" ? `Skill ${s.skill}` : s.elo >= 3190 ? "Max" : `${s.elo} Elo`]);
    if (modelInfo(s).quick) rows.push(["Depth", String(s.quickDepth)]);
    else {
      rows.push(["ThinkTime", (s.movetime / 1000).toFixed(1) + "s"]);
      if (s.depth) rows.push(["MaxDepth", String(s.depth)]);
      if (s.nodes) rows.push(["MaxNodes", nodesText(s.nodes)]);
    }
    if (s.aggression) rows.push(["Aggression", s.aggression + "%"]);
    if (s.premove) rows.push(["Premove", { smart: "Smart", likely: "Likely", safe: "Safe" }[s.premoveMode] || s.premoveMode]);
    if (s.useNnue === false && modelInfo(s).nnue) rows.push(["ClassicalEval", ""]);
  } else rows.push(["Players", String(s.maiaRating)]);
  const own = Object.keys((s.uci || {})[s.model] || {}).length;
  if (own) rows.push(["EngineOptions", String(own)]);
  if (s.others) rows.push(["OtherMoves", String(s.others)]);
  if (s.showWdl) rows.push(["WinDrawLoss", ""]);
  if (s.openingWhite) rows.push(["WhiteOpening", s.openingWhite]);
  if (s.openingBlack) rows.push(["BlackOpening", s.openingBlack]);
  if (s.flowColours !== "off") rows.push(["FlowColours", s.flowColours === "duo" ? "Duo" : "Crab"]);
  if (s.blur) rows.push(["Blur", s.blur + "px"]);
  if (s.cursorTrail) rows.push(["CursorTrail", ""]);
  if (s.hotkey) rows.push(["Hotkey", "Alt+X"]);
  return rows;
}

function syncHud(r) {
  const hud = r.querySelector(".hud");
  if (!hud) return;
  hud.hidden = !settings.showHud || !settings.enabled;
  if (hud.hidden) return;
  const corner = settings.hudCorner || "tl";
  hud.className = `hud h-${corner}` + (corner === settings.corner && !settings.collapsed ? " beside" : "") + (settings.animate ? "" : " still");
  const html = hudRows(settings).map(([k, v]) => `<div class="hl">${esc(k)}${v ? `<span>[${esc(v)}]</span>` : ""}</div>`).join("");
  if (hud.dataset.html === html) return;
  hud.innerHTML = html;
  hud.dataset.html = html;
  // widest line first, the colour wave runs down the list
  const lines = [...hud.children].map((el) => [el, el.getBoundingClientRect().width]).sort((a, b) => b[1] - a[1]);
  lines.forEach(([el], i) => {
    el.style.animationDelay = (-i * 0.16).toFixed(2) + "s";
    hud.appendChild(el);
  });
}

function sendEngineChoice() {
  try {
    browser.runtime.sendMessage({ type: "engine", which: settings.model }).catch(() => {});
  } catch (e) {}
}

function setEnabled(on) {
  settings.enabled = on;
  if (!on) {
    clearMarks(true);
    current = null;
    lastView = null;
    listMoves([]);
  }
  setStatus("");
  lastKey = null;
  if (on) sendEngineChoice();
  refreshEngineInfo();
  syncPanel();
  if (on) setTimeout(loadUciOptions, 4000);
  save();
}
