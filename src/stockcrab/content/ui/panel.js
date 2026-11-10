// Settings panel.

const MODEL_OPTIONS = [
  ["sf19-full", "Stockfish 19 · Full"],
  ["sf19-lite", "Stockfish 19 · Lite"],
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
  "sf17-full": { elo: [1320, 3190] },
  "sf17-lite": { elo: [1320, 3190] },
  "sf11": { elo: [1320, 3190], noWdl: true, maxHash: 64 },
  "sf19-asm": { elo: [1320, 3190], maxHash: 32 },
  "fairy": { elo: [500, 2850], nnue: true },
  "maia3": { maia: true },
};
const modelInfo = (s = settings) => MODEL_INFO[s.model] || {};
const searching = (s) => !modelInfo(s).maia;

function eloText(v) {
  if (v >= 3190) return "max";
  const [lo, hi] = modelInfo().elo || [500, 3190];
  return v < lo ? `${lo} (lowest)` : v > hi ? `${hi} (highest)` : v;
}
const nodesText = (v) => (!v ? "off" : v < 1000 ? v + "k" : (v / 1000).toFixed(v % 1000 ? 2 : 0) + "M");

const SECTIONS = [
  ["presets", "Presets", [{ key: "_presets", type: "presets" }]],
  ["engine", "Engine", [
    { key: "model", type: "select", label: "Model", opts: MODEL_OPTIONS, fx: "engine" },
    { key: "_maiaNote", type: "note", text: "Maia does not calculate: it suggests the moves people of this rating play most.", when: (s) => !searching(s) },
    { key: "maiaRating", type: "range", label: "Players' rating", min: 600, max: 2600, step: 50, fmt: (v) => v, fx: "query", when: (s) => !searching(s) },
    { key: "maiaOppo", type: "range", label: "Opponent's rating", min: 500, max: 2600, step: 50, fmt: (v) => (v <= 500 ? "same" : v), fx: "query", when: (s) => !searching(s) },
    { key: "maiaShow", type: "select", label: "Card shows", opts: [["share", "Share of players"], ["score", "Score"]], fx: "render", when: (s) => !searching(s) },
    { key: "strengthBy", type: "select", label: "Strength by", opts: [["elo", "Elo"], ["skill", "Skill level"]], fx: "query", when: searching },
    { key: "elo", type: "range", label: "Strength (Elo)", min: 500, max: 3190, step: 10, fmt: eloText, fx: "query", when: (s) => searching(s) && s.strengthBy !== "skill" },
    { key: "skill", type: "range", label: "Skill level", min: 0, max: 20, step: 1, fmt: (v) => (v >= 20 ? "20 (max)" : v), fx: "query", when: (s) => searching(s) && s.strengthBy === "skill" },
    { key: "movetime", type: "range", label: "Think time", min: 500, max: 30000, step: 500, fmt: (v) => (v / 1000).toFixed(1) + " s", fx: "query", when: searching },
    { key: "depth", type: "range", label: "Max depth (0 = off)", min: 0, max: 40, step: 1, fmt: (v) => (v ? v : "off"), fx: "query", when: searching },
    { key: "nodes", type: "range", label: "Max nodes (0 = off)", min: 0, max: 5000, step: 50, fmt: nodesText, fx: "query", when: searching },
    { key: "aggression", type: "range", label: "Aggression (costs strength)", min: 0, max: 100, step: 10, fmt: (v) => v + "%", fx: "query", when: searching },
    { key: "hash", type: "range", label: "Hash memory", min: 16, max: 256, step: 16, fmt: (v) => Math.min(v, modelInfo().maxHash || 256) + " MB", fx: "query", when: searching },
    { key: "useNnue", type: "check", label: "NNUE evaluation (off = classical)", fx: "query", when: (s) => !!modelInfo(s).nnue },
    { key: "showWdl", type: "check", label: "Show win / draw / loss", fx: "query", when: (s) => !modelInfo(s).noWdl },
  ]],
  ["moves", "Moves", [
    { key: "others", type: "range", label: (s) => (searching(s) ? "Other good moves (0 = strongest)" : "Other popular moves"), min: 0, max: 3, step: 1, fmt: (v) => v, fx: "query" },
    { key: "goodWithin", type: "range", label: "“Good” = at most this far behind", min: 10, max: 150, step: 10, fmt: (v) => v + " cp", fx: "render", when: searching },
    { key: "maiaMinShare", type: "range", label: "Played by at least", min: 1, max: 30, step: 1, fmt: (v) => v + "%", fx: "render", when: (s) => !searching(s) },
    { key: "scoreUnits", type: "select", label: "Scores as", opts: [["pawns", "Pawns (+0.35)"], ["cp", "Centipawns (+35)"], ["win", "Win chance (62%)"]], fx: "render" },
    { key: "showList", type: "check", label: "Show the move list below", fx: "panel" },
  ]],
  ["premove", "Premove", [
    { key: "_premoveNote", type: "note", text: "Premoves need a model that calculates (Stockfish or Fairy-Stockfish).", when: (s) => !searching(s) },
    { key: "premove", type: "check", label: "Show a premove", fx: "query" },
    { key: "premoveMode", type: "select", label: "Style", opts: [["smart", "When it's worth it"], ["likely", "Always, just in case"], ["safe", "Only if it's safe"]], fx: "query" },
    { key: "obviousLead", type: "range", label: "Worth it: their best move leads by", min: 20, max: 400, step: 20, fmt: (v) => v + " cp", fx: "query" },
    { key: "replyGap", type: "range", label: "Worth it: your reply leads by", min: 5, max: 100, step: 5, fmt: (v) => v + " cp", fx: "query" },
    { key: "pawnTrade", type: "check", label: "Premove pawn retakes", fx: "query" },
    { key: "tradeTolerance", type: "range", label: "Skip the retake if it is worse by", min: 20, max: 300, step: 20, fmt: (v) => v + " cp", fx: "query" },
    { key: "likelyCount", type: "range", label: "Likely opponent moves checked", min: 1, max: 8, step: 1, fmt: (v) => v, fx: "query" },
    { key: "likelyWithin", type: "range", label: "“Likely” = within", min: 20, max: 300, step: 20, fmt: (v) => v + " cp", fx: "query" },
    { key: "safeGap", type: "range", label: "“Safe”: your reply leads by", min: 5, max: 100, step: 5, fmt: (v) => v + " cp", fx: "query" },
    { key: "premovePer", type: "range", label: "Check time per opponent move", min: 80, max: 600, step: 20, fmt: (v) => v + " ms", fx: "query" },
  ]],
  ["look", "Look", [
    { key: "colourBest", type: "color", label: "Best move colour", fx: "render" },
    { key: "colourAlt", type: "color", label: "Other moves colour", fx: "render" },
    { key: "colourPremove", type: "color", label: "Premove colour", fx: "render" },
    { key: "colourOutline", type: "color", label: "Square outline colour (moves)", fx: "render" },
    { key: "lineWidth", type: "range", label: "Line width", min: 50, max: 200, step: 10, fmt: (v) => v + "%", fx: "render" },
    { key: "opacity", type: "range", label: "Opacity", min: 30, max: 100, step: 5, fmt: (v) => v + "%", fx: "render" },
    { key: "blur", type: "range", label: "Blur under the hints", min: 0, max: 12, step: 1, fmt: (v) => (v ? v + " px" : "off"), fx: "render" },
    { key: "showOutline", type: "check", label: "Outline the squares", fx: "render" },
    { key: "showHead", type: "check", label: "Arrow head", fx: "render" },
    { key: "showLabels", type: "check", label: "Score on the board", fx: "render" },
    { key: "showSquare", type: "check", label: "Cell name in the card", fx: "render" },
    { key: "animate", type: "check", label: "Animate new hints", fx: "panel" },
    { key: "flowColours", type: "select", label: "Flowing colours", opts: [["crab", "Crab (orange · red)"], ["duo", "Orange · cyan"], ["off", "Off"]], fx: "render" },
  ]],
  ["panel", "Panel", [
    { key: "corner", type: "select", label: "Position", opts: [["br", "Bottom right"], ["bl", "Bottom left"], ["tr", "Top right"], ["tl", "Top left"]], fx: "panel" },
    { key: "side", type: "select", label: "I play", opts: [["auto", "Auto-detect"], ["w", "White"], ["b", "Black"], ["turn", "Whoever is to move"]], fx: "query" },
    { key: "hotkey", type: "check", label: "Alt+X turns StockCrab on/off", fx: "panel" },
  ]],
];
for (const c of SECTIONS.find(([id]) => id === "premove")[2]) c.when ??= searching;
const CONTROLS = SECTIONS.flatMap(([, , list]) => list);
const QUERY_KEYS = CONTROLS.filter((c) => c.fx === "query" || c.fx === "engine").map((c) => c.key);

