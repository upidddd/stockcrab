//! StockCrab · Premove analyst
//! Finds the reply worth premoving, in the styles safe, likely and smart.
//! File: background/premove/analysis.js. A background script (hosts the engine); files of one kind share a single global scope and load in the order of manifest.json.

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
