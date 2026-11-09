//! StockCrab · Engine registry
//! The engine builds the panel can choose from, and the state of the running engine.
//! File: background/engine/models.js. A background script (hosts the engine); files of one kind share a single global scope and load in the order of manifest.json.

// Hosts a single Stockfish worker and answers the requests of the content scripts (content/).
// Full NNUE network (stronger, ~99 MB) first; the compact one if the full engine never boots.
// Engine models the panel can choose from. `noElo`: this build has no UCI_Elo, so strength is set with Skill Level.
const MODELS = {
  "sf19-full": { name: "Stockfish 19 Full", file: "engine/stockfish-19-single.js", bootMs: 60000, maxHash: 256 },
  "sf19-lite": { name: "Stockfish 19 Lite", file: "engine/stockfish-19-lite-single.js", bootMs: 25000, maxHash: 256 },
  "sf17-full": { name: "Stockfish 17.1 Full", file: "engine/sf17/stockfish-17.1-single-a496a04.js", bootMs: 60000, maxHash: 256 },
  "sf17-lite": { name: "Stockfish 17.1 Lite", file: "engine/sf17/stockfish-17.1-lite-single-03e3232.js", bootMs: 25000, maxHash: 256 },
  "sf11": { name: "Stockfish 11 Classic", file: "engine/sf11/stockfish.js", bootMs: 20000, maxHash: 64, noElo: true },
  "sf19-asm": { name: "Stockfish 19 JavaScript", file: "engine/stockfish-19-asm.js", bootMs: 30000, maxHash: 32 },
};
const DEFAULT_MODEL = "sf19-full";
const FALLBACKS = ["sf19-full", "sf19-lite"]; // tried in this order if the chosen model does not start
const bootMs = () => globalThis.__BOOT_MS ?? MODELS[modelId].bootMs;
let requested = DEFAULT_MODEL; // what the panel asked for
let modelId = DEFAULT_MODEL; // what is actually running (differs after a fallback)
let tried = new Set([DEFAULT_MODEL]);
let notice = null; // shown in the panel when a fallback happened
let engine = null;
let newGame = true; // clear the hash only for a genuinely new game, not between moves

let ready = false;
let busy = null; // request currently being searched
let pending = null; // newest request waiting for the search to stop

function send(cmd) {
  engine.postMessage(cmd);
}