// Presets: the settings of the Engine, Moves, Premove and Look sections.
const PRESET_KEYS = SECTIONS.filter(([id]) => ["engine", "moves", "premove", "look"].includes(id))
  .flatMap(([, , list]) => list)
  .filter((c) => !c.key.startsWith("_"))
  .map((c) => c.key);
const BUILTIN_PRESETS = {
  "Default": null,
  "Deep analysis": { model: "sf19-full", strengthBy: "elo", elo: 3190, movetime: 15000, depth: 0, nodes: 0, others: 3, goodWithin: 60, showWdl: true, premove: false },
  "Quick hints": { model: "sf19-lite", strengthBy: "elo", elo: 3190, movetime: 1000, depth: 0, nodes: 0, others: 1 },
  "Club player · 1600": { model: "sf19-full", strengthBy: "elo", elo: 1600, movetime: 2000, depth: 0, nodes: 0, others: 0 },
  "Human moves · Maia 1500": { model: "maia3", maiaRating: 1500, maiaOppo: 500, maiaShow: "score", maiaMinShare: 5, others: 2 },
  "Human moves · Maia 2200": { model: "maia3", maiaRating: 2200, maiaOppo: 500, maiaShow: "score", maiaMinShare: 5, others: 2 },
  "Fairy-Stockfish": { model: "fairy", useNnue: true, strengthBy: "elo", elo: 3190, movetime: 4000, depth: 0, nodes: 0 },
  "Clean look": { others: 0, showOutline: false, showLabels: true, showSquare: false, blur: 0, opacity: 80, flowColours: "off" },
};
let presetPick = "Default";

