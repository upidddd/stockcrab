// Engine models and the state of the running engine.

// noElo: no UCI_Elo, strength via Skill Level; elo: the engine's UCI_Elo range
const MODELS = {
  "sf19-full": { name: "Stockfish 19 Full", file: "engine/stockfish-19-single.js", bootMs: 60000, maxHash: 256 },
  "sf19-lite": { name: "Stockfish 19 Lite", file: "engine/stockfish-19-lite-single.js", bootMs: 25000, maxHash: 256 },
  "sf17-full": { name: "Stockfish 17.1 Full", file: "engine/sf17/stockfish-17.1-single-a496a04.js", bootMs: 60000, maxHash: 256 },
  "sf17-lite": { name: "Stockfish 17.1 Lite", file: "engine/sf17/stockfish-17.1-lite-single-03e3232.js", bootMs: 25000, maxHash: 256 },
  "sf11": { name: "Stockfish 11 Classic", file: "engine/sf11/stockfish.js", bootMs: 20000, maxHash: 64, noElo: true },
  "sf19-asm": { name: "Stockfish 19 JavaScript", file: "engine/stockfish-19-asm.js", bootMs: 30000, maxHash: 32 },
  "fairy": { name: "Fairy-Stockfish", file: "engine/fairy/fairy-stockfish.js", bootMs: 60000, maxHash: 256, elo: [500, 2850] },
  "maia3": { name: "Maia 3", file: "engine/maia/maia-uci.js", bootMs: 60000, maxHash: 256, elo: [600, 2600] },
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
