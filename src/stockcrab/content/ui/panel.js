// Settings panel and HUD.

const MOBILE_MODELS = ["stockcrab-v1", "sf19-lite", "sf19-quick", "sf19-asm"]; // the light build ships only these
const MODEL_OPTIONS = [
  ["stockcrab-v1", "StockCrab v1"],
  ["sf19-full", "Stockfish 19 · Full"],
  ["sf19-lite", "Stockfish 19 · Lite"],
  ["sf19-quick", "Stockfish 19 · Quick"],
  ["sf11", "Stockfish 11 · Classic"],
  ["sf19-asm", "Stockfish 19 · JavaScript"],
  ["fairy", "Fairy-Stockfish"],
  ["maia3", "Maia 3 · human-like"],
].filter(([id]) => !MOBILE || MOBILE_MODELS.includes(id));

// What each model can do; the panel shows only the settings that apply.
const MODEL_INFO = {
  "stockcrab-v1": { elo: [200, 3000], noWdl: true, crab: true },
  "sf19-full": { elo: [1320, 3190] },
  "sf19-lite": { elo: [1320, 3190] },
  "sf19-quick": { elo: [1320, 3190], quick: true },
  "sf11": { elo: [1320, 3190], noWdl: true, maxHash: 64 },
  "sf19-asm": { elo: [1320, 3190], maxHash: 32 },
  "fairy": { elo: [500, 2850], nnue: true },
  "maia3": { maia: true },
};
const modelInfo = (s = settings) => MODEL_INFO[s.model] || {};

// StockCrab v1's characters, as its engine names them
const CHARACTERS = {
  "Balanced": "Plays the position: no favourite plan, no fear.",
  "Angry Crab": "Goes for your king, hates draws, keeps its knights.",
  "Coward": "King safety first, happy with a draw, trades into safety.",
  "Kamikaze": "Everything at the king; material is a detail.",
  "Hoarder": "Grabs material and holds on to it.",
  "Positional": "Slow squeeze: pawn structure and active pieces over adventures.",
};
const searching = (s) => !modelInfo(s).maia;
const timed = (s) => searching(s) && !modelInfo(s).quick;

// each engine's own Elo range: the slider stops where the engine does, and its top is full strength
const eloRange = (s = settings) => modelInfo(s).elo || [1320, 3190];
const eloText = (v) => (v >= eloRange()[1] ? `${v} · full` : `${v}`);

// keeps the Elo inside the current model's range, and each model's own Elo and Skill level
function normalizeStrength(previousModel) {
  if (!settings.eloByModel || typeof settings.eloByModel !== "object") settings.eloByModel = {};
  if (!settings.skillByModel || typeof settings.skillByModel !== "object") settings.skillByModel = {};
  if (previousModel && previousModel !== settings.model) {
    settings.eloByModel[previousModel] = settings.elo;
    settings.skillByModel[previousModel] = settings.skill;
    const [, hi] = eloRange();
    settings.elo = settings.eloByModel[settings.model] ?? hi;
    settings.skill = settings.skillByModel[settings.model] ?? 20;
  }
  const [lo, hi] = eloRange();
  settings.elo = Math.min(hi, Math.max(lo, Number(settings.elo) || hi));
  settings.eloByModel[settings.model] = settings.elo;
  settings.skillByModel[settings.model] = settings.skill;
}
const nodesText = (v) => (!v ? "off" : v < 1000 ? v + "k" : (v / 1000).toFixed(v % 1000 ? 2 : 0) + "M");
const secText = (v) => (v / 1000).toFixed(1) + " s";
const CORNERS = [["tl", "Top left"], ["tr", "Top right"], ["bl", "Bottom left"], ["br", "Bottom right"]];