const presetValues = (name) =>
  name in BUILTIN_PRESETS ? BUILTIN_PRESETS[name] || pickKeys(DEFAULTS) : settings.presets[name] || null;

function pickKeys(obj) {
  const out = {};
  for (const k of PRESET_KEYS) if (k in obj) out[k] = obj[k];
  return out;
}

// Only known keys with values a control accepts.
function cleanPreset(values) {
  const out = {};
  for (const c of CONTROLS) {
    if (!PRESET_KEYS.includes(c.key) || !(c.key in values)) continue;
    const v = values[c.key];
    if (c.type === "range" && Number.isFinite(v)) out[c.key] = Math.min(c.max, Math.max(c.min, v));
    else if (c.type === "check" && typeof v === "boolean") out[c.key] = v;
    else if (c.type === "select" && c.opts.some(([o]) => o === v)) out[c.key] = v;
    else if (c.type === "color" && /^#[0-9a-f]{6}$/i.test(v)) out[c.key] = v;
  }
  return out;
}

function applyPreset(values) {
  const model = settings.model;
  Object.assign(settings, cleanPreset(values));
  if (settings.model !== model) sendEngineChoice();
  rerender();
  syncPanel();
  save();
}

function presetMessage(text) {
  const el = root()?.querySelector(".pre-msg");
  if (!el) return;
  el.textContent = text;
  clearTimeout(presetMessage.timer);
  presetMessage.timer = setTimeout(() => (el.textContent = ""), 2500);
}

function onPresetAction(act, shadow) {
  const name = shadow.querySelector(".pre-name");
  if (act === "apply") {
    const values = presetValues(presetPick);
    if (!values) return;
    applyPreset(values);
    presetMessage(`Applied “${presetPick}”`);
  } else if (act === "save") {
    const n = name.value.trim().slice(0, 40);
    if (!n) return presetMessage("Type a name first");
    if (n in BUILTIN_PRESETS) return presetMessage("That name is taken by a built-in preset");
    settings.presets = { ...settings.presets, [n]: pickKeys(settings) };
    presetPick = n;
    name.value = "";
    syncPanel();
    save();
    presetMessage(`Saved “${n}”`);
  } else if (act === "delete") {
    if (!(presetPick in settings.presets)) return presetMessage("Built-in presets cannot be deleted");
    const { [presetPick]: gone, ...rest } = settings.presets;
    settings.presets = rest;
    presetMessage(`Deleted “${presetPick}”`);
    presetPick = "Default";
    syncPanel();
    save();
  } else if (act === "export") {
    const text = JSON.stringify({ stockcrab: 1, name: presetPick, settings: presetValues(presetPick) || pickKeys(settings) });
    copyText(text).then(() => presetMessage("Preset copied"));
  } else if (act === "import") {
    const text = prompt("Paste a StockCrab preset");
    if (!text) return;
    try {
      const data = JSON.parse(text);
      const values = cleanPreset(data.settings || data);
      if (!Object.keys(values).length) throw new Error("no settings");
      let n = String(data.name || "Imported").slice(0, 40);
      while (n in BUILTIN_PRESETS || n in settings.presets) n += " (2)";
      settings.presets = { ...settings.presets, [n]: values };
      presetPick = n;
      syncPanel();
      save();
      presetMessage(`Added “${n}”, press Apply`);
    } catch (e) {
      presetMessage("That is not a StockCrab preset");
    }
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
  :host { all: initial; color-scheme: light dark; }
  * { box-sizing: border-box; }
  .box {
    --bg: #ffffff; --fg: #22252a; --muted: #6b7280; --line: #e4e6ea; --soft: #f3f4f6; --accent: #e4572e;
    position: fixed; z-index: 99999; width: 262px; padding: 10px 12px 10px;
    max-height: calc(100vh - 24px); overflow-y: auto;
    background: var(--bg); color: var(--fg); border: 1px solid var(--line); border-radius: 10px;
    box-shadow: 0 6px 22px rgba(0, 0, 0, .2);
    font: 12.5px/1.35 "Inter", "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-variant-numeric: tabular-nums; -webkit-font-smoothing: antialiased;
  }
  @media (prefers-color-scheme: dark) {
    .box { --bg: #262421; --fg: #ececec; --muted: #9d9a95; --line: #3b3835; --soft: #312e2b; box-shadow: 0 8px 28px rgba(0, 0, 0, .5); }
  }
  .c-br { right: 12px; bottom: 12px; } .c-bl { left: 12px; bottom: 12px; }
  .c-tr { right: 12px; top: 12px; } .c-tl { left: 12px; top: 12px; }

  .head { display: flex; align-items: center; gap: 8px; }
  .logo { display: flex; flex: none; } .logo svg { width: 24px; height: 24px; }
  .name { flex: 1; min-width: 0; }
  .title { font-size: 14px; font-weight: 700; letter-spacing: -.01em; line-height: 1.2; }
  .sub { font-size: 10.5px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sw { position: relative; width: 34px; height: 20px; flex: none; }
  .sw input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; z-index: 1; }
  .sw i { position: absolute; inset: 0; border-radius: 99px; background: var(--line); transition: background .15s; }
  .sw i::after { content: ""; position: absolute; top: 3px; left: 3px; width: 14px; height: 14px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0, 0, 0, .3); transition: transform .15s; }
  .sw input:checked + i { background: var(--accent); }
  .sw input:checked + i::after { transform: translateX(14px); }
  .fold { width: 22px; height: 22px; border: 0; border-radius: 6px; background: transparent; color: var(--muted); font-size: 14px; cursor: pointer; padding: 0; }
  .fold:hover { background: var(--soft); }

  .body { margin-top: 6px; }
  details { border-top: 1px solid var(--line); margin-top: 6px; padding-top: 6px; }
  summary { list-style: none; cursor: pointer; display: flex; align-items: center; gap: 8px; padding: 2px 0;
    font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
  summary::-webkit-details-marker { display: none; }
  summary::before { content: ""; width: 6px; height: 6px; border-right: 1.6px solid currentColor; border-bottom: 1.6px solid currentColor; transform: rotate(-45deg); transition: transform .12s; }
  details[open] > summary::before { transform: rotate(45deg); }
  .grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; margin: 8px 0 2px; }
  .lab { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 1px; font-size: 11.5px; color: var(--muted); }
  .lab b { color: var(--fg); font-weight: 600; font-variant-numeric: tabular-nums; }

  input[type=range] { -moz-appearance: none; appearance: none; width: 100%; height: 16px; margin: 0; background: transparent; cursor: pointer; }
  input[type=range]::-moz-range-track { height: 4px; border-radius: 2px; background: var(--line); }
  input[type=range]::-moz-range-progress { height: 4px; border-radius: 2px; background: var(--accent); }
  input[type=range]::-moz-range-thumb { width: 14px; height: 14px; border-radius: 50%; background: #fff; border: 2px solid var(--accent); }
  input[type=range]::-webkit-slider-runnable-track { height: 4px; border-radius: 2px; background: linear-gradient(90deg, var(--accent) var(--p, 50%), var(--line) var(--p, 50%)); }
  input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; margin-top: -5px; border-radius: 50%; background: #fff; border: 2px solid var(--accent); }

  .chk { display: flex; align-items: center; gap: 8px; cursor: pointer; }
  .chk input { width: 14px; height: 14px; margin: 0; accent-color: var(--accent); }
  .sel { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 11.5px; color: var(--muted); }
  .sel select { font: inherit; font-size: 11.5px; color: var(--fg); background: var(--soft); border: 1px solid var(--line); border-radius: 6px; padding: 3px 5px; max-width: 150px; }
  .sel input[type=color] { width: 36px; height: 20px; padding: 0; border: 1px solid var(--line); border-radius: 6px; background: none; cursor: pointer; }
  .reset, .btn { font: inherit; font-size: 12px; color: var(--fg); background: var(--soft); border: 1px solid var(--line); border-radius: 6px; padding: 6px 10px; cursor: pointer; }
  .reset:hover, .btn:hover { border-color: var(--muted); }
  .btn { padding: 3px 9px; font-size: 11.5px; flex: none; }
  .btn.main { background: var(--accent); border-color: var(--accent); color: #fff; }
  .note { font-size: 11px; color: var(--muted); background: var(--soft); border-radius: 6px; padding: 6px 8px; }
  .pre { display: grid; grid-template-columns: minmax(0, 1fr); gap: 6px; }
  .pre .row { display: flex; gap: 6px; align-items: center; }
  .pre select, .pre input { flex: 1; width: 0; min-width: 0; font: inherit; font-size: 11.5px; color: var(--fg); background: var(--soft); border: 1px solid var(--line); border-radius: 6px; padding: 3px 6px; }
  .pre .row.small .btn { flex: 1; }
  .pre-msg { font-size: 11px; color: var(--muted); }
  .pre-msg:empty { display: none; }
  .ctl[hidden] { display: none; }

  .moves { margin-top: 8px; display: grid; gap: 4px; }
  .moves:empty, .no-list .moves { display: none; }
  .mv { display: flex; align-items: center; gap: 8px; padding: 4px 6px 4px 0; border-radius: 7px; background: var(--soft); overflow: hidden; }
  .mv .chip { width: 3px; align-self: stretch; flex: none; }
  .mv .nm { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 6px; }
  .mv .san { font-size: 13.5px; font-weight: 700; letter-spacing: -.01em; }
  .mv .co { font-size: 10px; color: var(--muted); white-space: nowrap; }
  .mv .ic { display: inline-flex; align-self: center; }
  .mv .dt { flex-basis: 100%; font-size: 10px; color: var(--muted); }
  .mv .tag { font-size: 9px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
  .mv .sc { font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 99px; white-space: nowrap; }

  .status { margin-top: 8px; display: flex; align-items: center; gap: 7px; min-height: 16px; font-size: 11.5px; color: var(--muted); }
  .status::before { content: ""; width: 7px; height: 7px; border-radius: 50%; flex: none; background: var(--line); }
  .status[data-kind=ok] { color: var(--fg); } .status[data-kind=ok]::before { background: #2ea043; }
  .status[data-kind=busy]::before { background: var(--accent); }
  .status[data-kind=err] { color: #d1242f; } .status[data-kind=err]::before { background: #d1242f; }
  .off .body, .off .status, .off .moves, .collapsed .body { display: none; }
  @media (max-width: 640px) { .box { left: 8px !important; right: 8px !important; width: auto; max-height: 60vh; } }
`;

function controlHtml(c) {
  return `<div class="ctl" data-ctl="${c.key}">${controlInner(c)}</div>`;
}

function controlInner(c) {
  if (c.type === "range") {
    return `<div class="lab"><span data-l="${c.key}">${typeof c.label === "function" ? c.label(settings) : c.label}</span><b data-v="${c.key}"></b></div>
      <input type="range" data-key="${c.key}" min="${c.min}" max="${c.max}" step="${c.step}">`;
  }
  if (c.type === "check") return `<label class="chk"><input type="checkbox" data-key="${c.key}"> ${c.label}</label>`;
  if (c.type === "select") {
    const opts = c.opts.map(([v, t]) => `<option value="${v}">${t}</option>`).join("");
    return `<label class="sel"><span>${c.label}</span><select data-key="${c.key}">${opts}</select></label>`;
  }
  if (c.type === "note") return `<div class="note">${c.text}</div>`;
  if (c.type === "presets") {
    return `<div class="pre">
      <div class="row"><select class="pre-list"></select><button class="btn main" data-act="apply">Apply</button></div>
      <div class="row"><input class="pre-name" maxlength="40" placeholder="Preset name"><button class="btn" data-act="save">Save</button></div>
      <div class="row small"><button class="btn" data-act="delete">Delete</button><button class="btn" data-act="export">Copy</button><button class="btn" data-act="import">Paste…</button></div>
      <div class="pre-msg"></div>
    </div>`;
  }
  return `<label class="sel"><span>${c.label}</span><input type="color" data-key="${c.key}"></label>`;
}

function mountPanel() {
  if (document.getElementById(PANEL_ID)) return;
  const host = document.createElement("div");
  host.id = PANEL_ID;
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
    </div>`;
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
      settings.sections[d.dataset.section] = d.open;
      save();
    }),
  );
  const onControl = (e) => {
    const el = e.target.closest("[data-key]");
    if (!el) return;
    const c = CONTROLS.find((x) => x.key === el.dataset.key);
    if (!c) return;
    if ((e.type === "input") !== (c.type === "range" || c.type === "color")) return;
    settings[c.key] = c.type === "range" ? Number(el.value) : c.type === "check" ? el.checked : el.value;
    if (c.fx === "engine") sendEngineChoice();
    if (c.fx === "render") rerender();
    syncPanel();
    save();
  };
  shadow.addEventListener("input", onControl);
  shadow.addEventListener("change", onControl);
  shadow.querySelector(".pre-list").addEventListener("change", (e) => (presetPick = e.target.value));
  shadow.querySelector(".pre-name").addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") onPresetAction("save", shadow);
  });
  shadow.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => onPresetAction(b.dataset.act, shadow)));
  shadow.querySelector(".reset").addEventListener("click", () => {
    const keep = { enabled: settings.enabled, presets: settings.presets };
    settings = { ...JSON.parse(JSON.stringify(DEFAULTS)), ...keep };
    sendEngineChoice();
    rerender();
    syncPanel();
    save();
  });
  syncPanel();
  refreshEngineInfo();
}

