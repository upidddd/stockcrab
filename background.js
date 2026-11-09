// Hosts a single Stockfish worker and answers hint requests from content.js.
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

const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

function pieceAt(fen, sq) {
  const rows = fen.split(" ")[0].split("/");
  const row = rows[8 - Number(sq[1])];
  let file = 0;
  for (const c of row) {
    if (/\d/.test(c)) {
      file += Number(c);
      if (file > "abcdefgh".indexOf(sq[0])) return null;
    } else {
      if (file === "abcdefgh".indexOf(sq[0])) return c;
      file++;
    }
  }
  return null;
}

// How sharp a move is: captures (more for bigger victims), promotions, pawn advances.
function sharpness(fen, move) {
  const mover = pieceAt(fen, move.slice(0, 2));
  const victim = pieceAt(fen, move.slice(2, 4));
  const white = fen.split(" ")[1] === "w";
  let score = 0;
  if (victim) score += 10 + 4 * VALUE[victim.toLowerCase()];
  else if (mover && mover.toLowerCase() === "p" && move[0] !== move[2]) score += 12; // en passant
  if (move.length === 5) score += 25;
  if (mover && mover.toLowerCase() === "p") {
    const rank = Number(move[3]);
    score += white ? rank : 9 - rank;
  }
  return score;
}

function pickAggressive(req, lines) {
  const list = [...lines].sort((a, b) => b.score - a.score);
  const best = list[0];
  if (!best || best.mate > 0) return best?.move;
  const margin = Math.round(req.aggression * 0.25); // 0..25 cp: never trade real strength for style
  let choice = best;
  let top = sharpness(req.fen, best.move);
  for (const c of list.slice(1)) {
    if (c.mate !== 0 && c.mate < 0) continue;
    if (best.score - c.score > margin) continue;
    const sh = sharpness(req.fen, c.move);
    if (sh > top) {
      top = sh;
      choice = c;
    }
  }
  return choice.move;
}

// Only exact scores are kept (an aspiration-window "lowerbound"/"upperbound" is not a result), and every
// line is remembered per depth, so the answer can be built from one finished iteration instead of a mix.
function parseInfo(req, line) {
  if (!req.hist || !line.startsWith("info") || !line.includes(" pv ")) return;
  if (/\b(lowerbound|upperbound)\b/.test(line)) return;
  const depth = Number(/ depth (\d+)/.exec(line)?.[1]);
  const mpv = Number(/ multipv (\d+)/.exec(line)?.[1] ?? 1);
  const cp = /score cp (-?\d+)/.exec(line);
  const mate = /score mate (-?\d+)/.exec(line);
  const pv = (/ pv (.+)$/.exec(line)?.[1] || "").trim().split(/\s+/).filter(Boolean);
  const move = pv[0];
  if (!move || !depth || (!cp && !mate)) return;
  const m = mate ? Number(mate[1]) : 0;
  const score = mate ? (m > 0 ? 100000 - m : -100000 - m) : Number(cp[1]);
  const byDepth = req.hist.get(mpv) ?? new Map();
  byDepth.set(depth, { depth, move, pv, score, mate: m });
  while (byDepth.size > 4) byDepth.delete(Math.min(...byDepth.keys())); // only the latest few depths matter
  req.hist.set(mpv, byDepth);
}

// The lines of the last COMPLETE iteration: the deepest depth that every line reached, in the engine's own order.
function finalLines(req) {
  const idx = [...req.hist.keys()].sort((a, b) => a - b);
  if (!idx.length) return { lines: [], depth: 0 };
  const sets = idx.map((i) => new Set(req.hist.get(i).keys()));
  const common = [...sets[0]].filter((d) => sets.every((st) => st.has(d))).sort((a, b) => b - a);
  if (common.length) return { lines: idx.map((i) => req.hist.get(i).get(common[0])), depth: common[0] };
  const latest = idx.map((i) => {
    const m = req.hist.get(i);
    return m.get(Math.max(...m.keys()));
  });
  return { lines: latest, depth: Math.min(...latest.map((l) => l.depth)) };
}

// The deepest result recorded for one particular move (used when the engine plays a move that is not among the lines).
function deepestFor(req, move) {
  let best = null;
  for (const byDepth of req.hist.values()) {
    for (const rec of byDepth.values()) if (rec.move === move && (!best || rec.depth > best.depth)) best = rec;
  }
  return best;
}

