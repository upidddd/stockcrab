// StockCrab: Stockfish move hints on chess.com and lichess.org. The engine runs in background.js.
const LOGO_SVG = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" width=\"22\" height=\"22\"><line x1=\"17\" y1=\"41\" x2=\"6\" y2=\"46\" stroke-width=\"3.2\" stroke=\"#a8341a\" stroke-linecap=\"round\" fill=\"none\"/><line x1=\"16\" y1=\"45\" x2=\"8\" y2=\"54\" stroke-width=\"3.2\" stroke=\"#a8341a\" stroke-linecap=\"round\" fill=\"none\"/><line x1=\"19\" y1=\"48\" x2=\"14\" y2=\"58\" stroke-width=\"3.2\" stroke=\"#a8341a\" stroke-linecap=\"round\" fill=\"none\"/><line x1=\"18\" y1=\"34\" x2=\"11\" y2=\"25\" stroke-width=\"4.5\" stroke=\"#a8341a\" stroke-linecap=\"round\" fill=\"none\"/><path d=\"M10.00 18.50L18.37 17.02A8.5 8.5 0 1 1 11.48 10.13Z\" fill=\"#e4572e\" stroke=\"#a8341a\" stroke-width=\"1.6\" stroke-linejoin=\"round\"/><line x1=\"47\" y1=\"41\" x2=\"58\" y2=\"46\" stroke-width=\"3.2\" stroke=\"#a8341a\" stroke-linecap=\"round\" fill=\"none\"/><line x1=\"48\" y1=\"45\" x2=\"56\" y2=\"54\" stroke-width=\"3.2\" stroke=\"#a8341a\" stroke-linecap=\"round\" fill=\"none\"/><line x1=\"45\" y1=\"48\" x2=\"50\" y2=\"58\" stroke-width=\"3.2\" stroke=\"#a8341a\" stroke-linecap=\"round\" fill=\"none\"/><line x1=\"46\" y1=\"34\" x2=\"53\" y2=\"25\" stroke-width=\"4.5\" stroke=\"#a8341a\" stroke-linecap=\"round\" fill=\"none\"/><path d=\"M54.00 18.50L45.63 17.02A8.5 8.5 0 1 0 52.52 10.13Z\" fill=\"#e4572e\" stroke=\"#a8341a\" stroke-width=\"1.6\" stroke-linejoin=\"round\"/><line x1=\"26\" y1=\"29\" x2=\"25\" y2=\"21\" stroke-width=\"2.6\" stroke=\"#a8341a\" stroke-linecap=\"round\" fill=\"none\"/><line x1=\"38\" y1=\"29\" x2=\"39\" y2=\"21\" stroke-width=\"2.6\" stroke=\"#a8341a\" stroke-linecap=\"round\" fill=\"none\"/><ellipse cx=\"32\" cy=\"40\" rx=\"19.5\" ry=\"13.5\" fill=\"#e4572e\" stroke=\"#a8341a\" stroke-width=\"1.8\"/><circle cx=\"25\" cy=\"19.5\" r=\"4.2\" fill=\"#ffffff\" stroke=\"#a8341a\" stroke-width=\"1.2\"/><circle cx=\"25\" cy=\"20.1\" r=\"1.9\" fill=\"#1c1c1c\"/><circle cx=\"39\" cy=\"19.5\" r=\"4.2\" fill=\"#ffffff\" stroke=\"#a8341a\" stroke-width=\"1.2\"/><circle cx=\"39\" cy=\"20.1\" r=\"1.9\" fill=\"#1c1c1c\"/></svg>";
const PANEL_ID = "stockcrab-panel";
const MARK = "stockcrab-mark";
const FILES = "abcdefgh";
const SITE = location.hostname.endsWith("lichess.org") ? "lichess" : "chesscom";
// While a piece is in the user's hand the board is in an in-between state (the piece is off its square, its
// origin may be highlighted). Nothing is read or recalculated until it is dropped.
let pointerDown = false;
let pointerAt = 0; // when the button went down: a pointerup that never arrives (released outside the window) expires
let releasedAt = 0;
document.addEventListener("pointerdown", (e) => {
  const b = getBoard();
  if (b && e.composedPath && e.composedPath().includes(b)) {
    pointerDown = true;
    pointerAt = Date.now();
  }
}, true);
const release = () => {
  if (pointerDown) releasedAt = Date.now();
  pointerDown = false;
};
for (const ev of ["pointerup", "pointercancel", "dragend", "mouseup"]) document.addEventListener(ev, release, true);
window.addEventListener("blur", release);
const isHolding = (board) =>
  (pointerDown && Date.now() - pointerAt < 20000) || Date.now() - releasedAt < 200 || !!(board.querySelector && board.querySelector(".dragging, .piece.dragging, piece.dragging"));

// chess.com: the big board of the game (a page can also hold small boards: a puzzle, a preview, the opponent's profile)
function chesscomBoard() {
  let best = null;
  let area = 0;
  document.querySelectorAll("wc-chess-board, chess-board").forEach((b) => {
    const r = b.getBoundingClientRect();
    if (r.width * r.height > area) {
      area = r.width * r.height;
      best = b;
    }
  });
  return best || document.querySelector("wc-chess-board, chess-board");
}
const getBoard = () => (SITE === "lichess" ? lichessBoard() : chesscomBoard());

const DEFAULTS = {
  enabled: false,
  collapsed: false,
  // engine
  elo: 3190,
  movetime: 6000,
  depth: 0, // 0 = no depth limit, only the time
  aggression: 0, // any value above 0 gives up a little strength for sharper play
  hash: 128,
  side: "auto", // which colour I play: auto-detect, "w" / "b" if it is detected wrongly, or "turn": whoever is to move (analysis)
  model: "sf19-full", // which engine model runs (see MODEL_OPTIONS)
  // moves
  others: 2, // extra good moves next to the best one (0 = strongest search)
  goodWithin: 50, // an extra move is "good" if it is at most this many centipawns behind the best
  scoreUnits: "pawns",
  showList: true,
  // premove
  premove: true,
  premoveMode: "smart", // "smart" = only when it is worth it (saves time); "likely" = always, just in case; "safe" = only if no move can spoil it
  obviousLead: 80, // "smart": they almost certainly play one move if it is this many cp better than their next best
  replyGap: 20, // "smart": our reply must beat our second choice by this much, otherwise it needs thought
  pawnTrade: true, // they can take my pawn with a pawn and another pawn of mine can retake: premove the retake
  tradeTolerance: 100, // ...unless the retake is this many cp worse than the best reply
  likelyCount: 4, // how many of their likely moves are checked (the first one decides the premove)
  likelyWithin: 100, // a move is "likely" if it is at most this many centipawns behind their best
  safeGap: 25, // "safe" style: our best reply must beat our second choice by this much after every move
  premovePer: 240, // ms spent on each opponent reply
  // look
  colourBest: "#e4572e", // the StockCrab brand colour, like the outlines, the panel and the logo
  colourAlt: "#e4572e", // other moves: same colour, drawn thinner and fainter
  colourPremove: "#00b8d4", // premoves are cyan: arrow, score and square outlines
  colourOutline: "#e4572e",
  lineWidth: 100,
  opacity: 70, // the hints are slightly see-through
  blur: 4, // px of blur under the outline and the arrow (frosted glass); 0 = off
  showOutline: true,
  showHead: true,
  showLabels: true,
  showIcon: true, // the real icon of the kind of move on the cell (Brilliant, Great, Best ...)
  ratePlayed: true, // after my move: rate the move I played (Excellent, Good, Mistake ...) on its target cell
  showQuality: true, // Best / Great ! / Brilliant !! ... on the target cell
  showSquare: false, // the target cell's name in the card (off by default: the position already says it)
  version: 3, // settings layout version, for migrating saved values
  animate: true, // short appearance animations for new hints
  // panel
  corner: "br",
  hotkey: true,
  sections: { engine: true, moves: false, premove: false, look: false, panel: false },
};
let settings = JSON.parse(JSON.stringify(DEFAULTS));
let lastKey = null;
let candidateKey = null;
let requestId = 0;
let keepAlive = null;
let failures = 0; // consecutive failed engine requests: the next try waits longer
let retryAt = 0;
let current = null; // { marks, size } of what is drawn right now
let lastView = null; // { mine, res } the latest engine answer, so look-only settings can redraw it

try {
  browser.storage.local.get("stockcrab").then((r) => {
    if (r.stockcrab) {
      const saved = { ...r.stockcrab };
      if (saved.engine && !saved.model) saved.model = saved.engine === "lite" ? "sf19-lite" : "sf19-full"; // pre-model saves
      delete saved.engine;
      if (saved.colourBest === "#1f9d3a") delete saved.colourBest; // old default green
      if (saved.colourAlt === "#2f6fdd") delete saved.colourAlt; // old default blue
      if ((saved.version || 1) < 3 && saved.opacity === 90) delete saved.opacity; // the old default; hints are now more transparent
      if ((saved.version || 1) < 2) delete saved.showSquare; // the card used to show the cell name by default; it is now off
      if (saved.colourPremove === "#d62828") delete saved.colourPremove; // old default red
      Object.assign(settings, saved, { enabled: false });
      settings.version = DEFAULTS.version; // migrated: the next load must not redo the resets above
      settings.sections = { ...DEFAULTS.sections, ...(r.stockcrab.sections || {}) };
      try {
        for (const c of CONTROLS) {
          // a saved value of the wrong type or outside the slider's range must not break the panel or the engine request
          if (c.type === "range" && !(Number.isFinite(settings[c.key]) && settings[c.key] >= c.min && settings[c.key] <= c.max)) {
            settings[c.key] = Math.min(c.max, Math.max(c.min, Number.isFinite(Number(settings[c.key])) ? Number(settings[c.key]) : DEFAULTS[c.key]));
          }
        }
      } catch (e) {}
    }
    syncPanel();
  });
} catch (e) {}

function save() {
  try {
    browser.storage.local.set({ stockcrab: settings });
  } catch (e) {}
}

// Which colour is at the bottom of the board? The site's own orientation flag decides. The pieces' heights are
// only a cross-check, and only while many pieces are on the board: in an endgame the average height of a side's
// few pieces says very little (it can even point the wrong way), which used to flip "who is who".
function chooseBottom(flag, items) {
  const white = items.filter((i) => i.white);
  const black = items.filter((i) => !i.white);
  if (items.length >= 20 && white.length && black.length) {
    const avg = (a) => a.reduce((sum, i) => sum + i.y, 0) / a.length;
    const geo = avg(white) > avg(black) ? "w" : "b";
    if (geo !== flag) return geo;
  }
  return flag;
}

