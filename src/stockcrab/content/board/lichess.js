//! StockCrab · Lichess reader
//! Reads the position from lichess's chessground board.
//! File: content/board/lichess.js. A content script (runs on chess.com and lichess pages); files of one kind share a single global scope and load in the order of manifest.json.

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