const SECTIONS = [
  ["configs", "Configs", [{ key: "_configs", type: "configs" }]],
  ["engine", "Engine", [
    { key: "model", type: "modelpick", label: "Model", opts: MODEL_OPTIONS, fx: "engine" },
    { key: "_crabNote", type: "note", text: "StockCrab's own engine: 280 KB, with a character. Every dial (aggression, caution, greed, contempt…) is under Engine options.", when: (s) => !!modelInfo(s).crab },
    { key: "character", type: "select", label: "Character", opts: Object.keys(CHARACTERS).map((k) => [k, k]), fx: "query", when: (s) => !!modelInfo(s).crab },
    { key: "_characterNote", type: "note", text: (s) => CHARACTERS[s.character] || "", when: (s) => !!modelInfo(s).crab },
    { key: "crabTalk", type: "check", label: "The crab comments on the game", fx: "panel", when: (s) => !!modelInfo(s).crab },
    { key: "_maiaNote", type: "note", text: "Maia suggests the moves players of this rating play most.", when: (s) => !searching(s) },
    { key: "maiaRating", type: "range", label: "Players' rating", min: 600, max: 2600, step: 50, fmt: (v) => v, fx: "query", when: (s) => !searching(s) },
    { key: "maiaOppo", type: "range", label: "Opponent's rating", min: 500, max: 2600, step: 50, fmt: (v) => (v <= 500 ? "same" : v), fx: "query", when: (s) => !searching(s) },
    { key: "maiaShow", type: "select", label: "Card shows", opts: [["score", "Score"], ["share", "Share of players"]], fx: "render", when: (s) => !searching(s) },
    { key: "quickDepth", type: "range", label: "Depth", min: 1, max: 20, step: 1, fmt: (v) => v, fx: "query", when: (s) => !!modelInfo(s).quick },
    { key: "strengthBy", type: "select", label: "Strength by", opts: [["elo", "Elo"], ["skill", "Skill level"]], fx: "query", when: (s) => searching(s) && !modelInfo(s).crab },
    { key: "elo", type: "range", label: "Strength (Elo)", min: 200, max: 3800, bounds: eloRange, step: 10, fmt: eloText, fx: "query", when: (s) => searching(s) && (s.strengthBy !== "skill" || !!modelInfo(s).crab) },
    { key: "skill", type: "range", label: "Skill level", min: 0, max: 20, step: 1, fmt: (v) => (v >= 20 ? "20 (max)" : v), fx: "query", when: (s) => searching(s) && s.strengthBy === "skill" && !modelInfo(s).crab },
    { key: "movetime", type: "range", label: "Think time", min: 500, max: 30000, step: 500, fmt: secText, fx: "query", when: timed },
    { key: "depth", type: "range", label: "Max depth", min: 0, max: 40, step: 1, fmt: (v) => (v ? v : "off"), fx: "query", when: timed },
    { key: "nodes", type: "range", label: "Max nodes", min: 0, max: 5000, step: 50, fmt: nodesText, fx: "query", when: timed },
    { key: "aggression", type: "range", label: "Aggression", min: 0, max: 100, step: 10, fmt: (v) => v + "%", fx: "query", when: (s) => searching(s) && !modelInfo(s).crab },
    { key: "hash", type: "range", label: "Hash memory", min: 16, max: 256, step: 16, fmt: (v) => Math.min(v, modelInfo().maxHash || 256) + " MB", fx: "query", when: searching },
    { key: "useNnue", type: "check", label: "NNUE evaluation", fx: "query", when: (s) => !!modelInfo(s).nnue },
    { key: "showWdl", type: "check", label: "Show win / draw / loss", fx: "query", when: (s) => !modelInfo(s).noWdl },
  ]],
  ["uci", "Engine options", [{ key: "_uci", type: "uci" }]],
  ["moves", "Moves", [
    { key: "others", type: "range", label: (s) => (searching(s) ? "Other good moves" : "Other popular moves"), min: 0, max: 3, step: 1, fmt: (v) => (v ? v : "none"), fx: "query" },
    { key: "goodWithin", type: "range", label: "Other moves: at most behind by", min: 10, max: 150, step: 10, fmt: (v) => v + " cp", fx: "render", when: searching },
    { key: "maiaMinShare", type: "range", label: "Played by at least", min: 1, max: 30, step: 1, fmt: (v) => v + "%", fx: "render", when: (s) => !searching(s) },
    { key: "scoreUnits", type: "select", label: "Scores as", opts: [["pawns", "Pawns (+0.35)"], ["cp", "Centipawns (+35)"], ["win", "Win chance (62%)"]], fx: "render" },
    { key: "scoresFor", type: "select", label: "Scores for", opts: [["mover", "Side to move"], ["white", "White"]], fx: "render" },
    { key: "showList", type: "check", label: "Move list in the panel", fx: "panel" },
  ]],
  ["analysis", "Analysis", [
    { key: "evalBar", type: "check", label: "Evaluation bar", fx: "panel" },
    { key: "lineLength", type: "range", label: "Best line in the list", min: 0, max: 10, step: 1, fmt: (v) => (v ? v + " moves" : "off"), fx: "render" },
    { key: "threat", type: "check", label: "Show the opponent's threat", fx: "query", when: searching },
    { key: "colourThreat", type: "color", label: "Threat colour", fx: "render", when: (s) => searching(s) && s.threat },
  ]],
  ["opening", "Opening", [
    { key: "openingWhite", type: "opening", label: "As White", fx: "query" },
    { key: "openingBlack", type: "opening", label: "As Black", fx: "query" },
    { key: "bookMaxLoss", type: "range", label: "Leave the book when worse by", min: 20, max: 500, step: 10, fmt: (v) => (v >= 500 ? "never" : v + " cp"), fx: "query", when: (s) => !!(s.openingWhite || s.openingBlack) },
  ]],
  ["premove", "Premove", [
    { key: "_premoveNote", type: "note", text: "Premoves need Stockfish or Fairy-Stockfish.", when: (s) => !searching(s) },
    { key: "premove", type: "check", label: "Show a premove", fx: "query", when: searching },
    { key: "premoveMode", type: "select", label: "Style", opts: [["smart", "When it's worth it"], ["likely", "Always, just in case"], ["safe", "Only if it's safe"]], fx: "query", when: (s) => searching(s) && s.premove },
    { key: "obviousLead", type: "range", label: "Their best move leads by", min: 20, max: 400, step: 20, fmt: (v) => v + " cp", fx: "query", when: (s) => searching(s) && s.premove && s.premoveMode === "smart" },
    { key: "replyGap", type: "range", label: "Your reply leads by", min: 5, max: 100, step: 5, fmt: (v) => v + " cp", fx: "query", when: (s) => searching(s) && s.premove && s.premoveMode === "smart" },
    { key: "likelyCount", type: "range", label: "Likely opponent moves checked", min: 1, max: 8, step: 1, fmt: (v) => v, fx: "query", when: (s) => searching(s) && s.premove && s.premoveMode !== "safe" },
    { key: "likelyWithin", type: "range", label: "Likely moves: within", min: 20, max: 300, step: 20, fmt: (v) => v + " cp", fx: "query", when: (s) => searching(s) && s.premove && s.premoveMode !== "safe" },
    { key: "safeGap", type: "range", label: "Your reply leads by", min: 5, max: 100, step: 5, fmt: (v) => v + " cp", fx: "query", when: (s) => searching(s) && s.premove && s.premoveMode === "safe" },
    { key: "premovePer", type: "range", label: "Check time per opponent move", min: 80, max: 600, step: 20, fmt: (v) => v + " ms", fx: "query", when: (s) => searching(s) && s.premove },
    { key: "pawnTrade", type: "check", label: "Premove pawn retakes", fx: "query", when: (s) => searching(s) && s.premove },
    { key: "tradeTolerance", type: "range", label: "Skip the retake when worse by", min: 20, max: 300, step: 20, fmt: (v) => v + " cp", fx: "query", when: (s) => searching(s) && s.premove && s.pawnTrade },
  ]],
  ["look", "Look", [
    { key: "theme", type: "select", label: "Panel theme", opts: [["auto", "Like the system"], ["light", "Light"], ["dark", "Dark"]], fx: "panel" },
    { key: "accent", type: "color", label: "Accent colour", fx: "panel" },
    { key: "colourBest", type: "color", label: "Best move colour", fx: "render" },
    { key: "colourAlt", type: "color", label: "Other moves colour", fx: "render" },
    { key: "colourPremove", type: "color", label: "Premove colour", fx: "render" },
    { key: "colourOutline", type: "color", label: "Square outline colour", fx: "render" },
    { key: "lineWidth", type: "range", label: "Line width", min: 50, max: 200, step: 10, fmt: (v) => v + "%", fx: "render" },
    { key: "opacity", type: "range", label: "Opacity", min: 30, max: 100, step: 5, fmt: (v) => v + "%", fx: "render" },
    { key: "hintStyle", type: "select", label: "Hint style", opts: [["flat", "Flat"], ["glossy", "Glossy"]], fx: "render" },
    { key: "glow", type: "range", label: "Glow", min: 0, max: 20, step: 1, fmt: (v) => (v ? v : "off"), fx: "render", when: (s) => s.hintStyle !== "flat" },
    { key: "blur", type: "range", label: "Blur under the hints", min: 0, max: 12, step: 1, fmt: (v) => (v ? v + " px" : "off"), fx: "render", desktop: true },
    { key: "showOutline", type: "check", label: "Outline the squares", fx: "render" },
    { key: "showHead", type: "check", label: "Arrow head", fx: "render" },
    { key: "showLabels", type: "check", label: "Score on the board", fx: "render" },
    { key: "animate", type: "check", label: "Animations", fx: "panel" },
    { key: "cursorTrail", type: "check", label: "Cursor trail", fx: "panel", desktop: true },
    { key: "crabCursor", type: "check", label: "Crab cursor with StockCrab v1", fx: "panel", desktop: true, when: (s) => !!modelInfo(s).crab },
  ]],
  ["panel", "Panel", [
    { key: "corner", type: "select", label: "Position", opts: CORNERS, fx: "panel", desktop: true },
    { key: "side", type: "select", label: "I play", opts: [["auto", "Auto-detect"], ["w", "White"], ["b", "Black"], ["turn", "Whoever is to move"]], fx: "query" },
    { key: "hotkey", type: "check", label: "Alt+X turns it on and off", fx: "panel", desktop: true },
    { key: "showHud", type: "check", label: "HUD", fx: "panel", desktop: true },
    { key: "hudCorner", type: "select", label: "HUD position", opts: CORNERS, fx: "panel", when: (s) => s.showHud, desktop: true },
    { key: "checkUpdates", type: "check", label: "Check for updates", fx: "panel" },
    { key: "panelIcon", type: "icon", label: "Panel icon" },
    { key: "_update", type: "update" },
  ]],
];
// the light build leaves out what a phone has no use for
if (MOBILE) for (const sec of SECTIONS) sec[2] = sec[2].filter((c) => !c.desktop);
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
    else if ((c.type === "select" || c.type === "modelpick") && c.opts.some(([o]) => o === v)) out[c.key] = v;
    else if (c.type === "color" && /^#[0-9a-f]{6}$/i.test(v)) out[c.key] = v;
    else if (c.type === "opening" && typeof v === "string" && v.length <= 120) out[c.key] = v;
    else if (c.type === "icon" && typeof v === "string" && (v === "" || (/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(v) && v.length < 300000))) out[c.key] = v;
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
  normalizeStrength();
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
    position: fixed; z-index: 99999; width: 262px; padding: 10px 12px 10px;
    max-height: calc(100vh - 24px); overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin;
    background: var(--bg); color: var(--fg); border: 1px solid var(--line); border-radius: 10px;
    box-shadow: 0 6px 22px rgba(0, 0, 0, .2); color-scheme: light;
    font: 12.5px/1.35 "Inter", "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-variant-numeric: tabular-nums; -webkit-font-smoothing: antialiased;
  }
  .box.theme-dark {
    --bg: #262421; --fg: #ececec; --muted: #9d9a95; --line: #3b3835; --soft: #312e2b;
    box-shadow: 0 8px 28px rgba(0, 0, 0, .5); color-scheme: dark;
  }
  @media (prefers-color-scheme: dark) {
    .box.theme-auto {
      --bg: #262421; --fg: #ececec; --muted: #9d9a95; --line: #3b3835; --soft: #312e2b;
      box-shadow: 0 8px 28px rgba(0, 0, 0, .5); color-scheme: dark;
    }
  }
  .c-br { right: 12px; bottom: 12px; } .c-bl { left: 12px; bottom: 12px; }
  .c-tr { right: 12px; top: 12px; } .c-tl { left: 12px; top: 12px; }

  .hud {
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
    color: var(--accent); text-shadow: 1px 1px 0 rgba(0, 0, 0, .75); white-space: nowrap;
  }
  .hud.h-tr .hl, .hud.h-br .hl { border-left: 0; border-right: 2px solid currentColor; padding: 1px 5px 1px 6px; }
  .hud .hl span { margin-left: 3px; color: #c9c3bd; }

  .head { display: flex; align-items: center; gap: 8px; }
  .logo { display: flex; flex: none; } .logo svg, .logo img { width: 24px; height: 24px; }
  .logo img, .icon-prev img { border-radius: 6px; object-fit: cover; display: block; }
  .icon-row { display: flex; align-items: center; gap: 6px; flex: none; }
  .icon-row .btn { padding: 0 8px; }
  .sel > span:first-child { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .icon-prev { display: inline-flex; width: 22px; height: 22px; } .icon-prev svg, .icon-prev img { width: 22px; height: 22px; }
  .mobile .logo svg, .mobile .logo img { width: 28px; height: 28px; }
  .name { flex: 1; min-width: 0; }
  .title { font-size: 14px; font-weight: 700; letter-spacing: -.01em; line-height: 1.2; color: var(--fg); }
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
  .btn.x { padding: 0; width: 24px; font-size: 14px; line-height: 1; color: var(--muted); }
  .pre-msg, .upd-msg { font-size: 11px; color: var(--muted); }
  .pre-msg:empty, .upd-msg:empty { display: none; }
  .ctl[hidden] { display: none; }

  /* the model list with the StockCrab mark */
  .mp-btn { display: flex; align-items: center; gap: 6px; cursor: pointer; max-width: 170px; text-align: left; }
  .mobile .mp-btn { max-width: 60%; }
  .mp-btn .mp-name { flex: 1; min-width: 0; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mp-btn em { font-style: normal; color: var(--muted); font-size: 10px; }
  .mp-ic { display: contents; }
  .mp-icon { display: inline-flex; width: 18px; height: 18px; flex: none; }
  .mp-icon svg, .mp-icon img { width: 18px; height: 18px; display: block; }
  .mp-icon img { border-radius: 4px; object-fit: contain; }
  .mp-list { margin-top: 6px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); padding: 4px; display: grid; gap: 1px; }
  .mp-list[hidden] { display: none; }
  .mp-list button { display: flex; align-items: center; gap: 8px; width: 100%; padding: 5px 8px; border: 0; border-radius: 6px; background: none;
    font: inherit; font-size: 12px; color: var(--fg); text-align: left; cursor: pointer; }
  .mp-list button:hover, .mp-list button:focus-visible { background: var(--soft); outline: none; }
  .mp-list button[aria-selected="true"] { color: var(--accent); font-weight: 600; }

  /* what the crab says */
  .say { margin-top: 6px; display: flex; align-items: center; gap: 7px; font-size: 11.5px; color: var(--fg); font-style: italic; }
  .say[hidden], .off .say { display: none; }
  .say-ic { display: inline-flex; width: 16px; height: 16px; flex: none; }
  .say-ic svg { width: 16px; height: 16px; }

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
  .mv .sc:empty { display: none; }

  .status { margin-top: 8px; display: flex; align-items: center; gap: 7px; min-height: 16px; font-size: 11.5px; color: var(--muted); cursor: pointer; }
  .status::before { content: ""; width: 7px; height: 7px; border-radius: 50%; flex: none; background: var(--line); }
  .status[data-kind=ok] { color: var(--fg); } .status[data-kind=ok]::before { background: #2ea043; }
  .status[data-kind=busy]::before { background: var(--accent); }
  .status[data-kind=err] { color: #d1242f; } .status[data-kind=err]::before { background: #d1242f; }
  .off .status, .off .moves, .collapsed .body { display: none; }
  @media (max-width: 640px) { .box { left: 8px !important; right: 8px !important; width: auto; max-height: 60vh; } }

  /* the light build: a sheet along the bottom of the screen, sized for fingers */
  .box.mobile {
    left: 0 !important; right: 0 !important; top: auto !important; bottom: 0 !important; width: auto; max-height: 58vh;
    border-radius: 14px 14px 0 0; border-width: 1px 0 0; padding: 10px 14px calc(10px + env(safe-area-inset-bottom)); font-size: 14px;
  }
  .mobile .logo svg { width: 28px; height: 28px; }
  .mobile .title { font-size: 16px; }
  .mobile .sub { font-size: 12px; }
  .mobile .sw { width: 46px; height: 28px; }
  .mobile .sw i::after { top: 4px; left: 4px; width: 20px; height: 20px; }
  .mobile .sw input:checked + i::after { transform: translateX(18px); }
  .mobile .fold { width: 36px; height: 36px; line-height: 36px; font-size: 18px; }
  .mobile summary { font-size: 11.5px; padding: 8px 0; }
  .mobile .grid { gap: 12px; }
  .mobile .lab, .mobile .sel, .mobile .chk { font-size: 13.5px; }
  .mobile input[type=range] { height: 28px; }
  .mobile input[type=range]::-moz-range-thumb { width: 22px; height: 22px; }
  .mobile input[type=range]::-webkit-slider-thumb { width: 22px; height: 22px; margin-top: -9px; }
  .mobile .chk input { width: 20px; height: 20px; }
  .mobile .field, .mobile .sel select, .mobile .pre select, .mobile .pre input, .mobile .btn { height: 34px; font-size: 13.5px; }
  .mobile .sel select { max-width: 60%; }
  .mobile .mv .san { font-size: 15px; }
  .mobile .mv .co, .mobile .mv .dt { font-size: 11.5px; }
  .mobile .status { font-size: 13px; min-height: 20px; }
  .mobile .btn.x { width: 34px; font-size: 18px; }
  .mobile .note, .mobile .say { font-size: 12.5px; }
  .mobile .mp-list button { padding: 9px 10px; font-size: 13.5px; }
  .mobile.collapsed .mv:not(:first-child) { display: none; }
  .mobile.collapsed .moves { margin-top: 6px; }
  .mobile.collapsed .status { margin-top: 6px; }
`;

const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function controlHtml(c) {
  return `<div class="ctl" data-ctl="${c.key}">${controlInner(c)}</div>`;
}

function controlInner(c) {
  if (c.type === "range") {
    return `<div class="lab"><span data-l="${c.key}">${typeof c.label === "function" ? c.label(settings) : c.label}</span><b data-v="${c.key}"></b></div>
      <input type="range" data-key="${c.key}" min="${c.bounds ? c.bounds()[0] : c.min}" max="${c.bounds ? c.bounds()[1] : c.max}" step="${c.step}">`;
  }
  if (c.type === "check") return `<label class="chk"><input type="checkbox" data-key="${c.key}"><span>${c.label}</span></label>`;
  if (c.type === "modelpick") {
    // a list of its own instead of <select>: an option of a native select can not show the StockCrab mark
    const items = c.opts.map(([v, t]) => `<button type="button" role="option" data-mpv="${v}">${modelIcon(v)}<span>${t}</span></button>`).join("");
    return `<div class="mp"><div class="sel"><span>${c.label}</span><button type="button" class="field mp-btn" aria-haspopup="listbox" aria-expanded="false"><i class="mp-ic"></i><b class="mp-name"></b><em aria-hidden="true">▾</em></button></div>
      <div class="mp-list" role="listbox" aria-label="${c.label}" hidden>${items}</div></div>`;
  }
  if (c.type === "select") {
    const opts = c.opts.map(([v, t]) => `<option value="${v}">${t}</option>`).join("");
    return `<label class="sel"><span>${c.label}</span><select data-key="${c.key}">${opts}</select></label>`;
  }
  if (c.type === "note") return `<div class="note">${typeof c.text === "function" ? c.text(settings) : c.text}</div>`;
  if (c.type === "opening") {
    return `<div class="op"><label class="sel"><span>${c.label}</span><input class="field txt" data-key="${c.key}" placeholder="Engine only" spellcheck="false" autocomplete="off"></label><div class="sugg" hidden></div></div>`;
  }
  if (c.type === "configs") {
    return `<div class="pre">
      <div class="row"><select class="pre-list"></select><button class="btn x" data-act="delete" title="Delete">×</button></div>
      <div class="row"><input class="pre-name" maxlength="40" placeholder="Name"><button class="btn main" data-act="save">Save</button></div>
      <div class="row small"><button class="btn" data-act="export">Export</button><button class="btn" data-act="import">Import</button></div>
      <input type="file" class="pre-file" accept=".json,application/json" hidden>
      <div class="pre-msg"></div>
    </div>`;
  }
  if (c.type === "uci") return `<div class="uci"></div>`;
  if (c.type === "icon") {
    return `<div class="sel"><span>${c.label}</span><span class="icon-row"><i class="icon-prev"></i><button type="button" class="btn" data-icon="pick" title="Choose a picture for the panel">Change</button><button type="button" class="btn" data-icon="reset" title="Back to the crab">Reset</button></span></div>
      <input type="file" class="icon-file" accept="image/*" hidden>`;
  }
  if (c.type === "update") {
    return `<div class="upd"><span class="upd-text"></span><button class="btn main" data-up="install" hidden>Update</button></div><div class="upd-msg"></div>`;
  }
  return `<label class="sel"><span>${c.label}</span><input type="color" data-key="${c.key}"></label>`;
}

// each engine's mark (constants.js), or an empty slot of the same width
const modelIcon = (v) => `<i class="mp-icon">${MODEL_ICONS[v] || ""}</i>`;

function pickModel(v, shadow) {
  const before = settings.model;
  shadow.querySelector(".mp-list").hidden = true;
  shadow.querySelector(".mp-btn").setAttribute("aria-expanded", "false");
  if (v === before || !MODEL_INFO[v]) return;
  settings.model = v;
  normalizeStrength(before);
  if (settings.enabled) sendEngineChoice();
  loadUciOptions();
  syncPanel();
  save();
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
        <span class="logo"></span>
        <div class="name"><div class="title">StockCrab</div><div class="sub einfo"></div></div>
        <label class="sw" title="Alt+X"><input type="checkbox" class="on"><i></i></label>
        <button class="fold" title="Collapse">▾</button>
      </div>
      <div class="body">${sections}</div>
      <div class="moves"></div>
      <div class="status"></div>
      <div class="say" hidden><i class="say-ic">${CRAB_V1_SVG}</i><span></span></div>
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
    if (c.key === "elo" || c.key === "skill") normalizeStrength();
    if (settings[c.key] === before && c.type !== "range") return;
    if (c.fx === "engine") {
      if (settings.enabled) sendEngineChoice();
      loadUciOptions();
    }
    if (c.fx === "render") rerender();
    if (c.key === "checkUpdates") refreshUpdate(settings.checkUpdates);
    syncPanel();
    save();
  };
  shadow.addEventListener("input", onControl);
  shadow.addEventListener("change", onControl);
  // typing in the panel must not reach the site's hotkeys
  shadow.addEventListener("keydown", (e) => {
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) && e.target.type !== "range" && e.target.type !== "checkbox") e.stopPropagation();
  });
  // picking a config applies it
  const mpBtn = shadow.querySelector(".mp-btn"), mpList = shadow.querySelector(".mp-list");
  mpBtn.addEventListener("click", () => {
    mpList.hidden = !mpList.hidden;
    mpBtn.setAttribute("aria-expanded", String(!mpList.hidden));
    if (!mpList.hidden) (mpList.querySelector('[aria-selected="true"]') || mpList.firstElementChild)?.focus();
  });
  mpList.addEventListener("click", (e) => {
    const b = e.target.closest("[data-mpv]");
    if (b) pickModel(b.dataset.mpv, shadow);
  });
  mpList.addEventListener("keydown", (e) => {
    const items = [...mpList.querySelectorAll("[data-mpv]")];
    const i = items.indexOf(shadow.activeElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus();
    } else if (e.key === "Escape") {
      mpList.hidden = true;
      mpBtn.setAttribute("aria-expanded", "false");
      mpBtn.focus();
    }
  });
  shadow.addEventListener("pointerdown", (e) => {
    if (!mpList.hidden && !e.composedPath().some((n) => n === mpList || n === mpBtn)) {
      mpList.hidden = true;
      mpBtn.setAttribute("aria-expanded", "false");
    }
  });
  shadow.querySelector(".pre-list").addEventListener("change", (e) => {
    configPick = e.target.value;
    if (settings.presets[configPick]) onConfigAction("apply", shadow);
    syncConfigs(shadow);
  });
  // the panel icon: any picture, cut to a square and shrunk to 64 px, kept with the settings
  const iconFile = shadow.querySelector(".icon-file");
  shadow.querySelector('[data-icon="pick"]').addEventListener("click", () => iconFile.click());
  shadow.querySelector('[data-icon="reset"]').addEventListener("click", () => {
    settings.panelIcon = "";
    syncPanel();
    save();
  });
  iconFile.addEventListener("change", () => {
    const file = iconFile.files && iconFile.files[0];
    iconFile.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      c.getContext("2d").drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, 64, 64);
      URL.revokeObjectURL(url);
      try {
        settings.panelIcon = c.toDataURL("image/png");
      } catch (e) {
        return;
      }
      syncPanel();
      save();
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
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
    normalizeStrength();
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
  updateCrabCursor();
  r.host.style.setProperty("--accent", /^#[0-9a-f]{6}$/i.test(settings.accent) ? settings.accent : DEFAULTS.accent);
  const box = r.querySelector(".box");
  box.className = `box c-${settings.corner} theme-${settings.theme || "auto"}` + (MOBILE ? " mobile" : "") + (settings.enabled ? "" : " off") +
    (settings.collapsed ? " collapsed" : "") + (settings.showList ? "" : " no-list") + (settings.animate ? " anim" : "");
  r.querySelector(".fold").textContent = settings.collapsed ? "▸" : "▾";
  const icon = settings.panelIcon || "";
  const logo = r.querySelector(".logo");
  if (logo.dataset.icon !== icon || !logo.firstChild) {
    logo.innerHTML = icon ? `<img src="${icon}" alt="">` : LOGO_SVG;
    logo.dataset.icon = icon;
    const prev = r.querySelector(".icon-prev");
    if (prev) prev.innerHTML = icon ? `<img src="${icon}" alt="">` : LOGO_SVG;
  }
  r.querySelector(".on").checked = settings.enabled;
  r.querySelectorAll("details").forEach((d) => {
    const open = !!settings.sections[d.dataset.section];
    if (d.open !== open) d.open = open;
  });
  for (const c of CONTROLS) {
    const wrap = r.querySelector(`[data-ctl="${c.key}"]`);
    if (wrap) wrap.hidden = c.when ? !c.when(settings) : false;
    if (c.type === "modelpick" && wrap) {
      const cur = c.opts.find(([v]) => v === settings[c.key]) || c.opts[0];
      wrap.querySelector(".mp-name").textContent = cur[1];
      wrap.querySelector(".mp-ic").innerHTML = modelIcon(cur[0]);
      wrap.querySelectorAll("[data-mpv]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.mpv === cur[0])));
      continue;
    }
    if (typeof c.label === "function") r.querySelector(`[data-l="${c.key}"]`).textContent = c.label(settings);
    if (c.type === "note" && typeof c.text === "function" && wrap) wrap.querySelector(".note").textContent = c.text(settings);
    const el = r.querySelector(`[data-key="${c.key}"]`);
    if (!el) continue;
    if (c.type === "check") el.checked = !!settings[c.key];
    else if (el !== r.activeElement || c.type !== "opening") el.value = settings[c.key] ?? "";
    if (c.type === "range") {
      const [lo, hi] = c.bounds ? c.bounds() : [c.min, c.max];
      if (c.bounds) {
        el.min = lo;
        el.max = hi;
        el.value = settings[c.key];
      }
      r.querySelector(`[data-v="${c.key}"]`).textContent = c.fmt(settings[c.key]);
      el.style.setProperty("--p", ((settings[c.key] - lo) / (hi - lo)) * 100 + "%");
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
  if (modelInfo(s).crab) rows.push(["Character", s.character]);
  if (searching(s)) {
    rows.push(["Strength", s.strengthBy === "skill" && !modelInfo(s).crab ? `Skill ${s.skill}` : s.elo >= eloRange(s)[1] ? "Full" : `${s.elo} Elo`]);
    if (modelInfo(s).quick) rows.push(["Depth", String(s.quickDepth)]);
    else {
      rows.push(["ThinkTime", (s.movetime / 1000).toFixed(1) + "s"]);
      if (s.depth) rows.push(["MaxDepth", String(s.depth)]);
      if (s.nodes) rows.push(["MaxNodes", nodesText(s.nodes)]);
    }
    if (s.aggression && !modelInfo(s).crab) rows.push(["Aggression", s.aggression + "%"]);
    if (s.premove) rows.push(["Premove", { smart: "Smart", likely: "Likely", safe: "Safe" }[s.premoveMode] || s.premoveMode]);
    if (s.useNnue === false && modelInfo(s).nnue) rows.push(["ClassicalEval", ""]);
  } else rows.push(["Players", String(s.maiaRating)]);
  const own = Object.keys((s.uci || {})[s.model] || {}).length;
  if (own) rows.push(["EngineOptions", String(own)]);
  if (s.others) rows.push(["OtherMoves", String(s.others)]);
  if (s.showWdl) rows.push(["WinDrawLoss", ""]);
  if (s.openingWhite) rows.push(["WhiteOpening", s.openingWhite]);
  if (s.openingBlack) rows.push(["BlackOpening", s.openingBlack]);
  if (s.evalBar) rows.push(["EvalBar", ""]);
  if (s.threat && searching(s)) rows.push(["Threat", ""]);
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
  hud.className = `hud h-${corner}` + (corner === settings.corner && !settings.collapsed ? " beside" : "");
  const html = hudRows(settings).map(([k, v]) => `<div class="hl">${esc(k)}${v ? `<span>[${esc(v)}]</span>` : ""}</div>`).join("");
  if (hud.dataset.html === html) return;
  hud.innerHTML = html;
  hud.dataset.html = html;
  // widest line first
  [...hud.children].map((el) => [el, el.getBoundingClientRect().width]).sort((a, b) => b[1] - a[1]).forEach(([el]) => hud.appendChild(el));
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
    clearEval();
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