// The colour the user plays: the manual choice, else chess.com's own "playing as", else the colour at the bottom.
function myColour(board) {
  if (settings.side === "w" || settings.side === "b") return settings.side;
  try {
    const p = board.wrappedJSObject?.game?.getPlayingAs?.();
    if (p === 1) return "w";
    if (p === 2) return "b";
  } catch (e) {}
  return bottomColour(board);
}

function bottomColour(board) {
  if (SITE === "lichess") return lichessBottom(board);
  const items = [];
  board.querySelectorAll(".piece").forEach((el) => {
    if (el.classList.contains("dragging")) return;
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    const cls = [...el.classList];
    if (cls.some((c) => /^w[pnbrqk]$/.test(c))) items.push({ white: true, y: r.top + r.height / 2 });
    else if (cls.some((c) => /^b[pnbrqk]$/.test(c))) items.push({ white: false, y: r.top + r.height / 2 });
  });
  return chooseBottom(board.classList.contains("flipped") ? "b" : "w", items);
}

let fenSource = "?";
let turnMemory = { placement: null, turn: null, ep: "-" }; // the last position whose side to move was known for sure
let lichessTurn = null; // same for lichess: { placement, turn }
let lastRead = ""; // what was read from the page ("source · FEN"), shown when the mouse rests on the status line

// En passant target after a two-square pawn push (from -> to), but only if an enemy pawn could capture.
// Squares are chess.com style "52" or algebraic "e2".
function epTarget(bySq, from, to) {
  const norm = (q) => (/^\d\d$/.test(q) ? [Number(q[0]) - 1, Number(q[1])] : [FILES.indexOf(q[0]), Number(q[1])]);
  const [f1, r1] = norm(from);
  const [f2, r2] = norm(to);
  const key = (f, r) => (/^\d\d$/.test(to) ? `${f + 1}${r}` : FILES[f] + r);
  const piece = bySq[to];
  if (!piece || piece.toLowerCase() !== "p" || f1 !== f2 || Math.abs(r2 - r1) !== 2) return "-";
  const enemyPawn = piece === "P" ? "p" : "P";
  const side = [f2 - 1, f2 + 1].some((f) => f >= 0 && f < 8 && bySq[key(f, r2)] === enemyPawn);
  return side ? FILES[f1] + (r1 + r2) / 2 : "-";
}

function injectPageScript() {
  if (SITE !== "chesscom") return;
  const s = document.createElement("script");
  s.textContent = `setInterval(() => {
    document.querySelectorAll("wc-chess-board, chess-board").forEach((b) => {
      try {
        const f = b.game && b.game.getFEN && b.game.getFEN();
        if (typeof f === "string") {
          b.setAttribute("data-sp-fen", f);
          b.setAttribute("data-sp-ts", String(Date.now()));
        }
      } catch (e) {}
    });
  }, 150);`;
  (document.head || document.documentElement).appendChild(s);
  s.remove();
}
injectPageScript();

// How many squares differ between two FEN placements.
// ---- is the position legal? A misread side to move shows up as the side NOT to move having its king attacked.
function boardOf(fen) {
  const map = {};
  fen.split(" ")[0].split("/").forEach((row, i) => {
    let f = 0;
    for (const c of row) {
      if (/\d/.test(c)) f += Number(c);
      else map[FILES[f++] + (8 - i)] = c;
    }
  });
  return map;
}

// Is the square (file 0-7, rank 1-8) attacked by the given side?
function isAttacked(map, file, rank, byWhite) {
  // null = an empty square, undefined = off the board
  const at = (f, r) => (f >= 0 && f < 8 && r >= 1 && r <= 8 ? (map[FILES[f] + r] ?? null) : undefined);
  const mine = (p) => p && (p === p.toUpperCase()) === byWhite;
  const pawnRank = rank + (byWhite ? -1 : 1);
  for (const df of [-1, 1]) if (at(file + df, pawnRank) === (byWhite ? "P" : "p")) return true;
  for (const [df, dr] of [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]) {
    if (at(file + df, rank + dr) === (byWhite ? "N" : "n")) return true;
  }
  for (let df = -1; df <= 1; df++) for (let dr = -1; dr <= 1; dr++) {
    if ((df || dr) && at(file + df, rank + dr) === (byWhite ? "K" : "k")) return true;
  }
  for (const [df, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const straight = df === 0 || dr === 0;
    for (let k = 1; k < 8; k++) {
      const p = at(file + df * k, rank + dr * k);
      if (p === undefined) break;
      if (p) {
        const t = p.toLowerCase();
        if (mine(p) && (t === "q" || (straight ? t === "r" : t === "b"))) return true;
        break;
      }
    }
  }
  return false;
}

// For positions read from the screen: if the side to move is wrong (the other side's king is in check, which
// cannot happen), flip it. Returns { fen, ok, flipped }. A position where both kings are attacked is not legal.
function sanitiseFen(fen) {
  const parts = fen.split(" ");
  const map = boardOf(fen);
  const kings = Object.entries(map).filter(([, p]) => p === "K" || p === "k");
  const wk = kings.find(([, p]) => p === "K");
  const bk = kings.find(([, p]) => p === "k");
  if (!wk || !bk || kings.length !== 2) return { fen, ok: false };
  const xy = (e) => [FILES.indexOf(e[0][0]), Number(e[0][1])];
  const whiteInCheck = isAttacked(map, ...xy(wk), false);
  const blackInCheck = isAttacked(map, ...xy(bk), true);
  const whiteToMove = parts[1] === "w";
  const otherInCheck = whiteToMove ? blackInCheck : whiteInCheck;
  const moverInCheck = whiteToMove ? whiteInCheck : blackInCheck;
  if (!otherInCheck) return { fen, ok: true, flipped: false };
  if (moverInCheck) return { fen, ok: false };
  parts[1] = whiteToMove ? "b" : "w";
  parts[3] = "-"; // a stale en passant square belongs to the other side
  return { fen: parts.join(" "), ok: true, flipped: true };
}

function placementDiff(a, b) {
  const expand = (p) => p.replace(/\d/g, (n) => ".".repeat(Number(n))).replace(/\//g, "");
  const x = expand(a);
  const y = expand(b);
  if (x.length !== 64 || y.length !== 64) return 64;
  let d = 0;
  for (let k = 0; k < 64; k++) if (x[k] !== y[k]) d++;
  return d;
}

// The game's own position wins. What is drawn can legitimately differ from it by a few squares: a piece in
// the user's hand, or a premove shown on the board. Only a position that is far off is treated as stale.
const MAX_DRAWN_DIFF = 4;
function readFen(board) {
  if (SITE === "lichess") {
    fenSource = "lichess";
    return lichessFen(board);
  }
  const dom = domFen(board);
  const placement = dom.split(" ")[0];
  const candidates = [];
  try {
    const fen = board.wrappedJSObject?.game?.getFEN?.(); // read live, so it cannot be stale
    if (typeof fen === "string") candidates.push(["game", String(fen)]);
  } catch (e) {}
  const attr = board.getAttribute("data-sp-fen");
  const stamp = Number(board.getAttribute("data-sp-ts"));
  if (attr && Date.now() - stamp < 600) candidates.push(["page", attr]);
  for (const [source, fen] of candidates) {
    if (fen.split(" ").length >= 4 && placementDiff(fen.split(" ")[0], placement) <= MAX_DRAWN_DIFF) {
      fenSource = source;
      return fen;
    }
  }
  fenSource = "dom";
  return dom;
}

function domFen(board) {
  const grid = Array.from({ length: 8 }, () => Array(8).fill(null));
  const bySquare = {};
  board.querySelectorAll(".piece").forEach((el) => {
    let sq = null;
    let type = null;
    for (const c of el.classList) {
      if (/^square-\d\d$/.test(c)) sq = c.slice(7);
      else if (/^[wb][pnbrqk]$/.test(c)) type = c;
    }
    if (!sq || !type) return;
    const file = Number(sq[0]) - 1;
    const rank = Number(sq[1]) - 1;
    const ch = type[0] === "w" ? type[1].toUpperCase() : type[1];
    grid[7 - rank][file] = ch;
    bySquare[sq] = ch;
  });
  const rows = grid.map((row) => {
    let out = "";
    let empty = 0;
    for (const c of row) {
      if (c) {
        if (empty) out += empty;
        empty = 0;
        out += c;
      } else empty++;
    }
    return out + (empty || "");
  });

  // The last move highlights exactly two squares. A third highlighted square is the piece the user has
  // selected, which must not be mistaken for the opponent's last move.
  const lit = [];
  board.querySelectorAll(".highlight").forEach((el) => {
    if (el.classList.contains(MARK)) return;
    for (const c of el.classList) {
      const sq = /^square-(\d\d)$/.exec(c)?.[1];
      if (sq && !lit.includes(sq)) lit.push(sq);
    }
  });
  const placement = rows.join("/");
  let turn = null;
  let ep = "-";
  if (lit.length === 2) {
    const mover = lit.map((q) => bySquare[q]).find(Boolean);
    if (mover) {
      turn = mover === mover.toUpperCase() ? "b" : "w";
      const from = lit.find((q) => !bySquare[q]);
      const to = lit.find((q) => bySquare[q]);
      if (from && to) ep = epTarget(bySquare, from, to);
    }
    if (turn) turnMemory = { placement, turn, ep };
  } else if (turnMemory.placement === placement) {
    turn = turnMemory.turn; // the same position as a moment ago (e.g. a piece is selected): keep what we knew
    ep = turnMemory.ep;
  }
  if (!turn) turn = bottomColour(board);

  let castle = "";
  if (bySquare["51"] === "K") {
    if (bySquare["81"] === "R") castle += "K";
    if (bySquare["11"] === "R") castle += "Q";
  }
  if (bySquare["58"] === "k") {
    if (bySquare["88"] === "r") castle += "k";
    if (bySquare["18"] === "r") castle += "q";
  }
  return `${placement} ${turn} ${castle || "-"} ${ep} 0 1`;
}

// ---- lichess.org (chessground) ----

function lichessBoard() {
  let best = null;
  let area = 0;
  document.querySelectorAll(".cg-wrap").forEach((w) => {
    const r = w.getBoundingClientRect();
    if (r.width * r.height > area) {
      area = r.width * r.height;
      best = w;
    }
  });
  return best;
}

const LICHESS_ROLE = { pawn: "p", knight: "n", bishop: "b", rook: "r", queen: "q", king: "k" };

function lichessBottom(wrap) {
  const items = [];
  const cg = wrap.querySelector("cg-board");
  if (cg) {
    cg.querySelectorAll("piece").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (!r.width || el.classList.contains("dragging")) return;
      if (el.classList.contains("white")) items.push({ white: true, y: r.top + r.height / 2 });
      else if (el.classList.contains("black")) items.push({ white: false, y: r.top + r.height / 2 });
    });
  }
  return chooseBottom(wrap.classList.contains("orientation-black") ? "b" : "w", items);
}

