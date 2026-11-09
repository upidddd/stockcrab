//! StockCrab · Mark builder
//! Turns the engine's answer into the marks to draw: the best move, the others, the premove.
//! File: content/hints/marks.js. A content script (runs on chess.com and lichess pages); files of one kind share a single global scope and load in the order of manifest.json.

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
