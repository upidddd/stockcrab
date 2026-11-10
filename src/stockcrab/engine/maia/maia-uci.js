// Maia 3 as a UCI engine (depth 1, most played moves first).

const here = self.location.href.replace(/[^/]*$/, "");
self.exports = {};
importScripts(here + "chess.js", here + "ort.wasm.min.js");

ort.env.wasm.wasmPaths = here;
ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;

const RATING_MIN = 600;
const RATING_MAX = 2600;
const MOVE_COUNT = 4352;
const PIECES = "PNBRQKpnbrqk";

let session = null;
let loadError = null;
let readyWaiting = false;
const options = { multipv: 1, limit: false, elo: 1500, oppo: 0 };
let board = new Chess();
let searching = Promise.resolve();

const say = (line) => postMessage(line);

// Board seen from White's side.
const flipSquare = (sq) => sq[0] + (9 - Number(sq[1]));
const flipMove = (uci) => flipSquare(uci.slice(0, 2)) + flipSquare(uci.slice(2, 4)) + uci.slice(4);

function moveIndex(uci) {
  const sq = (s) => (s.charCodeAt(0) - 97) + (Number(s[1]) - 1) * 8;
  if (uci.length === 4) return sq(uci.slice(0, 2)) * 64 + sq(uci.slice(2, 4));
  // promotions
  return 4096 + ((uci.charCodeAt(0) - 97) * 8 + (uci.charCodeAt(2) - 97)) * 4 + "qrbn".indexOf(uci[4]);
}

function tokens(chess, out, offset) {
  const black = chess.turn() === "b";
  const rows = chess.fen().split(" ")[0].split("/");
  for (let r = 0; r < 8; r++) {
    let file = 0;
    for (const ch of rows[r]) {
      if (ch >= "1" && ch <= "8") {
        file += Number(ch);
        continue;
      }
      let rank = 7 - r;
      let piece = PIECES.indexOf(ch);
      if (black) {
        rank = 7 - rank;
        piece = (piece + 6) % 12;
      }
      out[offset + (rank * 8 + file) * 12 + piece] = 1;
      file++;
    }
  }
}

const uciOf = (m) => m.from + m.to + (m.promotion || "");

// Value head (loss, draw, win logits) as probabilities.
function probabilities(l, d, w) {
  const top = Math.max(l, d, w);
  const [el, ed, ew] = [l, d, w].map((x) => Math.exp(x - top));
  const sum = el + ed + ew;
  return [el / sum, ed / sum, ew / sum];
}

// Win chance as centipawns, on the panel's win-chance curve.
function centipawns([l, d, w]) {
  const p = Math.min(0.999, Math.max(0.001, w + 0.5 * d));
  return Math.round(Math.log(p / (1 - p)) / 0.00368208);
}

// Short forced mates (Maia has no search). Throws OUT_OF_TIME after the deadline.
const OUT_OF_TIME = {};
let deadline = 0;

// Side to move mates within n moves.
function canMate(c, n) {
  const moves = c.moves({ verbose: true });
  if (moves.some((m) => m.san.endsWith("#"))) return true;
  if (n <= 1) return false;
  moves.sort((a, b) => /\+/.test(b.san) - /\+/.test(a.san));
  for (const m of moves) {
    if (performance.now() > deadline) throw OUT_OF_TIME;
    c.move(m);
    const ok = mustLose(c, n - 1);
    c.undo();
    if (ok) return true;
  }
  return false;
}

// Side to move is mated within n moves of the other side, whatever it plays.
function mustLose(c, n) {
  const replies = c.moves({ verbose: true });
  if (!replies.length) return c.inCheck();
  for (const r of replies) {
    c.move(r);
    const ok = canMate(c, n);
    c.undo();
    if (!ok) return false;
  }
  return true;
}

// Mate scores for the ranked moves: "mate 3" we mate, "mate -2" they mate.
function findMates(after, ms) {
  const found = after.map((c) => (c.isCheckmate() ? 1 : 0));
  deadline = performance.now() + ms;
  try {
    for (let n = 1; n <= 3; n++) {
      after.forEach((c, i) => {
        if (found[i] || c.isGameOver()) return;
        if (n > 1 && mustLose(c, n - 1)) found[i] = n;
        else if (canMate(c, n)) found[i] = -n;
      });
    }
  } catch (e) {
    if (e !== OUT_OF_TIME) throw e;
  }
  return found;
}

async function infer(positions, self, oppo) {
  const n = positions.length;
  const data = new Float32Array(n * 64 * 12);
  positions.forEach((chess, i) => tokens(chess, data, i * 64 * 12));
  const out = await session.run({
    tokens: new ort.Tensor("float32", data, [n, 64, 12]),
    elo_self: new ort.Tensor("float32", new Float32Array(n).fill(self), [n]),
    elo_oppo: new ort.Tensor("float32", new Float32Array(n).fill(oppo), [n]),
  });
  return { moves: out.logits_move.data, values: out.logits_value.data };
}