function lichessSquareOf(el, cgRect, size, orientation) {
  const r = el.getBoundingClientRect();
  if (!r.width) return null;
  const col = Math.floor((r.left + r.width / 2 - cgRect.left) / size);
  const row = Math.floor((r.top + r.height / 2 - cgRect.top) / size);
  if (col < 0 || col > 7 || row < 0 || row > 7) return null;
  const file = orientation === "w" ? col : 7 - col;
  const rank = orientation === "w" ? 8 - row : row + 1;
  return FILES[file] + rank;
}

function lichessFen(wrap) {
  const cg = wrap.querySelector("cg-board");
  if (!cg) return "8/8/8/8/8/8/8/8 w - - 0 1";
  const cgRect = cg.getBoundingClientRect();
  const size = cgRect.width / 8;
  const bottom = bottomColour(wrap);
  const at = {};
  cg.querySelectorAll("piece").forEach((el) => {
    const cl = el.classList;
    if (cl.contains("dragging") || cl.contains("fading")) return;
    const colour = cl.contains("white") ? "w" : cl.contains("black") ? "b" : null;
    const role = [...cl].map((c) => LICHESS_ROLE[c]).find(Boolean);
    const sq = colour && role && lichessSquareOf(el, cgRect, size, bottom);
    if (sq) at[sq] = colour === "w" ? role.toUpperCase() : role;
  });

  const rows = [];
  for (let rank = 8; rank >= 1; rank--) {
    let row = "";
    let empty = 0;
    for (const f of FILES) {
      const p = at[f + rank];
      if (p) {
        if (empty) row += empty;
        empty = 0;
        row += p;
      } else empty++;
    }
    rows.push(row + (empty || ""));
  }
  const placement = rows.join("/");

  let turn = null;
  let ep = "-";
  const lit = [];
  cg.querySelectorAll("square.last-move").forEach((el) => {
    const sq = lichessSquareOf(el, cgRect, size, bottom);
    if (sq && !lit.includes(sq)) lit.push(sq);
    const p = sq && at[sq];
    if (p) turn = p === p.toUpperCase() ? "b" : "w";
  });
  if (lit.length === 2) {
    const from = lit.find((q) => !at[q]);
    const to = lit.find((q) => at[q]);
    if (from && to) ep = epTarget(at, from, to);
  }
  if (!turn && lichessTurn) {
    // no highlight (lichess lets the player switch it off): the same position as before, or one move later
    if (lichessTurn.placement === placement) turn = lichessTurn.turn;
    else {
      const next = lichessTurn.turn === "w" ? "b" : "w";
      if (inferPlayed(`${lichessTurn.placement} ${lichessTurn.turn} - - 0 1`, `${placement} ${next} - - 0 1`)) turn = next;
    }
  }
  if (!turn) {
    const running = document.querySelector(".rclock.running");
    if (running) turn = running.classList.contains("rclock-bottom") ? bottom : bottom === "w" ? "b" : "w";
  }
  if (!turn && placement === "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR") turn = "w";
  if (turn) lichessTurn = { placement, turn }; // known: remember it for the positions that follow
  else turn = bottom; // a guess, not remembered

  let castle = "";
  if (at.e1 === "K") {
    if (at.h1 === "R") castle += "K";
    if (at.a1 === "R") castle += "Q";
  }
  if (at.e8 === "k") {
    if (at.h8 === "r") castle += "k";
    if (at.a8 === "r") castle += "q";
  }
  return `${placement} ${turn} ${castle || "-"} ${ep} 0 1`;
}

// Раньше здесь были ограничения для Lichess. Теперь разрешаем везде:
function lichessAllowed() {
  return true;
}

const fading = new WeakSet();

// Removes the drawn hint. With `fade` it dissolves for ~140 ms first (when animations are on).
function clearMarks(fade = false) {
  const soft = fade && settings.animate && !reducedMotion();
  document.querySelectorAll("." + MARK).forEach((el) => {
    if (fading.has(el)) return;
    if (soft && el.animate) {
      fading.add(el);
      try {
        const a = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, easing: "ease-in", fill: "forwards" });
        a.onfinish = () => el.remove();
        setTimeout(() => el.remove(), 400); // safety net if the animation never reports back
        return;
      } catch (e) {}
    }
    el.remove();
  });
}

const SVG_NS = "http://www.w3.org/2000/svg";
const svgEl = (name, attrs) => {
  const el = document.createElementNS(SVG_NS, name);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
};

const colourOf = (kind) => ({ best: settings.colourBest, alt: settings.colourAlt, premove: settings.colourPremove })[kind];

function squareRect(board, sq, boardRect) {
  if (SITE === "lichess") {
    const r = (board.querySelector("cg-board") || board).getBoundingClientRect();
    const size = r.width / 8;
    const white = bottomColour(board) === "w";
    const f = FILES.indexOf(sq[0]);
    const rank = Number(sq[1]);
    return {
      x: r.left - boardRect.left + (white ? f : 7 - f) * size,
      y: r.top - boardRect.top + (white ? 8 - rank : rank - 1) * size,
      w: size,
      h: size,
    };
  }
  const probe = document.createElement("div");
  probe.className = `highlight ${MARK} square-${FILES.indexOf(sq[0]) + 1}${sq[1]}`;
  probe.style.cssText = "visibility:hidden;pointer-events:none";
  board.appendChild(probe);
  const r = probe.getBoundingClientRect();
  probe.remove();
  if (!r.width || Math.abs(r.width / (boardRect.width / 8) - 1) > 0.12) {
    const size = boardRect.width / 8;
    const white = bottomColour(board) === "w";
    const f = FILES.indexOf(sq[0]);
    const rank = Number(sq[1]);
    return { x: (white ? f : 7 - f) * size, y: (white ? 8 - rank : rank - 1) * size, w: size, h: size };
  }
  return { x: r.left - boardRect.left, y: r.top - boardRect.top, w: r.width, h: r.height };
}

const FONT = '"Inter","SF Pro Text","Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';

