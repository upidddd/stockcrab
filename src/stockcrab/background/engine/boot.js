// Starts the engine worker, fallback and restart.

let engineError = null;
let lastLine = "";
let hello = null;
let bootTimer = null;

let currentHash = 128;
function applyOptions() {
  currentHash = 128;
  send("setoption name Hash value 128");
  send("setoption name Threads value 1");
  send("setoption name Skill Level value 20");
  send("setoption name Move Overhead value 30");
}

function spawn() {
  clearInterval(hello);
  clearTimeout(bootTimer);
  ready = false;
  engineError = null;
  engine = new Worker(browser.runtime.getURL(MODELS[modelId].file));
  engine.onmessage = onEngineMessage;
  engine.onerror = (e) => {
    console.error("[sparring] engine error", e.message, e.filename, e.lineno);
    engineError = e.message || "engine failed to load";
    if (ready) return restartEngine();
    fallback();
  };
  // keep asking until the engine answers
  hello = setInterval(() => send("uci"), 500);
  bootTimer = setTimeout(() => {
    if (!ready) fallback();
  }, bootMs());
  send("uci");
}

// Restarts a crashed engine (at most 3 times a minute).
let crashes = [];
let dead = false;
function restartEngine() {
  const now = Date.now();
  crashes = crashes.filter((t) => now - t < 60000);
  crashes.push(now);
  for (const r of [busy, pending]) if (r) r.resolve({ id: r.id, move: null, error: "the engine stopped, restarting" });
  busy = null;
  pending = null;
  if (job) job.cancelled = true;
  try {
    engine.terminate();
  } catch (e) {}
  ready = false;
  newGame = true;
  lastFen = null;
  if (crashes.length <= 3) spawn();
  else dead = true;
}

function fallback() {
  if (ready) return;
  const next = FALLBACKS.find((id) => !tried.has(id));
  if (!next) return;
  try {
    engine.terminate();
  } catch (e) {}
  notice = `${MODELS[modelId].name} did not start, using ${MODELS[next].name}`;
  console.warn("[sparring]", notice);
  tried.add(next);
  modelId = next;
  spawn();
}

spawn();