async function go(board) {
  const t0 = performance.now();
  const legal = board.moves({ verbose: true });
  if (!legal.length) {
    say(board.inCheck() ? "info depth 0 score mate 0" : "info depth 0 score cp 0");
    say("bestmove (none)");
    return;
  }
  const clamp = (v) => Math.min(RATING_MAX, Math.max(RATING_MIN, v));
  const rating = options.limit ? clamp(options.elo) : RATING_MAX;
  const oppo = options.oppo ? clamp(options.oppo) : rating;
  const black = board.turn() === "b";
  const root = await infer([board], rating, oppo);
  const logits = legal.map((m) => root.moves[moveIndex(black ? flipMove(uciOf(m)) : uciOf(m))]);
  const top = Math.max(...logits);
  const sum = logits.reduce((s, x) => s + Math.exp(x - top), 0);
  const ranked = legal
    .map((m, i) => ({ move: m, share: Math.exp(logits[i] - top) / sum }))
    .sort((a, b) => b.share - a.share)
    .slice(0, Math.max(1, Math.min(options.multipv, legal.length)));

  const after = ranked.map(({ move }) => {
    const c = new Chess(board.fen());
    c.move(move);
    return c;
  });
  const live = after.filter((c) => !c.isGameOver());
  const values = live.length ? (await infer(live, oppo, rating)).values : [];
  const mates = findMates(after, 300);
  const ms = Math.max(1, Math.round(performance.now() - t0));
  let k = 0;
  ranked.forEach(({ move, share }, i) => {
    const c = after[i];
    let score, wdl;
    if (!c.isGameOver()) k++;
    if (mates[i]) (score = "mate " + mates[i]), (wdl = mates[i] > 0 ? [1, 0, 0] : [0, 0, 1]);
    else if (c.isGameOver()) (score = "cp 0"), (wdl = [0, 1, 0]);
    else {
      const j = k - 1;
      const [theirL, d, theirW] = probabilities(values[j * 3], values[j * 3 + 1], values[j * 3 + 2]);
      wdl = [theirL, d, theirW];
      score = "cp " + centipawns([theirW, d, theirL]);
    }
    const permille = wdl.map((x) => Math.round(x * 1000)).join(" ");
    say(`info depth 1 seldepth 1 multipv ${i + 1} score ${score} wdl ${permille} nodes ${ranked.length + 1} time ${ms} share ${(share * 100).toFixed(1)} pv ${uciOf(move)}`);
  });
  say(`bestmove ${uciOf(ranked[0].move)}`);
}

function position(args) {
  const words = args.trim().split(/\s+/);
  const at = words.indexOf("moves");
  const head = at < 0 ? words : words.slice(0, at);
  const fen = head[0] === "fen" ? head.slice(1).join(" ") : undefined;
  try {
    board = fen ? new Chess(fen) : new Chess();
  } catch (e) {
    board = new Chess(fen, { skipValidation: true });
  }
  for (const uci of at < 0 ? [] : words.slice(at + 1)) {
    try {
      board.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    } catch (e) {
      break;
    }
  }
}

function setoption(args) {
  const m = /^name\s+(.+?)(?:\s+value\s+(.*))?$/i.exec(args.trim());
  if (!m) return;
  const name = m[1].toLowerCase();
  const value = (m[2] || "").trim();
  if (name === "multipv") options.multipv = Math.max(1, Math.min(64, parseInt(value, 10) || 1));
  else if (name === "uci_limitstrength") options.limit = value === "true";
  else if (name === "uci_elo") options.elo = parseInt(value, 10) || options.elo;
  else if (name === "opponent elo") options.oppo = parseInt(value, 10) || 0;
}

const loading = (async () => {
  try {
    const bytes = await (await fetch(here + "maia3_simplified.onnx")).arrayBuffer();
    session = await ort.InferenceSession.create(bytes, { graphOptimizationLevel: "basic", executionProviders: ["wasm"] });
  } catch (e) {
    loadError = String((e && e.message) || e);
    say("info string Maia did not start: " + loadError);
  }
  if (readyWaiting && session) say("readyok");
})();

self.onmessage = (e) => {
  for (const line of String(e.data).split("\n")) {
    const [cmd, ...rest] = line.trim().split(/\s+/);
    const args = rest.join(" ");
    if (cmd === "uci") {
      say("id name Maia 3");
      say("id author CSSLab, University of Toronto");
      say(`option name MultiPV type spin default 1 min 1 max 64`);
      say(`option name UCI_LimitStrength type check default false`);
      say(`option name UCI_Elo type spin default 1500 min ${RATING_MIN} max ${RATING_MAX}`);
      say(`option name Opponent Elo type spin default 0 min 0 max ${RATING_MAX}`);
      say("uciok");
    } else if (cmd === "isready") {
      if (session) say("readyok");
      else if (!loadError) readyWaiting = true;
    } else if (cmd === "setoption") setoption(args);
    else if (cmd === "position") position(args);
    else if (cmd === "go") {
      const at = board;
      searching = searching.then(() => loading).then(() => (session ? go(at) : say("bestmove (none)"))).catch((err) => {
        say("info string Maia failed: " + ((err && err.message) || err));
        say("bestmove (none)");
      });
    }
  }
};