// Short, simple appearance animations (Web Animations API). Skipped when the page asks for reduced motion.
const reducedMotion = () => {
  try {
    return matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {
    return false;
  }
};
function animateIn(el, frames, delay = 0, duration = 180) {
  if (!el || !el.animate) return;
  try {
    el.animate(frames, { duration, delay, easing: "cubic-bezier(.2,.7,.3,1)", fill: "backwards" });
  } catch (e) {}
}

// Black or white text, whichever reads better on a badge of this colour.
function textOn(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return "#fff";
  const n = parseInt(m[1], 16);
  const lin = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.34 ? "#1b1b1b" : "#fff";
}

// Arrows, square outlines and score badges as one SVG in the board's own pixel space.
// Every part can be switched off or restyled from the panel.
function drawMarks(board, marks, animate = false) {
  const anim = animate && settings.animate && !reducedMotion();
  clearMarks(anim);
  current = null;
  if (!marks.length) return;
  if (getComputedStyle(board).position === "static") board.style.position = "relative";
  const br = board.getBoundingClientRect();
  const svg = svgEl("svg", { class: MARK, width: br.width, height: br.height, viewBox: `0 0 ${br.width} ${br.height}` });
  svg.style.cssText = "position:absolute;left:0;top:0;pointer-events:none;z-index:20;overflow:visible";
  const k = settings.lineWidth / 100;
  const infos = []; // per move: the icon and the card to place on its target cell
  const allParts = []; // every arrow's polygons: the card and the icon keep clear of them

  // Frosted glass: SVG cannot blur what is behind it, so thin HTML layers with `backdrop-filter` sit under the
  // drawing, each clipped to the exact shape of an outline ring or an arrow. The pieces inside the cell stay sharp.
  const blurPx = settings.blur;
  const blurLayer = blurPx > 0 ? document.createElement("div") : null;
  if (blurLayer) {
    blurLayer.setAttribute("class", MARK);
    blurLayer.style.cssText = `position:absolute;left:0;top:0;width:${br.width}px;height:${br.height}px;pointer-events:none;z-index:19`;
  }
  const blurShape = (x, y, w, h, clip) => {
    if (!blurLayer) return;
    const d = document.createElement("div");
    d.style.cssText =
      `position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;` +
      `backdrop-filter:blur(${blurPx}px);-webkit-backdrop-filter:blur(${blurPx}px);clip-path:${clip}`;
    blurLayer.appendChild(d);
  };
  // "M x y L ... Z" for a polygon, always clockwise so that several polygons in one path add up (nonzero fill)
  const polyPath = (pts, ox, oy) => {
    let area = 0;
    pts.forEach(([x, y], i) => {
      const [nx, ny] = pts[(i + 1) % pts.length];
      area += x * ny - nx * y;
    });
    const p = area < 0 ? pts.slice().reverse() : pts;
    return "M" + p.map(([x, y]) => `${(x - ox).toFixed(2)} ${(y - oy).toFixed(2)}`).join("L") + "Z";
  };

  // Last in the list is drawn first, so the main move ends up on top.
  for (const m of marks.slice().reverse()) {
    const from = squareRect(board, m.move.slice(0, 2), br);
    const to = squareRect(board, m.move.slice(2, 4), br);
    if (!from.w || !to.w) continue;
    const played = m.kind === "played"; // the rating of the move I played: just the icon and the word, no outline or arrow
    const col = played ? m.cls.colour : colourOf(m.kind);
    const sq = from.w;
    const alt = m.kind === "alt";
    const op = (alt ? 0.68 : 1) * (settings.opacity / 100);
    // The outlines and the arrow of one move are ONE layer: the see-through is applied to the group as a whole,
    // so where the shaft meets the head, the round start of the line, or the arrow crosses an outline, nothing
    // gets darker (separately transparent pieces would show through each other).
    const shape = svgEl("g", { opacity: op });
    svg.appendChild(shape);

    if (settings.showOutline && !played) {
      const ow = sq * 0.04 * k;
      for (const r of [from, to]) {
        const outline = svgEl("rect", {
          x: r.x + ow / 2, y: r.y + ow / 2, width: r.w - ow, height: r.h - ow,
          fill: "none", stroke: m.kind === "premove" ? settings.colourPremove : settings.colourOutline, "stroke-width": ow, "stroke-linejoin": "miter",
        });
        shape.appendChild(outline);
        if (anim) animateIn(outline, [{ opacity: 0 }, { opacity: 1 }], 0, 160);
        // ring-shaped blur exactly as wide as the outline's own stroke: nothing outside the line is blurred
        const band = ow;
        blurShape(r.x, r.y, r.w, r.h, `path(evenodd, "M0 0H${r.w}V${r.h}H0ZM${band} ${band}V${r.h - band}H${r.w - band}V${band}Z")`);
      }
    }

    const fc = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
    const tc = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
    const len = Math.hypot(tc.x - fc.x, tc.y - fc.y);
    const arrowParts = []; // the polygons of this arrow (shaft and head), for the blur and to keep the card clear of it
    if (len && !played) {
      const ux = (tc.x - fc.x) / len;
      const uy = (tc.y - fc.y) / len;
      const lw = (alt ? sq * 0.05 : sq * 0.075) * k;
      const hl = settings.showHead ? Math.min(sq * 0.45, sq * (alt ? 0.22 : 0.27) * (0.6 + 0.4 * k)) : 0;
      const hw = hl * 0.6;
      const bx = tc.x - ux * hl; // where the head starts
      const by = tc.y - uy * hl;
      const x2 = bx + ux * hl * 0.2;
      const y2 = by + uy * hl * 0.2;
      const line = svgEl("line", {
        x1: fc.x, y1: fc.y, x2, y2, "stroke-linecap": "round",
        stroke: col, "stroke-width": lw,
      });
      shape.appendChild(line);
      if (anim) {
        // the line is drawn from the piece towards the target
        const L = Math.hypot(x2 - fc.x, y2 - fc.y);
        animateIn(line, [{ strokeDasharray: `${L}`, strokeDashoffset: L }, { strokeDasharray: `${L}`, strokeDashoffset: 0 }], 0, 200);
      }
      if (hl) {
        const tip = { x: tc.x - ux * sq * 0.03, y: tc.y - uy * sq * 0.03 };
        const headEl = svgEl("polygon", {
          points: `${tip.x},${tip.y} ${bx - uy * hw},${by + ux * hw} ${bx + uy * hw},${by - ux * hw}`,
          fill: col, stroke: col, "stroke-width": sq * 0.025, "stroke-linejoin": "round",
        });
        shape.appendChild(headEl);
        // the head appears just before the line reaches it, growing out of the tip
        if (anim) animateIn(headEl, [{ opacity: 0, transform: "scale(0.5)", transformOrigin: `${tip.x}px ${tip.y}px` }, { transform: "scale(1)", transformOrigin: `${tip.x}px ${tip.y}px` }], 120, 150);
      }
      // exactly the shape of the drawing: a strip as wide as the line, a triangle as big as the head
      const half = lw / 2;
      const back = lw / 2; // the line has a round cap at its start
      const sx = fc.x - ux * back;
      const sy = fc.y - uy * back;
      const shaft = [[sx - uy * half, sy + ux * half], [sx + uy * half, sy - ux * half], [x2 + uy * half, y2 - ux * half], [x2 - uy * half, y2 + ux * half]];
      arrowParts.push(shaft);
      if (hl) arrowParts.push([[tc.x - ux * sq * 0.03, tc.y - uy * sq * 0.03], [bx - uy * hw, by + ux * hw], [bx + uy * hw, by - ux * hw]]);
      if (blurLayer) {
        const xs = arrowParts.flat().map((p) => p[0]);
        const ys = arrowParts.flat().map((p) => p[1]);
        const ox = Math.min(...xs) - 1;
        const oy = Math.min(...ys) - 1;
        const w = Math.max(...xs) + 1 - ox;
        const h = Math.max(...ys) + 1 - oy;
        blurShape(ox, oy, w, h, `path("${arrowParts.map((pts) => polyPath(pts, ox, oy)).join("")}")`);
      }
    }

    // What goes on the target cell next to the arrow: the icon of the kind of move and one compact card (the score on
    // top, below it the kind of move: "Brilliant", "Great", "premove", and the cell's name if switched on). Both are
    // placed in the last pass, once the card's size is known, in a corner of the cell the arrow does not touch.
    const score = settings.showLabels && m.label ? m.label : "";
    const words = [settings.showSquare && m.move.slice(2, 4), settings.showQuality && qualityText(m.cls, !settings.showIcon), m.kind === "premove" && "premove"].filter(Boolean).join(" · ");
    const info = { to, sq, op, cls: settings.showIcon && m.cls ? m.cls : null, card: null };
    if (score || words) {
      const text = (str, fs, weight, extra = "") => {
        const t = svgEl("text", {
          "font-size": fs, "font-weight": weight, "font-family": FONT, fill: textOn(col), "dominant-baseline": "central",
          style: `font-variant-numeric:tabular-nums;letter-spacing:0.01em;${extra}`,
        });
        t.textContent = str;
        return t;
      };
      const card = svgEl("rect", { fill: col, opacity: Math.min(1, op + 0.05) });
      // the rating of a played move has no score: its word is the whole card, so it is set like a score
      const wordOnly = played && !score;
      const t1 = score ? text(score, sq * (alt ? 0.125 : 0.14), 700) : wordOnly ? text(words, sq * 0.12, 700) : null;
      const t2 = words && !wordOnly ? text(words, sq * 0.09, 500, "opacity:.92") : null;
      svg.appendChild(card);
      if (t1) svg.appendChild(t1);
      if (t2) svg.appendChild(t2);
      info.card = { card, t1, t2, fs1: wordOnly ? sq * 0.12 : sq * (alt ? 0.125 : 0.14), fs2: sq * 0.09 };
    }
    if (info.cls || info.card) infos.push(info);
    allParts.push(...arrowParts);
  }
  if (blurLayer) {
    board.appendChild(blurLayer); // under the drawing (z-index 19 < 20); the cards below add their shapes to it
    if (anim) animateIn(blurLayer, [{ opacity: 0 }, { opacity: 1 }], 0, 160);
  }
  board.appendChild(svg);

  // Place the icon and the card of every move. The card is sized to its text (measured once it is in the page,
  // estimated if that is impossible); if it is too wide for its row, both lines shrink together. They normally sit in
  // the top corners (card left, icon right); if an arrow runs through that spot they move to another corner of the
  // cell, the first arrangement that no arrow touches (otherwise the one touched least).
  const polyHitsRect = (poly, r) => {
    const inside = (p) => p[0] >= r.x && p[0] <= r.x + r.w && p[1] >= r.y && p[1] <= r.y + r.h;
    if (poly.some(inside)) return true;
    const rc = [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];
    const inPoly = (p) => {
      let c = false;
      for (let i = 0, k = poly.length - 1; i < poly.length; k = i++) {
        const [xi, yi] = poly[i];
        const [xk, yk] = poly[k];
        if (yi > p[1] !== yk > p[1] && p[0] < ((xk - xi) * (p[1] - yi)) / (yk - yi) + xi) c = !c;
      }
      return c;
    };
    if (rc.some(inPoly)) return true;
    const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const meets = (a, b, c, d) => cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0;
    for (let i = 0; i < poly.length; i++) {
      for (let k = 0; k < 4; k++) if (meets(poly[i], poly[(i + 1) % poly.length], rc[k], rc[(k + 1) % 4])) return true;
    }
    return false;
  };
  const GAPS = [0.05, 0.04, 0.03, 0.02, 0.01, 0]; // gaps to try, in cells: the card and the icon keep as much air from an arrow as possible
  const OPTIONS = [["TL", "TR"], ["BL", "BR"], ["TL", "BR"], ["BL", "TR"], ["TR", "TL"], ["BR", "BL"], ["TR", "BL"], ["BR", "TL"], ["TR", "BR"], ["BR", "TR"], ["TL", "BL"], ["BL", "TL"]];
  for (const c of infos) {
    const { to, sq } = c;
    const margin = sq * 0.1; // the card never touches the cell's walls
    const r = sq * 0.14;
    const im = sq * 0.08;
    // the card at full size
    let k = null;
    if (c.card) {
      const width = (t, fs) => {
        if (!t) return 0;
        let w;
        try {
          w = t.getComputedTextLength();
        } catch (e) {}
        return w || t.textContent.length * fs * 0.6;
      };
      const { t1, t2 } = c.card;
      const w = Math.max(width(t1, c.card.fs1), width(t2, c.card.fs2));
      k = { w, padX: c.card.fs1 * 0.4, padY: c.card.fs1 * 0.22, gap: t1 && t2 ? c.card.fs1 * 0.1 : 0, f: 1 };
      k.total = w + k.padX * 2;
    }
    const layouts = [];
    const corners = c.cls && k ? OPTIONS : c.cls ? [["", "TR"], ["", "BR"], ["", "TL"], ["", "BL"]] : [["TL", ""], ["BL", ""], ["BR", ""], ["TR", ""]];
    for (const [cc, ic, shrink = 1] of k ? corners.concat(corners.map(([a, b]) => [a, b, 0.8])) : corners) {
      let f = shrink; // a smaller card is the last resort when the arrow leaves little room
      let total = k ? k.total * f : 0;
      if (k) {
        // in the row of the icon the card ends a little before it, otherwise it may use the cell's width
        const sameRow = ic && cc[0] === ic[0];
        const maxW = sameRow ? to.w - im - r * 2 - sq * 0.04 - margin : to.w - margin * 2;
        if (total > maxW) {
          f *= maxW / total;
          total = maxW;
        }
      }
      const h = k ? k.padY * 2 * f + (c.card.t1 ? c.card.fs1 * f : 0) + (c.card.t2 ? c.card.fs2 * f : 0) + k.gap * f : 0;
      const cardRect = k ? { x: cc[1] === "L" ? to.x + margin : to.x + to.w - margin - total, y: cc[0] === "T" ? to.y + margin : to.y + to.h - margin - h, w: total, h } : null;
      const iconRect = ic ? { x: ic[1] === "L" ? to.x + im : to.x + to.w - im - r * 2, y: ic[0] === "T" ? to.y + im : to.y + to.h - im - r * 2, w: r * 2, h: r * 2 } : null;
      // how much air is there between the arrows and the card / the icon: the first (largest) gap that no arrow breaks
      const grow = (q, g) => ({ x: q.x - g, y: q.y - g, w: q.w + g * 2, h: q.h + g * 2 });
      let level = 0; // 0 = the full gap is free, GAPS.length = an arrow runs right through
      for (const q of [cardRect, iconRect]) {
        if (!q) continue;
        let i = 0;
        while (i < GAPS.length && allParts.some((poly) => polyHitsRect(poly, grow(q, GAPS[i] * sq)))) i++;
        level = Math.max(level, i);
      }
      layouts.push({ f, total, h, cardRect, iconRect, level });
    }
    const best = layouts.reduce((a, b) => (b.level < a.level ? b : a));
    if (c.card && k) {
      const { card, t1, t2 } = c.card;
      const { cardRect: q } = best;
      const fs1 = c.card.fs1 * best.f;
      const fs2 = c.card.fs2 * best.f;
      const padX = k.padX * best.f;
      const padY = k.padY * best.f;
      const gap = k.gap * best.f;
      if (best.f < 1) {
        if (t1) t1.setAttribute("font-size", fs1);
        if (t2) t2.setAttribute("font-size", fs2);
      }
      card.setAttribute("x", q.x);
      card.setAttribute("y", q.y);
      card.setAttribute("width", q.w);
      card.setAttribute("height", q.h);
      card.setAttribute("rx", sq * 0.05);
      blurShape(q.x, q.y, q.w, q.h, `inset(0 round ${sq * 0.05}px)`); // exactly under the card
      let cy = q.y + padY;
      if (t1) {
        t1.setAttribute("x", q.x + padX);
        t1.setAttribute("y", cy + fs1 / 2);
        cy += fs1 + gap;
      }
      if (t2) {
        t2.setAttribute("x", q.x + padX);
        t2.setAttribute("y", cy + fs2 / 2);
      }
      if (anim) {
        const origin = `${q.x + q.w / 2}px ${q.y + q.h / 2}px`;
        for (const el of [card, t1, t2]) {
          if (el) animateIn(el, [{ opacity: 0, transform: "scale(0.6)", transformOrigin: origin }, { transform: "scale(1)", transformOrigin: origin }], 150, 170);
        }
      }
    }
    if (c.cls) {
      const q = best.iconRect;
      const cx = q.x + r;
      const cy = q.y + r;
      const icon = qualityIcon(c.cls, cx, cy, r);
      icon.setAttribute("opacity", Math.min(1, c.op + 0.05));
      svg.appendChild(icon);
      blurShape(q.x, q.y, q.w, q.h, `circle(${r}px at ${r}px ${r}px)`); // exactly under the round icon
      if (anim) animateIn(icon, [{ opacity: 0, transform: `translate(${cx}px, ${cy}px) scale(${r * 0.5})` }, { transform: `translate(${cx}px, ${cy}px) scale(${r})` }], 190, 160);
    }
  }
  current = { marks, size: `${Math.round(br.width)}x${Math.round(br.height)}` };
}

const winPct = (cp) => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);