let lastFen = null;
function pieces(fen) {
  return (fen.split(" ")[0].match(/[a-z]/gi) || []).length;
}
const START_PLACEMENT = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";
// A new game starts at the initial setup or when material jumps up; otherwise keep the hash.
function sameGame(fen) {
  if (lastFen === null || fen.split(" ")[0] === START_PLACEMENT) return false;
  return pieces(fen) <= pieces(lastFen);
}

function start(req) {
  busy = req;
  req.hist = new Map();
  if (newGame || !sameGame(req.fen)) send("ucinewgame");
  newGame = false;
  lastFen = req.fen;
  send(`setoption name MultiPV value ${Math.min(256, Math.max(req.multipv ?? 1, req.aggression > 0 ? 2 : 1))}`);
  const model = MODELS[modelId];
  if (req.elo >= 3190) {
    send("setoption name UCI_LimitStrength value false");
    if (model.noElo) send("setoption name Skill Level value 20");
  } else if (model.noElo) {
    // no UCI_Elo in this build: map the Elo range onto Skill Level 0..20
    send(`setoption name Skill Level value ${Math.max(0, Math.min(20, Math.round(((req.elo - 1320) / (3190 - 1320)) * 20)))}`);
  } else {
    send("setoption name UCI_LimitStrength value true");
    send(`setoption name UCI_Elo value ${req.elo}`);
  }
  const hash = Math.min(req.hash || 128, model.maxHash);
  if (hash !== currentHash) {
    send(`setoption name Hash value ${hash}`);
    currentHash = hash;
  }
  send(`position fen ${req.fen}${req.moves && req.moves.length ? " moves " + req.moves.join(" ") : ""}`);
  send(req.goCmd ?? (req.depth > 0 ? `go depth ${req.depth} movetime ${req.movetime}` : `go movetime ${req.movetime}`));
}

function onEngineMessage(event) {
  const line = typeof event.data === "string" ? event.data : "";
  if (line) lastLine = line.slice(0, 80);
  if (line === "uciok") {
    if (!ready) send("isready");
  } else if (line === "readyok") {
    ready = true;
    clearInterval(hello);
    clearTimeout(bootTimer);
    if (modelId === requested) notice = null;
    applyOptions();
    if (pending) {
      const next = pending;
      pending = null;
      start(next);
    }
  } else if (line.startsWith("info")) {
    if (busy) parseInfo(busy, line);
  } else if (line.startsWith("bestmove")) {
    const done = busy;
    busy = null;
    if (pending) {
      const next = pending;
      pending = null;
      if (done) done.resolve({ id: done.id, move: null });
      start(next);
      return;
    }
    if (!done) return;
    let move = line.split(" ")[1];
    const { lines, depth } = finalLines(done);
    try {
      if (done.aggression > 0 && lines.length > 1) move = pickAggressive(done, lines) || move;
    } catch (e) {
      console.error("[sparring] aggression pick failed", e);
    }
    // The evaluation shown for the move must belong to that very move: the line it is in, or its own deepest record.
    const chosen = lines.find((l) => l.move === move) || deepestFor(done, move);
    done.resolve({
      id: done.id, move, depth, chosen: chosen ? { move: chosen.move, score: chosen.score, mate: chosen.mate, depth: chosen.depth, pv: chosen.pv } : null,
      lines: lines.map((c) => ({ move: c.move, pv: c.pv, score: c.score, mate: c.mate, depth: c.depth })),
    });
  }
}

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
    if (ready) return restartEngine(); // it was running and died: start the same model again
    fallback();
  };
  // The worker may drop commands sent while the wasm is still loading, so keep asking.
  hello = setInterval(() => send("uci"), 500);
  bootTimer = setTimeout(() => {
    if (!ready) fallback();
  }, bootMs());
  send("uci");
}

// The engine crashed while running: answer what is waiting, start the same model again (at most 3 times a minute,
// so a model that cannot run does not restart in a loop).
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
  else dead = true; // given up for now: the next request tries once more
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