function syncPanel() {
  const r = root();
  if (!r) return;
  const box = r.querySelector(".box");
  box.className = `box c-${settings.corner}` + (settings.enabled ? "" : " off") + (settings.collapsed ? " collapsed" : "") + (settings.showList ? "" : " no-list");
  r.querySelector(".fold").textContent = settings.collapsed ? "▸" : "▾";
  r.querySelector(".on").checked = settings.enabled;
  r.querySelectorAll("details").forEach((d) => {
    d.open = !!settings.sections[d.dataset.section];
  });
  for (const c of CONTROLS) {
    const wrap = r.querySelector(`[data-ctl="${c.key}"]`);
    if (wrap) wrap.hidden = c.when ? !c.when(settings) : false;
    if (typeof c.label === "function") r.querySelector(`[data-l="${c.key}"]`).textContent = c.label(settings);
    const el = r.querySelector(`[data-key="${c.key}"]`);
    if (!el) continue;
    if (c.type === "check") el.checked = settings[c.key];
    else el.value = settings[c.key];
    if (c.type === "range") {
      r.querySelector(`[data-v="${c.key}"]`).textContent = c.fmt(settings[c.key]);
      el.style.setProperty("--p", ((settings[c.key] - c.min) / (c.max - c.min)) * 100 + "%");
    }
  }
  syncPresets(r);
}

function syncPresets(r) {
  const list = r.querySelector(".pre-list");
  if (!list) return;
  const mine = Object.keys(settings.presets || {});
  if (!(presetPick in BUILTIN_PRESETS) && !mine.includes(presetPick)) presetPick = "Default";
  const opt = (n) => `<option value="${n.replace(/"/g, "&quot;")}">${n.replace(/</g, "&lt;")}</option>`;
  const html = `<optgroup label="Built-in">${Object.keys(BUILTIN_PRESETS).map(opt).join("")}</optgroup>` +
    (mine.length ? `<optgroup label="Mine">${mine.map(opt).join("")}</optgroup>` : "");
  if (list.dataset.html !== html) {
    list.innerHTML = html;
    list.dataset.html = html;
  }
  list.value = presetPick;
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
  save();
}