// Move quality in the style of chess.com's game review. The loss is measured in win-chance points
// against the engine's best line of the same depth.
const QUALITY = {
  brilliant: { id: "brilliant", name: "Brilliant", symbol: "!!", colour: "#1baca6" },
  great: { id: "great", name: "Great", symbol: "!", colour: "#5c8bb0" },
  best: { id: "best", name: "Best", symbol: "★", colour: "#96bc4b" },
  excellent: { id: "excellent", name: "Excellent", symbol: "✓", colour: "#96bc4b" },
  good: { id: "good", name: "Good", symbol: "✓", colour: "#a8b878" },
  inaccuracy: { id: "inaccuracy", name: "Inaccuracy", symbol: "?!", colour: "#f7c631" },
  mistake: { id: "mistake", name: "Mistake", symbol: "?", colour: "#e58f2a" },
  blunder: { id: "blunder", name: "Blunder", symbol: "??", colour: "#ca3431" },
  miss: { id: "miss", name: "Miss", symbol: "✗", colour: "#ee6055" }, // the opponent erred and my move did not make use of it (only for a played move)
  book: { id: "book", name: "Book", symbol: "", colour: "#d5a47d", plain: true }, // opening theory
  forced: { id: "forced", name: "Forced", symbol: "", colour: "#96bc4b", plain: true }, // the only legal move
};
// The kind of move as text: "Great !", "Brilliant !!", "Mistake ?", plain "Best". Without `withSymbol` just the name
// (when the icon already shows the symbol).
const qualityText = (c, withSymbol = true) => (c ? (!withSymbol || c.plain || c.symbol === "★" || c.symbol === "✓" ? c.name : `${c.name} ${c.symbol}`) : "");

// Icons for the kinds of move, drawn as vector shapes in unit space (the disc has radius 1), in the style of a
// game review: a coloured disc with a white ring and a bold glyph. Used on the board and, small, in the panel.
// Icon files the user put into the extension's icons/ folder (brilliant.svg|png|webp, great.*, best.*, ...).
// They replace the drawn icons. Which ones exist is found out once by trying to load each of them.
const ICON_FILES = {};
function probeIconFiles() {
  for (const id of Object.keys(QUALITY)) {
    for (const ext of ["svg", "png", "webp"]) {
      try {
        const url = browser.runtime.getURL(`icons/${id}.${ext}`);
        const img = new Image();
        img.onload = () => {
          if (!ICON_FILES[id] || ext === "svg") {
            ICON_FILES[id] = url;
            rerender(); // show the real icon on the hint that is already drawn
          }
        };
        img.src = url; // a missing file simply never loads
      } catch (e) {}
    }
  }
}

function iconMarkup(cls) {
  if (ICON_FILES[cls.id]) {
    return `<image href="${ICON_FILES[cls.id]}" x="-1.08" y="-1.08" width="2.16" height="2.16" preserveAspectRatio="xMidYMid meet"/>`;
  }
  const ink = cls.id === "inaccuracy" ? "#2b2300" : "#fff"; // white on every disc, dark only on the yellow one
  const excl = `<path d="M0 -0.56 V0.1"/><circle cx="0" cy="0.5" r="0.15" fill="${ink}" stroke="none"/>`;
  const ques = `<path d="M-0.3 -0.28 A0.34 0.34 0 1 1 0.12 0.04 C0.02 0.12 0 0.2 0 0.3"/><circle cx="0" cy="0.62" r="0.15" fill="${ink}" stroke="none"/>`;
  const at = (x, k, body) => `<g transform="translate(${x} 0) scale(${k})">${body}</g>`;
  const star = (() => {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI / 5) * i - Math.PI / 2;
      const r = i % 2 ? 0.27 : 0.66;
      pts.push(`${(Math.cos(a) * r).toFixed(3)},${(Math.sin(a) * r + 0.04).toFixed(3)}`);
    }
    return `<polygon points="${pts.join(" ")}" fill="${ink}" stroke-width="0.08"/>`;
  })();
  const check = `<path d="M-0.44 0.04 L-0.12 0.36 L0.46 -0.3"/>`;
  const glyph = {
    brilliant: at(-0.31, 0.78, excl) + at(0.31, 0.78, excl),
    great: at(0, 0.95, excl),
    best: star,
    excellent: check,
    good: at(0, 0.8, check),
    inaccuracy: at(-0.3, 0.68, ques) + at(0.4, 0.62, excl),
    mistake: at(0, 0.95, ques),
    blunder: at(-0.34, 0.68, ques) + at(0.34, 0.68, ques),
    book: `<path d="M0 -0.4 V0.46 M0 -0.4 C-0.18 -0.52 -0.46 -0.52 -0.6 -0.4 V0.38 C-0.46 0.28 -0.18 0.28 0 0.46 C0.18 0.28 0.46 0.28 0.6 0.38 V-0.4 C0.46 -0.52 0.18 -0.52 0 -0.4" stroke-width="0.2"/>`,
    forced: `<path d="M-0.5 0 H0.46 M0.1 -0.38 L0.5 0 L0.1 0.38"/>`,
    miss: `<path d="M-0.4 -0.4 L0.4 0.4 M0.4 -0.4 L-0.4 0.4"/>`,
  }[cls.id];
  return `<circle r="1" fill="${cls.colour}" stroke="#fff" stroke-width="0.1"/><g fill="none" stroke="${ink}" stroke-width="0.27" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>`;
}

function qualityIcon(cls, cx, cy, r) {
  const g = svgEl("g", { transform: `translate(${cx} ${cy}) scale(${r})` });
  g.innerHTML = iconMarkup(cls);
  return g;
}
const PIECE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

// A sacrifice: a minor piece or more lands on a square where the opponent takes it (the engine's own line) and
// nothing is taken back there, while the piece is worth clearly more than what it captured.
// Plays an engine move (UCI) on a board map. Legality is the engine's business; this only moves the pieces.
function applyUci(map, move) {
  const from = move.slice(0, 2);
  const to = move.slice(2, 4);
  const piece = map[from];
  if (!piece) return;
  const role = piece.toLowerCase();
  const white = piece === piece.toUpperCase();
  if (role === "p" && from[0] !== to[0] && !map[to]) delete map[to[0] + from[1]]; // en passant
  if (role === "k" && Math.abs(FILES.indexOf(from[0]) - FILES.indexOf(to[0])) === 2) {
    const king = to[0] > from[0]; // castling: the rook jumps too
    const rookFrom = (king ? "h" : "a") + from[1];
    map[(king ? "f" : "d") + from[1]] = map[rookFrom];
    delete map[rookFrom];
  }
  delete map[from];
  map[to] = move[4] ? (white ? move[4].toUpperCase() : move[4].toLowerCase()) : piece;
}

const materialOf = (map, white) => {
  let sum = 0;
  for (const p of Object.values(map)) if ((p === p.toUpperCase()) === white) sum += PIECE_VALUE[p.toLowerCase()];
  return sum;
};

// How much material the mover is down after the engine's own line (4 to 8 plies, ending with the mover to move
// again). A piece given up and not won back within that line shows as 3, a rook 5, a queen 9.
function sacrificeDeficit(fen, pv) {
  if (!fen || !pv || pv.length < 4) return 0;
  const map = boardOf(fen);
  const mover = map[pv[0].slice(0, 2)];
  if (!mover) return 0;
  const white = mover === mover.toUpperCase();
  const balance = () => materialOf(map, white) - materialOf(map, !white);
  const start = balance();
  const plies = Math.min(pv.length, 8) & ~1;
  // The deficit must hold at every checkpoint (after 4, 6 and 8 plies): an exchange cut off in the middle, or a
  // piece won back a little later, is not a sacrifice.
  let deficit = Infinity;
  for (let i = 0; i < plies; i++) {
    applyUci(map, pv[i]);
    if (i % 2 === 1 && i >= 3) deficit = Math.min(deficit, start - balance());
  }
  return deficit === Infinity ? 0 : deficit;
}