// Queue one search. Resolves with the engine's answer, or {move: null} if a newer search replaced it.
function submit(msg) {
  if (dead) {
    dead = false;
    crashes = [];
    spawn();
  }
  return new Promise((resolve) => {
    const req = {
      id: msg.id, fen: msg.fen, elo: msg.elo, movetime: msg.movetime, aggression: msg.aggression,
      multipv: msg.multipv, moves: msg.moves, goCmd: msg.goCmd, hash: msg.hash, depth: msg.depth,
    };
    // Never leave the caller hanging: answer with an error if the engine stays silent.
    const timer = setTimeout(() => {
      if (busy === req) busy = null;
      if (pending === req) pending = null;
      resolve({ id: req.id, move: null, error: `engine timeout [${lastLine || "no output"}]` });
    }, (msg.movetime ?? 2000) + (ready ? 8000 : bootMs() + 15000));
    req.resolve = (v) => {
      clearTimeout(timer);
      resolve(v);
    };
    if (pending) pending.resolve({ id: pending.id, move: null });
    if (!ready) {
      pending = req;
    } else if (busy) {
      pending = req;
      send("stop");
    } else {
      start(req);
    }
  });
}

// ---- premove ----
// Opponent to move in `fen`. Two styles:
//  "safe":   a premove is only offered when OUR best reply is the same whatever legal move they play,
//            and is clearly better than our second choice each time.
//  "likely": "just in case": our best reply to their most likely move (e.g. the recapture after they take
//            a pawn), together with how many of the other likely moves lead to the same reply.
const SAFE_GAP_CP = 25; // default; the panel can change it
const PREMOVE_BUDGET_MS = 25000;
let job = null;

const isWhitePiece = (p) => p === p.toUpperCase();

async function analysePremove(msg, mine, ctx) {
  const started = Date.now();
  const none = (reason, extra = {}) => ({ id: msg.id, premove: null, reason, ...extra });
  const base = { id: msg.id, fen: msg.fen, elo: 3190, aggression: 0, hash: msg.hash };
  const per = msg.per || Math.max(120, Math.min(300, Math.round((msg.movetime || 4000) / 25)));
  const gap = msg.gap ?? SAFE_GAP_CP;

  // 1. every legal move of the opponent (depth 1-ish search with all lines switched on)
  // (a little deeper for the styles that judge how likely a move is)
  const listDepth = msg.mode === "smart" || msg.mode === "likely" ? 8 : 4;
  const all = await submit({ ...base, multipv: 256, movetime: 2500, goCmd: `go depth ${listDepth}` });
  if (mine.cancelled || all.error || !all.lines) return none(all.error ? "error" : "cancelled", { error: all.error });
  ctx.all = all; // the opponent's legal moves, best first (reused by the pawn-trade check)
  const theirMoves = all.lines.map((l) => l.move); // best first, so a dependent premove fails fast
  if (!theirMoves.length) return none("no moves");

  // it has to be playable as a premove right now: our own piece on the from-square
  const playable = (move) => {
    const piece = pieceAt(msg.fen, move.slice(0, 2));
    const ourColourWhite = msg.fen.split(" ")[1] === "b";
    return !!piece && isWhitePiece(piece) === ourColourWhite;
  };

  if (msg.mode === "likely" || msg.mode === "smart") {
    const within = msg.likelyWithin ?? 100;
    const count = Math.max(1, Math.min(8, msg.likelyCount ?? 4));
    const top = all.lines[0].score;
    const likely = all.lines.filter((l) => top - l.score <= within).slice(0, count);
    const results = [];
    for (let i = 0; i < likely.length; i++) {
      if (mine.cancelled) return none("cancelled");
      if (Date.now() - started > PREMOVE_BUDGET_MS) break;
      const t = i === 0 ? per * 2 : per; // the most likely move gets the most attention
      const mpv = msg.mode === "smart" && i === 0 ? 2 : 1; // "smart" also wants to know how clear our reply is
      const r = await submit({ ...base, moves: [likely[i].move], multipv: mpv, movetime: t, goCmd: `go movetime ${t}` });
      if (mine.cancelled || r.error || !r.lines) return none(r.error ? "error" : "cancelled", { error: r.error });
      const best = r.lines[0];
      if (!best) {
        if (i === 0) return none(`${likely[i].move} ends the game`);
        continue;
      }
      results.push({ theirs: likely[i].move, best, second: r.lines[1] });
    }
    if (!results.length) return none("no reply");
    const primary = results[0];
    if (!playable(primary.best.move)) return none("piece not in place", { tested: results.length });
    const agree = results.filter((x) => x.best.move === primary.best.move).length;

    if (msg.mode === "smart") {
      // Worth premoving (it saves clock time) when they will almost certainly play one move, or every
      // likely move leads to the same reply, AND our reply is clear (not a close call between two moves).
      const obviousLead = msg.obviousLead ?? 80;
      const replyGap = msg.replyGap ?? 20;
      const lead = all.lines.length > 1 ? all.lines[0].score - all.lines[1].score : 100000;
      const obvious = lead >= obviousLead;
      const agreed = results.length > 1 && agree === results.length;
      if (!obvious && !agreed) return none("they have several good moves", { mode: "smart", tested: results.length });
      if (primary.second && primary.best.score - primary.second.score < replyGap) {
        return none("your reply needs thought", { mode: "smart", tested: results.length });
      }
      return {
        id: msg.id, mode: "smart", why: obvious ? "obvious" : "agreed", premove: primary.best.move, expect: primary.theirs,
        score: primary.best.score, mate: primary.best.mate, agree, considered: results.length, lead,
        tested: results.length, total: all.lines.length,
      };
    }

    return {
      id: msg.id, mode: "likely", premove: primary.best.move, expect: primary.theirs,
      score: primary.best.score, mate: primary.best.mate, agree, considered: results.length,
      tested: results.length, total: all.lines.length,
    };
  }

  // 2. our best reply after each of them
  let reply = null;
  let worst = null; // weakest evaluation of our reply over all their moves (from our side)
  let tested = 0;
  for (const theirs of theirMoves) {
    if (mine.cancelled) return none("cancelled");
    if (Date.now() - started > PREMOVE_BUDGET_MS) return none("too many replies to check", { tested });
    const r = await submit({ ...base, moves: [theirs], multipv: 2, movetime: per, goCmd: `go movetime ${per}` });
    if (mine.cancelled || r.error || !r.lines) return none(r.error ? "error" : "cancelled", { error: r.error });
    const [best, second] = r.lines;
    if (!best) return none(`${theirs} ends the game`, { tested }); // mate or stalemate: nothing to premove
    tested++;
    if (second && best.score - second.score < gap) return none(`unclear after ${theirs}`, { tested });
    if (reply === null) reply = best.move;
    else if (best.move !== reply) return none(`depends on ${theirs}`, { tested });
    if (worst === null || best.score < worst.score) worst = best;
  }
  if (reply === null) return none("no reply");

  // 3. playable right now
  if (!playable(reply)) return none("piece not in place", { tested });

  return { id: msg.id, mode: "safe", premove: reply, score: worst.score, mate: worst.mate, tested, total: theirMoves.length };
}

