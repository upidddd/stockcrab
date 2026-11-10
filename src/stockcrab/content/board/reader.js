// Reads the position from chess.com and checks that it is legal.

let fenSource = "?";
let turnMemory = { placement: null, turn: null, ep: "-" }; // last position with a known side to move
let lichessTurn = null;
let lastRead = "";

// En passant square after a double pawn push, if it can be taken.
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

function isAttacked(map, file, rank, byWhite) {
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

// Fixes the side to move of a position read from the screen.
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
  parts[3] = "-";
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

// Game position vs drawn position.
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
    const fen = board.wrappedJSObject?.game?.getFEN?.();
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

  // last-move highlights; a third square is the selected piece
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
    turn = turnMemory.turn;
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