// Pieces of `white` (or black) that attack the square, as { sq, v }: pawns, knights, kings and sliders with a clear line.
const SEE_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
function attackersOnto(map, file, rank, white) {
  const out = [];
  const own = (p) => p && (p === p.toUpperCase()) === white;
  const look = (f, r) => (f >= 0 && f < 8 && r >= 1 && r <= 8 ? (map[FILES[f] + r] ?? null) : undefined);
  const add = (f, r) => out.push({ sq: FILES[f] + r, v: SEE_VALUE[map[FILES[f] + r].toLowerCase()] });
  const pr = rank + (white ? -1 : 1);
  for (const df of [-1, 1]) if (look(file + df, pr) === (white ? "P" : "p")) add(file + df, pr);
  for (const [df, dr] of [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]) {
    if (look(file + df, rank + dr) === (white ? "N" : "n")) add(file + df, rank + dr);
  }
  for (let df = -1; df <= 1; df++) for (let dr = -1; dr <= 1; dr++) {
    if ((df || dr) && look(file + df, rank + dr) === (white ? "K" : "k")) add(file + df, rank + dr);
  }
  for (const [df, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const straight = df === 0 || dr === 0;
    for (let k = 1; k < 8; k++) {
      const p = look(file + df * k, rank + dr * k);
      if (p === undefined) break;
      if (p) {
        const t = p.toLowerCase();
        if (own(p) && (t === "q" || (straight ? t === "r" : t === "b"))) add(file + df * k, rank + dr * k);
        break;
      }
    }
  }
  return out;
}

// Static exchange on one square: what `white` nets by capturing the piece standing there, if both sides keep
// recapturing with their cheapest piece and may stop as soon as going on loses material. 0 = nothing to win.
function exchangeGain(map, sq, white) {
  const f = FILES.indexOf(sq[0]);
  const r = Number(sq[1]);
  const swap = (side, depth) => {
    const target = map[sq];
    if (!target || depth > 12) return 0;
    const list = attackersOnto(map, f, r, side);
    if (!list.length) return 0;
    const a = list.reduce((x, y) => (y.v < x.v ? y : x));
    const mover = map[a.sq];
    map[sq] = mover;
    delete map[a.sq];
    const gain = SEE_VALUE[target.toLowerCase()] - swap(!side, depth + 1);
    map[a.sq] = mover;
    map[sq] = target;
    return Math.max(0, gain);
  };
  return swap(white, 0);
}

// After the move, can the opponent win at least two points of material on the square of one of my pieces
// (a knight or more) by taking it? That is what makes a move a piece sacrifice.
function leavesPieceHanging(fen, move) {
  const map = boardOf(fen);
  const mover = map[move.slice(0, 2)];
  if (!mover) return false;
  const white = mover === mover.toUpperCase();
  applyUci(map, move);
  return Object.entries(map).some(([sq, p]) => {
    const t = p.toLowerCase();
    return (p === p.toUpperCase()) === white && t !== "k" && t !== "p" && exchangeGain(map, sq, !white) >= 2;
  });
}
const isSacrifice = (fen, rec) => sacrificeDeficit(fen, rec.pv) >= 2.5 && leavesPieceHanging(fen, rec.move);

// Same hash as the one that built book.js (FNV-1a and a djb2-style sum over the key, in base 36).
function hashKey(str) {
  let a = 0x811c9dc5;
  let b = 5381;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = (Math.imul(b, 33) + c) >>> 0;
  }
  return a.toString(36) + "." + b.toString(36);
}

function placementOf(map) {
  const rows = [];
  for (let rank = 8; rank >= 1; rank--) {
    let row = "";
    let empty = 0;
    for (const f of FILES) {
      const p = map[f + rank];
      if (p) {
        if (empty) row += empty;
        empty = 0;
        row += p;
      } else empty++;
    }
    rows.push(row + (empty || ""));
  }
  return rows.join("/");
}

// Opening theory: the position after this move is on one of the named opening lines.
function isBookMove(fen, move) {
  const book = globalThis.STOCKCRAB_BOOK;
  if (!book || !fen) return false;
  const map = boardOf(fen);
  if (!map[move.slice(0, 2)]) return false;
  applyUci(map, move);
  return book.has(hashKey(placementOf(map) + (fen.split(" ")[1] === "w" ? " b" : " w")));
}

// Great, as in chess.com's review ("critical to the outcome"): the move is the best one and every other move is
// clearly worse. Either it was the only good move (the next best gives up 10 win-chance points, an expected-points
// drop of 0.10), or it decides the outcome: the next best leaves the same class of position one step lower, with
// at least 5 points between them (losing -> equal, equal -> winning; the classes are below 30%, 30-70%, above 70%).
function isCritical(lines, rec) {
  const rival = lines.find((l) => l.move !== rec.move);
  if (!rival) return false;
  const mine = winPct(rec.score);
  const other = winPct(rival.score);
  const gap = mine - other;
  if (mine < 8) return false; // nothing to find in a lost position
  if (gap >= 10) return true;
  return gap >= 5 && ((mine >= 70 && other < 70) || (mine >= 30 && other < 30));
}

function classifyMove(lines, rec, fen) {
  const best = lines[0];
  if (!best || !rec) return null;
  const pct = (l) => winPct(l.score);
  const loss = Math.max(0, pct(best) - pct(rec));
  if (!Number.isFinite(loss)) return null; // a line without a usable score: no verdict
  if (lines.length === 1 && rec.move === best.move) return QUALITY.forced; // the engine found a single legal move
  if (loss < 5 && isBookMove(fen, rec.move)) return QUALITY.book; // theory
  const top = rec.move === best.move || loss < 0.05; // "Best" is the engine's first choice and nothing else
  if (top || loss <= 2) {
    // Brilliant, from chess.com's description ("a good piece sacrifice", best or nearly best, not in a bad position
    // afterwards, not completely winning without it): a piece is left en prise AND the engine's line does not win
    // it back (checked at 4, 6 and 8 plies); the position is not worse than about -0.7, and no other move wins
    // by itself (at most 70%, about +2.4).
    const rival = lines.find((l) => l.move !== rec.move);
    if (isSacrifice(fen, rec) && pct(rec) >= 45 && (rival ? pct(rival) < 70 : pct(rec) < 90)) return QUALITY.brilliant;
    if (!top) return QUALITY.excellent; // nearly best, up to 2 points behind: its own rating, Excellent
    if (isCritical(lines, rec)) return QUALITY.great;
    return QUALITY.best;
  }
  if (loss <= 5) return QUALITY.good;
  if (loss <= 10) return QUALITY.inaccuracy;
  if (loss <= 20) return QUALITY.mistake;
  return QUALITY.blunder;
}

// A real minus sign reads better next to digits than a hyphen.
const minus = (str) => str.replace("-", "−");

function scoreText(line, sign) {
  if (!line || (!line.mate && !Number.isFinite(line.score))) return ""; // never show "NaN"
  if (line.mate) {
    const m = line.mate * sign;
    return m > 0 ? `M${m}` : `−M${-m}`;
  }
  const cp = line.score * sign;
  if (settings.scoreUnits === "cp") return (cp > 0 ? "+" : "") + minus(String(Math.round(cp)));
  if (settings.scoreUnits === "win") return Math.round(winPct(cp)) + "%";
  const p = cp / 100;
  return (p > 0 ? "+" : "") + minus(p.toFixed(2));
}

// Piece on a square of a FEN ("P", "n", ...), or null.
function fenPiece(fen, sq) {
  const row = fen.split(" ")[0].split("/")[8 - Number(sq[1])];
  if (!row) return null;
  const file = FILES.indexOf(sq[0]);
  let f = 0;
  for (const c of row) {
    if (/\d/.test(c)) {
      f += Number(c);
      if (f > file) return null;
    } else {
      if (f === file) return c;
      f++;
    }
  }
  return null;
}

// "Nf3", "exd5", "O-O", "e8=Q": readable move names. (No disambiguation or check marks.)
// `recapture` marks a premove that lands where the opponent's piece will be.
function sanish(fen, move, recapture) {
  const from = move.slice(0, 2);
  const to = move.slice(2, 4);
  const piece = fen && fenPiece(fen, from);
  if (!piece) return `${from}${to}`;
  const role = piece.toUpperCase();
  if (role === "K" && Math.abs(FILES.indexOf(from[0]) - FILES.indexOf(to[0])) === 2) return to[0] > from[0] ? "O-O" : "O-O-O";
  const target = fenPiece(fen, to);
  const white = piece === role;
  const capture = recapture || (target && (target === target.toUpperCase()) !== white) || (role === "P" && from[0] !== to[0]);
  let out = role === "P" ? (capture ? from[0] + "x" : "") : role + (capture ? "x" : "");
  out += to;
  if (move[4]) out += "=" + move[4].toUpperCase();
  return out;
}

// Our turn: the chosen move, then up to `others` more moves that are nearly as good.
function marksForMyTurn(res, others, fen) {
  const lines = res.lines || [];
  const best = lines[0];
  // The score shown must belong to the move shown: its own line, or its own deepest record. If the engine never
  // evaluated it, no score is shown (the best line's score would be someone else's).
  const chosen = lines.find((l) => l.move === res.move) || res.chosen || null;
  const make = (move, kind, line) => ({
    move, kind, label: line ? scoreText(line, 1) : "", san: sanish(fen, move), cls: line ? classifyMove(lines, line, fen) : null,
  });
  const marks = [make(res.move, "best", chosen)];
  for (const l of lines) {
    if (marks.length - 1 >= others) break;
    if (l.move === res.move) continue;
    if (best && best.score - l.score > settings.goodWithin) continue;
    marks.push(make(l.move, "alt", l));
  }
  return marks;
}

// Opponent's turn. "likely": our best reply to their most likely move, with how many of their other likely
// moves lead to the same reply. "safe": the same reply after every legal move; the score is the weakest one.
// "pawn": the pawn retake after a pawn trade.
function marksForPremove(res, fen) {
  if (!res.premove) return [];
  const t = scoreText({ score: res.score, mate: res.mate }, 1);
  const recapture = !!res.expect && res.expect.slice(2, 4) === res.premove.slice(2, 4);
  const san = sanish(fen, res.premove, recapture);
  const mark = (detail) => [{ move: res.premove, kind: "premove", label: t, san, detail }];
  if (res.mode === "pawn") return mark("pawn retake");
  if (res.mode === "likely" || (res.mode === "smart" && res.why === "agreed")) {
    return mark(res.considered > 1 ? `${res.agree}/${res.considered} agree` : "");
  }
  if (res.mode === "smart") return mark("");
  return mark(res.mate ? "" : "at least");
}

