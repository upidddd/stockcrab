// Engine models and the state of the running engine.

// elo: UCI_Elo range; noElo: strength via Skill Level only; nnue: has "Use NNUE"; maia: no search, plays like people;
// quick: a fixed shallow depth instead of a think time (fast, weaker)
const MODELS = {
  "sf19-full": { name: "Stockfish 19 Full", file: "engine/stockfish-19-single.js", bootMs: 60000, maxHash: 256, elo: [1320, 3190] },
  "sf19-lite": { name: "Stockfish 19 Lite", file: "engine/stockfish-19-lite-single.js", bootMs: 25000, maxHash: 256, elo: [1320, 3190] },
  "sf19-quick": { name: "Stockfish 19 Quick", file: "engine/stockfish-19-lite-single.js", bootMs: 25000, maxHash: 256, elo: [1320, 3190], quick: true },
  "sf17-full": { name: "Stockfish 17.1 Full", file: "engine/sf17/stockfish-17.1-single-a496a04.js", bootMs: 60000, maxHash: 256, elo: [1320, 3190] },
  "sf17-lite": { name: "Stockfish 17.1 Lite", file: "engine/sf17/stockfish-17.1-lite-single-03e3232.js", bootMs: 25000, maxHash: 256, elo: [1320, 3190] },
  "sf11": { name: "Stockfish 11 Classic", file: "engine/sf11/stockfish.js", bootMs: 20000, maxHash: 64, noElo: true },
  "sf19-asm": { name: "Stockfish 19 JavaScript", file: "engine/stockfish-19-asm.js", bootMs: 30000, maxHash: 32, elo: [1320, 3190] },
  "fairy": { name: "Fairy-Stockfish", file: "engine/fairy/fairy-stockfish.js", bootMs: 60000, maxHash: 256, elo: [500, 2850], nnue: true },
  "maia3": { name: "Maia 3", file: "engine/maia/maia-uci.js", bootMs: 60000, maxHash: 256, elo: [600, 2600], maia: true },
};
const DEFAULT_MODEL = "sf19-full";
const FALLBACKS = ["sf19-full", "sf19-lite"]; // if the chosen model does not start
const bootMs = () => globalThis.__BOOT_MS ?? MODELS[modelId].bootMs;
let requested = DEFAULT_MODEL;
let modelId = DEFAULT_MODEL; // running model (differs after a fallback)
let tried = new Set([DEFAULT_MODEL]);
let notice = null;
let engine = null;
let newGame = true;

let ready = false;
let busy = null;
let pending = null;

function send(cmd) {
  engine.postMessage(cmd);
}

// Options the panel's own controls set, or that make no sense in a browser: not offered as engine options.
const MANAGED_OPTIONS = new Set([
  "MultiPV", "UCI_Elo", "UCI_LimitStrength", "Skill Level", "Hash", "Threads", "UCI_ShowWDL", "Use NNUE", "Opponent Elo",
  "EvalFile", "EvalFileSmall", "Debug Log File", "SyzygyPath", "NumaPolicy", "UCI_Variant", "VariantPath", "Protocol",
]);

// UCI options each model reports, kept between sessions: { model: [{ name, type, def, min, max, vars }] }
const engineOptions = {};
try {
  browser.storage.local.get("stockcrabOptions").then((r) => Object.assign(engineOptions, r.stockcrabOptions || {}, engineOptions));
} catch (e) {}

function noteOption(line) {
  const at = line.indexOf(" type ");
  if (at < 0) return;
  const name = line.slice("option name ".length, at).trim();
  const words = line.slice(at + 6).split(" ");
  const o = { name, type: words[0], def: "", vars: [] };
  for (let i = 1; i < words.length; i++) {
    const w = words[i];
    if (w === "default") {
      const vals = [];
      while (i + 1 < words.length && !["min", "max", "var"].includes(words[i + 1])) vals.push(words[++i]);
      o.def = vals.join(" ").replace(/^<empty>$/, "");
    } else if (w === "min") o.min = Number(words[++i]);
    else if (w === "max") o.max = Number(words[++i]);
    else if (w === "var") {
      const vals = [];
      while (i + 1 < words.length && words[i + 1] !== "var") vals.push(words[++i]);
      o.vars.push(vals.join(" "));
    }
  }
  if (o.type === "button" || MANAGED_OPTIONS.has(name)) return;
  const list = (engineOptions[modelId] ??= []);
  const i = list.findIndex((x) => x.name === name);
  if (i >= 0) list[i] = o;
  else list.push(o);
}

function saveEngineOptions() {
  try {
    browser.storage.local.set({ stockcrabOptions: engineOptions });
  } catch (e) {}
}

// The user's own engine options; ones dropped since the last search go back to their default.
let userOptions = new Set();
function applyUserOptions(values) {
  const known = new Map((engineOptions[modelId] || []).map((o) => [o.name, o]));
  for (const name of userOptions) if (!(values && name in values) && known.has(name)) option(name, known.get(name).def);
  userOptions = new Set();
  for (const [name, v] of Object.entries(values || {})) {
    if (!known.has(name) || v === undefined || v === null) continue;
    option(name, v);
    userOptions.add(name);
  }
}

// setoption, only when the value changes
let sentOptions = new Map();
function option(name, value) {
  if (sentOptions.get(name) === String(value)) return;
  sentOptions.set(name, String(value));
  send(`setoption name ${name} value ${value}`);
}