// ---- pawn trades ----
// "They take my pawn with a pawn, and another pawn of mine can take back": premove the retake, by rule.
const FILES_ = "abcdefgh";

function boardMap(fen) {
  const map = {};
  fen.split(" ")[0].split("/").forEach((row, i) => {
    let f = 0;
    for (const c of row) {
      if (/\d/.test(c)) f += Number(c);
      else {
        map[FILES_[f] + (8 - i)] = c;
        f++;
      }
    }
  });
  return map;
}

// Every legal "their pawn takes our pawn" with the list of our pawn retakes on that square.
function pawnTrades(fen, legal) {
  const map = boardMap(fen);
  const weAreWhite = fen.split(" ")[1] === "b"; // the opponent is the side to move
  const theirPawn = weAreWhite ? "p" : "P";
  const ourPawn = weAreWhite ? "P" : "p";
  const theirDir = weAreWhite ? -1 : 1; // their pawns capture towards lower ranks if they are black
  const ourDir = -theirDir;
  const out = [];
  for (const [sq, piece] of Object.entries(map)) {
    if (piece !== theirPawn) continue;
    const f = FILES_.indexOf(sq[0]);
    const r = Number(sq[1]);
    for (const df of [-1, 1]) {
      const tf = f + df;
      const tr = r + theirDir;
      if (tf < 0 || tf > 7 || tr < 1 || tr > 8) continue;
      const target = FILES_[tf] + tr;
      if (map[target] !== ourPawn) continue;
      const capture = sq + target;
      if (!legal.has(capture)) continue; // pinned pawn, check, ...: they cannot play it
      const defenders = [];
      for (const [s2, p2] of Object.entries(map)) {
        if (p2 !== ourPawn) continue;
        const f2 = FILES_.indexOf(s2[0]);
        if (Math.abs(f2 - tf) === 1 && Number(s2[1]) + ourDir === tr) defenders.push(s2 + target);
      }
      if (defenders.length) out.push({ capture, target, defenders });
    }
  }
  return out;
}