function premoveStatus(res) {
  if (res.mode === "pawn") return `Premove: if they take with the pawn (${pretty(res.expect)}), retake with the pawn`;
  if (res.mode === "smart") {
    return res.why === "obvious"
      ? `Premove: they will almost certainly play ${pretty(res.expect)}`
      : `Premove: your reply is the same after all ${res.considered} likely moves`;
  }
  if (res.mode === "likely") {
    return res.considered > 1
      ? `Premove if they play ${pretty(res.expect)} (${res.agree} of ${res.considered} likely moves agree)`
      : `Premove if they play ${pretty(res.expect)}`;
  }
  return `Safe premove, any reply (${res.tested} checked)`;
}

function root() {
  return document.getElementById(PANEL_ID)?.shadowRoot;
}

function setStatus(text, kind = "") {
  const el = root()?.querySelector(".status");
  if (!el) return;
  el.textContent = text;
  el.dataset.kind = kind;
  el.title = "Click: copy the position that was read\n" + lastRead;
}

const pretty = (m) => `${m.slice(0, 2)} → ${m.slice(2, 4)}${m.length > 4 ? "=" + m[4].toUpperCase() : ""}`;

function listMoves(marks, animate = false) {
  const box = root()?.querySelector(".moves");
  if (!box) return;
  box.textContent = "";
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  for (const m of marks) {
    const col = colourOf(m.kind);
    const row = el("div", "mv");
    const chip = el("span", "chip");
    chip.style.background = col;
    const name = el("span", "nm");
    if (m.kind === "premove") name.append(el("span", "tag", "premove"));
    name.append(el("b", "san", m.san || m.move), el("span", "co", pretty(m.move)));
    if (m.cls && settings.showIcon) {
      const ic = el("span", "ic");
      ic.innerHTML = `<svg viewBox="-1.08 -1.08 2.16 2.16" width="14" height="14">${iconMarkup(m.cls)}</svg>`;
      name.insertBefore(ic, name.children[1] || null);
    }
    const det = [qualityText(m.cls, !settings.showIcon), m.detail].filter(Boolean).join(" · ");
    if (det) name.append(el("span", "dt", det));
    const sc = el("span", "sc", m.label || "");
    sc.style.background = col;
    sc.style.color = textOn(col);
    row.append(chip, name, sc);
    box.appendChild(row);
    if (animate && settings.animate && !reducedMotion()) {
      animateIn(row, [{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "translateY(0)" }], (box.children.length - 1) * 45, 160);
    }
  }
}

// "Best: Nf3 +0.40 · depth 24", and a warning when a castle is suggested on a position that was read from the screen
// (its castling rights are only guessed).
function bestStatus(marks, res) {
  const m = marks[0];
  const exact = fenSource === "game" || fenSource === "page";
  const parts = [`Best: ${m.san}  ${m.label}`.trim()];
  if (res.depth) parts.push(`depth ${res.depth}`);
  if (!exact && /^O-O/.test(m.san)) parts.push("check that you can still castle");
  return parts.join(" · ");
}

// The rating of the move I just played (see ratePlayedMove) is drawn together with whatever else is on the board.
let lastMine = null; // { fen, res }: my last position with the engine's lines, to rate the move I play from it
let playedMark = null; // the rating drawn on the target cell of my last move
let afterMine = null; // { pct, fen }: win chance of my last played move (my view) and the position after it, to see whether the opponent's reply was a mistake
let ratedFor = null; // { fen, mark }: the position that rating belongs to, so a re-read of it keeps the rating

function show(board, marks, animate = false) {
  drawMarks(board, playedMark && settings.ratePlayed ? marks.concat(playedMark) : marks, animate);
  listMoves(marks, animate);
}

// The move that turned `before` into `after` (one move by the side to move in `before`), as "e2e4"/"e7e8q", or null.
function inferPlayed(before, after) {
  if (!before || !after) return null;
  const map0 = boardOf(before);
  const map1 = boardOf(after);
  const white = before.split(" ")[1] === "w";
  const target = after.split(" ")[0];
  const mine = (p) => p && (p === p.toUpperCase()) === white;
  const froms = Object.keys(map0).filter((sq) => mine(map0[sq]) && map1[sq] !== map0[sq]);
  const tos = Object.keys(map1).filter((sq) => mine(map1[sq]) && map1[sq] !== map0[sq]);
  for (const from of froms) {
    for (const to of tos) {
      const promo = map0[from].toLowerCase() === "p" && (to[1] === "8" || to[1] === "1") ? ["q", "r", "b", "n"] : [""];
      for (const p of promo) {
        const trial = boardOf(before);
        applyUci(trial, from + to + p);
        if (placementOf(trial) === target) return from + to + p;
      }
    }
  }
  return null;
}

// Miss, as in chess.com's review: "you fail to capitalize on your opponent's mistake". Their last move gave me at
// least 10 win-chance points (the best I can do now is that much better than the value my own previous move had),
// there was something to win (the position is now clearly in my favour), and my move lost 5 to 20 points of it
// (a smaller slip is only an Inaccuracy, a bigger one stays a Blunder).
function isMiss(lines, rec, prevPct) {
  if (prevPct == null || !lines[0] || !rec) return false;
  const best = winPct(lines[0].score);
  const mine = winPct(rec.score);
  return best - prevPct >= 10 && best >= 55 && best - mine >= 5 && best - mine <= 20;
}

// Rate the move I played in the position I had hints for, the way chess.com's game review does: against the
// engine's best line. If the move is among the lines I already have, its score is known; otherwise the engine
// searches just that move to the same depth. Returns a mark for the target cell, or null.
async function ratePlayedMove(id, fen) {
  const prev = lastMine;
  lastMine = null;
  if (!prev || prev.fen === fen) return null;
  const played = inferPlayed(prev.fen, fen);
  if (!played) return null;
  let lines = prev.res && prev.res.lines ? prev.res.lines : [];
  let rec = lines.find((l) => l.move === played);
  if (!rec || !lines.length) {
    setStatus("Rating your move…", "busy");
    let r;
    try {
      // without the hint's lines (the move was played before the hint was ready) the engine finds them too
      r = await browser.runtime.sendMessage({ type: "rate", id, fen: prev.fen, move: played, withBest: !lines.length, depth: Math.max(8, Math.min((prev.res && prev.res.depth) || 18, 30)), hash: settings.hash });
    } catch (e) {
      return null;
    }
    if (!lines.length && r && r.lines) lines = r.lines;
    rec = r && r.move && (r.chosen || (r.lines && r.lines.find((l) => l.move === played)));
    if (!rec || rec.move !== played || !lines.length) return null;
  }
  let cls = classifyMove(lines, rec, prev.fen);
  if (cls && !cls.plain && isMiss(lines, rec, prev.prevPct) && (cls.id === "inaccuracy" || cls.id === "mistake")) cls = QUALITY.miss;
  afterMine = { pct: winPct(rec.score), fen }; // what my move was worth: the opponent's reply is judged against it next turn
  return cls ? { move: played, kind: "played", label: "", san: "", cls } : null;
}

// Look-only settings (colours, scores, ...) redraw the last answer without asking the engine again.
function rerender() {
  const board = getBoard();
  if (!board) return;
  if (!lastView) {
    // nothing but the rating of my last move may be on the board: it follows the look settings too
    if (settings.enabled && (playedMark || current)) show(board, []);
    return;
  }
  const marks = lastView.mine
    ? marksForMyTurn(lastView.res, settings.others, lastView.fen)
    : marksForPremove(lastView.res, lastView.fen);
  if (!marks.length) return;
  show(board, marks);
  if (lastView.mine) setStatus(bestStatus(marks, lastView.res), "ok");
}

// A position read from the screen that cannot exist (a piece caught in the middle of a move, two pieces on a square):
// nothing is calculated from it. Returns the reason, or null.
function fenImpossible(fen) {
  const rows = fen.split(" ")[0].split("/");
  if (rows.length !== 8) return "not 8 ranks";
  const side = (re) => (fen.split(" ")[0].match(re) || []).length;
  if (side(/[A-Z]/g) > 16 || side(/[a-z]/g) > 16) return "more than 16 pieces of one colour";
  if (side(/P/g) > 8 || side(/p/g) > 8) return "more than 8 pawns";
  if (/[Pp]/.test(rows[0]) || /[Pp]/.test(rows[7])) return "a pawn on the first or last rank";
  return null;
}

const kingCount = (fen) => (fen.split(" ")[0].match(/[kK]/g) || []).length;
const pieceCount = (fen) => (fen.split(" ")[0].match(/[a-z]/gi) || []).length;

// A request that failed (the background page was asleep, the engine timed out) is asked again after a pause that
// grows with every failure (2 s, 4 s ... 15 s), instead of waiting for the position to change.
function retryLater(id) {
  if (id !== requestId) return;
  retryAt = Date.now() + Math.min(15000, 2000 * 2 ** Math.min(failures, 4));
  failures++;
  lastKey = null;
  candidateKey = null;
}

