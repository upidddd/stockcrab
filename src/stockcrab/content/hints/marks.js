// Turns an engine answer into the marks to draw.

// Piece on a square of a FEN, or null.
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

// Short move names: Nf3, exd5, O-O, e8=Q.
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

// Sign that turns a score for the side to move of `fen` into the chosen point of view.
const scoreSign = (fen) => (settings.scoresFor === "white" && fen && fen.split(" ")[1] === "b" ? -1 : 1);

// The best line after a move, as short move names: "Nc6 Bb5 a6".
function lineText(fen, pv, count) {
  if (!fen || !pv || pv.length < 2 || !(count > 0)) return "";
  const map = boardOf(fen);
  let turn = fen.split(" ")[1];
  const out = [];
  for (let i = 0; i < pv.length && out.length < count; i++) {
    if (i > 0) out.push(sanish(`${placementOf(map)} ${turn}`, pv[i]));
    applyUci(map, pv[i]);
    turn = turn === "w" ? "b" : "w";
  }
  return out.join(" ");
}

// The same position with the other side to move, to ask what they threaten; null when the side to move is in check.
function threatFen(fen) {
  const parts = fen.split(" ");
  const map = boardOf(fen);
  const white = parts[1] === "w";
  const king = Object.keys(map).find((sq) => map[sq] === (white ? "K" : "k"));
  if (!king || isAttacked(map, FILES.indexOf(king[0]), Number(king[1]), !white)) return null;
  parts[1] = white ? "b" : "w";
  parts[3] = "-";
  return parts.join(" ");
}

// Mark for the opponent's threat.
function threatMark(res, fen) {
  if (!res || !res.move || res.move === "(none)") return null;
  return { move: res.move, kind: "threat", san: sanish(threatFen(fen), res.move), label: "", detail: "" };
}

// Marks for our turn.
function marksForMyTurn(res, others, fen) {
  const lines = res.lines || [];
  const best = lines[0];
  // each move with its own score
  const chosen = lines.find((l) => l.move === res.move) || res.chosen || null;
  const maia = !!res.maia;
  const make = (move, kind, line) => ({
    move, kind, san: sanish(fen, move),
    label: !line ? "" : maia && settings.maiaShow === "share" && Number.isFinite(line.share) ? Math.round(line.share) + "%" : scoreText(line, scoreSign(fen)),
    detail: lineDetail(line, maia, fen),
  });
  const book = res.book && res.book.ok ? res.book : null;
  const marks = [make(res.move, "best", chosen)];
  if (book) {
    const opening = [book.eco, book.name].filter(Boolean).join(" ");
    const mark = make(book.move, "best", book.line);
    if (!book.line) mark.label = "book";
    mark.detail = ["book", opening, mark.detail].filter(Boolean).join(" · ");
    if (book.move === res.move) marks[0] = mark;
    else {
      // the engine's own move becomes one of the "other moves", shown only when they are on
      marks[0].kind = "alt";
      marks[0].detail = ["engine", marks[0].detail].filter(Boolean).join(" · ");
      marks.unshift(mark);
      if (others < 1) marks.length = 1;
    }
  }
  for (const l of lines) {
    if (marks.length - 1 >= others) break;
    if (marks.some((m) => m.move === l.move)) continue;
    if (maia ? l.share < settings.maiaMinShare : best && best.score - l.score > settings.goodWithin) continue;
    marks.push(make(l.move, "alt", l));
  }
  return marks;
}

// Detail row in the move list: the line, share of players, win / draw / loss.
function lineDetail(line, maia, fen) {
  if (!line) return "";
  const parts = [];
  const next = lineText(fen, line.pv, settings.lineLength);
  if (next) parts.push(next);
  if (maia && Number.isFinite(line.share)) parts.push(`${Math.round(line.share)}% of players`);
  if (maia && settings.maiaShow === "share") parts.push(scoreText(line, scoreSign(fen)));
  if (settings.showWdl && line.wdl) {
    const [w, d, l] = line.wdl.map((x) => Math.round(x / 10));
    parts.push(`W ${w}% · D ${d}% · L ${l}%`);
  }
  return parts.join(" · ");
}

// Marks for the opponent's turn (premove).
function marksForPremove(res, fen) {
  if (!res.premove) return [];
  // the reply's score is for us, and it is their turn in `fen`
  const t = scoreText({ score: res.score, mate: res.mate }, settings.scoresFor === "white" && fen.split(" ")[1] === "w" ? -1 : 1);
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