async function pawnTradePremove(msg, mine, ctx) {
  const legal = new Set(ctx.all.lines.map((l) => l.move));
  const trades = pawnTrades(msg.fen, legal);
  if (!trades.length) return null;
  // the capture they are most likely to play first
  const rank = new Map(ctx.all.lines.map((l, i) => [l.move, i]));
  trades.sort((a, b) => rank.get(a.capture) - rank.get(b.capture));
  const base = { id: msg.id, fen: msg.fen, elo: 3190, aggression: 0, hash: msg.hash };
  const per = msg.per || Math.max(120, Math.min(300, Math.round((msg.movetime || 4000) / 25)));
  const tolerance = msg.tradeTolerance ?? 100;
  for (const t of trades.slice(0, 3)) {
    if (mine.cancelled) return null;
    // our best reply to that capture, and our best pawn retake; the retake must not be much worse
    const any = await submit({ ...base, moves: [t.capture], multipv: 1, movetime: per, goCmd: `go movetime ${per}` });
    if (mine.cancelled || any.error || !any.lines || !any.lines[0]) continue;
    const rec = await submit({ ...base, moves: [t.capture], multipv: 1, movetime: per, goCmd: `go movetime ${per} searchmoves ${t.defenders.join(" ")}` });
    if (mine.cancelled || rec.error || !rec.lines || !rec.lines[0]) continue;
    const retake = rec.lines[0];
    if (!t.defenders.includes(retake.move)) continue; // none of them is legal after the capture (pinned, ...)
    if (any.lines[0].score - retake.score > tolerance) continue;
    return { id: msg.id, mode: "pawn", premove: retake.move, expect: t.capture, score: retake.score, mate: retake.mate, tested: 2 };
  }
  return null;
}

async function runPremove(msg) {
  if (job) job.cancelled = true;
  const mine = { cancelled: false };
  job = mine;
  const ctx = {};
  const res = await analysePremove(msg, mine, ctx);
  if (res.premove || !msg.pawnTrade || mine.cancelled || res.error || !ctx.all) return res;
  return (await pawnTradePremove(msg, mine, ctx)) || res;
}

// Switch between the full and the compact network on request (the panel's "Network" setting).
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
  if (msg.type === "rate") {
    // Search ONE move (the one the user played) from the position they had, to the depth of their hint, at full
    // strength: its score is compared with the best line of that hint.
    if (job) job.cancelled = true;
    const depth = Math.max(8, Math.min(msg.depth || 18, 30));
    if (msg.withBest) {
      // no hint was finished for this position: find the best lines first, then the played move if it is not one of them
      return (async () => {
        const a = await submit({
          id: msg.id, fen: msg.fen, elo: 3190, movetime: 2500, hash: msg.hash, multipv: 3,
          goCmd: `go depth ${Math.min(depth, 20)} movetime 2500`,
        });
        if (!a.move || a.error) return a;
        const lines = a.lines || [];
        let chosen = lines.find((l) => l.move === msg.move);
        if (!chosen) {
          const b = await submit({
            id: msg.id, fen: msg.fen, elo: 3190, movetime: 2500, hash: msg.hash, multipv: 1,
            goCmd: `go depth ${Math.max(8, a.depth || depth)} movetime 2500 searchmoves ${msg.move}`,
          });
          if (!b.move || b.error) return b;
          chosen = b.chosen || (b.lines && b.lines[0]);
        }
        return { id: msg.id, move: msg.move, depth: a.depth, lines, chosen };
      })();
    }
    return submit({
      id: msg.id, fen: msg.fen, elo: 3190, movetime: 3000, hash: msg.hash, multipv: 1,
      goCmd: `go depth ${depth} movetime 3000 searchmoves ${msg.move}`,
    });
  }
  if (msg.type === "premove") return runPremove(msg);
});

// Firefox suspends idle MV3 background pages and the worker would die with it.
// An open port from the content script and a periodic API call keep it alive.
browser.runtime.onConnect.addListener(() => {});
setInterval(() => browser.runtime.getPlatformInfo(), 15000);