async function tick() {
  mountPanel();

  if (!settings.enabled) {
    if (lastKey !== null) {
      clearMarks(true);
      current = null;
      lastView = null;
      listMoves([]);
    }
    lastKey = null;
    return;
  }

  const board = getBoard();
  if (!board) {
    setStatus("Board not found");
    return;
  }
  if (SITE === "lichess" && !lichessAllowed()) {
    if (lastKey !== null) {
      clearMarks(true);
      current = null;
      lastView = null;
      listMoves([]);
      lastKey = null;
    }
    setStatus("lichess: works vs the computer and in analysis");
    return;
  }

  if (current) {
    const r = board.getBoundingClientRect();
    if (current.size !== `${Math.round(r.width)}x${Math.round(r.height)}`) drawMarks(board, current.marks);
  }

  if (isHolding(board)) {
    candidateKey = null; // hold everything as it is until the piece is dropped and the board has settled
    return;
  }
  if (Date.now() < retryAt) return; // the last request failed: wait a little before asking again

  let fen = readFen(board);
  if (fenSource === "dom" || fenSource === "lichess") {
    // a position read from the screen: check that it can exist, and repair a misread side to move
    const checked = sanitiseFen(fen);
    if (kingCount(fen) === 2 && !checked.ok) {
      setStatus("Position looks illegal (both kings attacked): the board was misread", "err");
      return;
    }
    if (checked.ok && checked.flipped) {
      fen = checked.fen;
      fenSource += "+turn";
    }
  }
  lastRead = `${fenSource} · ${fen}`;
  if ((fenSource.startsWith("dom") || fenSource.startsWith("lichess")) && fenImpossible(fen)) {
    candidateKey = null; // the board is changing under our eyes: wait for it to settle
    return;
  }
  if (kingCount(fen) !== 2) {
    if (lastKey !== null) {
      clearMarks(true);
      current = null;
      lastView = null;
      listMoves([]);
      lastKey = null;
    }
    setStatus(`Can't read the board (${pieceCount(fen)} pieces found)`, "err");
    return;
  }
  const key = [fen, ...QUERY_KEYS.map((k) => settings[k])].join("|");
  if (key === lastKey) return;
  if (key !== candidateKey) {
    candidateKey = key;
    return;
  }
  lastKey = key;
  const id = ++requestId;
  clearMarks(true);
  current = null;
  lastView = null;
  listMoves([]);

  // "Whoever is to move" (analysis boards, puzzles, playing both sides): every position is mine
  const mine = settings.side === "turn" || fen.split(" ")[1] === myColour(board);
  playedMark = settings.ratePlayed && ratedFor && ratedFor.fen === fen ? ratedFor.mark : null;
  if (!keepAlive) {
    try {
      keepAlive = browser.runtime.connect();
      keepAlive.onDisconnect.addListener(() => (keepAlive = null));
    } catch (e) {}
  }
  if (settings.ratePlayed && lastMine && lastMine.fen !== fen) {
    const mark = await ratePlayedMove(id, fen);
    if (id !== requestId) return;
    ratedFor = mark ? { fen, mark } : null;
    playedMark = mark;
    if (mark) show(board, [], true);
  }
  if (!mine && !settings.premove) {
    setStatus("Opponent's turn");
    return;
  }
  if (mine && !(lastMine && lastMine.fen === fen)) {
    // the value of my previous move counts only if the opponent's reply really is one move from that position
    const prevPct = afterMine && inferPlayed(afterMine.fen, fen) ? afterMine.pct : null;
    lastMine = { fen, res: null, prevPct }; // known from now on, even if I move before the hint is ready
    afterMine = null;
  }
  setStatus(mine ? "Thinking…" : `Opponent's turn, checking for a ${settings.premoveMode === "safe" ? "safe " : ""}premove…`, "busy");
  let res;
  try {
    res = await browser.runtime.sendMessage(
      mine
        ? {
            type: "hint", id, fen,
            elo: settings.elo, movetime: settings.movetime, depth: settings.depth, hash: settings.hash,
            aggression: settings.aggression,
            // "Great" (the only good move) needs a second line to compare with, so the labels ask for at least two
            multipv: Math.max(1 + settings.others, settings.showIcon || settings.showQuality ? 2 : 1),
          }
        : {
            type: "premove", id, fen,
            movetime: settings.movetime, hash: settings.hash, gap: settings.safeGap, per: settings.premovePer,
            mode: settings.premoveMode, likelyCount: settings.likelyCount, likelyWithin: settings.likelyWithin,
            obviousLead: settings.obviousLead, replyGap: settings.replyGap,
            pawnTrade: settings.pawnTrade, tradeTolerance: settings.tradeTolerance,
          },
    );
  } catch (e) {
    setStatus("Error: " + e.message, "err");
    console.error("[stockcrab]", e);
    retryLater(id);
    return;
  }
  if (!res) {
    setStatus("No reply from the engine", "err");
    retryLater(id);
    return;
  }
  if (res.id !== requestId) return;
  if (res.error) {
    setStatus(res.error, "err");
    retryLater(id);
    return;
  }
  failures = 0;
  if (!mine) {
    const marks = marksForPremove(res, fen);
    if (!marks.length) {
      if (playedMark) show(board, [], false);
      const why = ["they have several good moves", "your reply needs thought"].includes(res.reason) ? res.reason : null;
      setStatus(
        settings.premoveMode === "smart" && why
          ? `No premove: ${why}`
          : settings.premoveMode === "safe"
            ? "Opponent's turn: no safe premove"
            : "Opponent's turn: no premove",
      );
      return;
    }
    lastView = { mine, res, fen };
    show(board, marks, true);
    setStatus(premoveStatus(res), "ok");
    return;
  }
  if (!res.move || res.move === "(none)") {
    setStatus("No legal moves (game over?)", "err");
    return;
  }
  lastView = { mine, res, fen };
  if (lastMine && lastMine.fen === fen) lastMine.res = res;
  const marks = marksForMyTurn(res, settings.others, fen);
  show(board, marks, true);
  setStatus(bestStatus(marks, res), "ok");
}

const MODEL_OPTIONS = [
  ["sf19-full", "Stockfish 19 · Full"],
  ["sf19-lite", "Stockfish 19 · Lite"],
  ["sf17-full", "Stockfish 17.1 · Full"],
  ["sf17-lite", "Stockfish 17.1 · Lite"],
  ["sf11", "Stockfish 11 · Classic"],
  ["sf19-asm", "Stockfish 19 · JavaScript"],
];

const SECTIONS = [
  ["engine", "Engine", [
    { key: "elo", type: "range", label: "Strength (Elo)", min: 1320, max: 3190, step: 10, fmt: (v) => (v >= 3190 ? "max" : v), fx: "query" },
    { key: "movetime", type: "range", label: "Think time", min: 500, max: 30000, step: 500, fmt: (v) => (v / 1000).toFixed(1) + " s", fx: "query" },
    { key: "depth", type: "range", label: "Max depth (0 = off)", min: 0, max: 40, step: 1, fmt: (v) => (v ? v : "off"), fx: "query" },
    { key: "aggression", type: "range", label: "Aggression (costs strength)", min: 0, max: 100, step: 10, fmt: (v) => v + "%", fx: "query" },
    { key: "hash", type: "range", label: "Hash memory", min: 16, max: 256, step: 16, fmt: (v) => v + " MB", fx: "query" },
    { key: "model", type: "select", label: "Model", opts: MODEL_OPTIONS, fx: "engine" },
  ]],
  ["moves", "Moves", [
    { key: "others", type: "range", label: "Other good moves (0 = strongest)", min: 0, max: 3, step: 1, fmt: (v) => v, fx: "query" },
    { key: "goodWithin", type: "range", label: "“Good” = at most this far behind", min: 10, max: 150, step: 10, fmt: (v) => v + " cp", fx: "render" },
    { key: "scoreUnits", type: "select", label: "Scores as", opts: [["pawns", "Pawns (+0.35)"], ["cp", "Centipawns (+35)"], ["win", "Win chance (62%)"]], fx: "render" },
    { key: "ratePlayed", type: "check", label: "Rate the move I played", fx: "render" },
    { key: "showList", type: "check", label: "Show the move list below", fx: "panel" },
  ]],
  ["premove", "Premove", [
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
    { key: "showIcon", type: "check", label: "Icon of the move (Brilliant, Great ...)", fx: "render" },
    { key: "showQuality", type: "check", label: "Name of the kind of move", fx: "render" },
    { key: "showSquare", type: "check", label: "Cell name in the card", fx: "render" },
    { key: "animate", type: "check", label: "Animate new hints", fx: "panel" },
  ]],
  ["panel", "Panel", [
    { key: "corner", type: "select", label: "Position", opts: [["br", "Bottom right"], ["bl", "Bottom left"], ["tr", "Top right"], ["tl", "Top left"]], fx: "panel" },
    { key: "side", type: "select", label: "I play", opts: [["auto", "Auto-detect"], ["w", "White"], ["b", "Black"], ["turn", "Whoever is to move"]], fx: "query" },
    { key: "hotkey", type: "check", label: "Alt+X turns StockCrab on/off", fx: "panel" },
  ]],
];
const CONTROLS = SECTIONS.flatMap(([, , list]) => list);
const QUERY_KEYS = CONTROLS.filter((c) => c.fx === "query" || c.fx === "engine").map((c) => c.key);

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
  .grid { display: grid; gap: 8px; margin: 8px 0 2px; }
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
  .reset { font: inherit; font-size: 12px; color: var(--fg); background: var(--soft); border: 1px solid var(--line); border-radius: 6px; padding: 6px 10px; cursor: pointer; }
  .reset:hover { border-color: var(--muted); }

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
  if (c.type === "range") {
    return `<div><div class="lab"><span>${c.label}</span><b data-v="${c.key}"></b></div>
      <input type="range" data-key="${c.key}" min="${c.min}" max="${c.max}" step="${c.step}"></div>`;
  }
  if (c.type === "check") return `<label class="chk"><input type="checkbox" data-key="${c.key}"> ${c.label}</label>`;
  if (c.type === "select") {
    const opts = c.opts.map(([v, t]) => `<option value="${v}">${t}</option>`).join("");
    return `<label class="sel"><span>${c.label}</span><select data-key="${c.key}">${opts}</select></label>`;
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

  // Clicking the status line copies what was read from the page, to show it when a position looks wrong.
  const statusEl = shadow.querySelector(".status");
  statusEl.title = "Click: copy the position that was read";
  statusEl.addEventListener("click", async () => {
    let who = "?";
    try {
      who = myColour(getBoard());
    } catch (e) {}
    const text = `${SITE} · I play ${who} · ${lastRead}`;
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
  shadow.querySelector(".reset").addEventListener("click", () => {
    const keep = { enabled: settings.enabled };
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
    const el = r.querySelector(`[data-key="${c.key}"]`);
    if (!el) continue;
    if (c.type === "check") el.checked = settings[c.key];
    else el.value = settings[c.key];
    if (c.type === "range") {
      r.querySelector(`[data-v="${c.key}"]`).textContent = c.fmt(settings[c.key]);
      el.style.setProperty("--p", ((settings[c.key] - c.min) / (c.max - c.min)) * 100 + "%");
    }
  }
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

document.addEventListener("keydown", (e) => {
  if (!settings.hotkey || !e.altKey || e.ctrlKey || e.metaKey || e.code !== "KeyX") return;
  const t = e.target;
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
  e.preventDefault();
  setEnabled(!settings.enabled);
});

async function refreshEngineInfo() {
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
    if (st?.notice) el.textContent = st.notice; // e.g. "Stockfish 17.1 Full did not start, using Stockfish 19 Full"
  } catch (e) {
    el.textContent = "Engine: no reply";
  }
}
setInterval(refreshEngineInfo, 3000);

probeIconFiles();
setInterval(tick, 250);