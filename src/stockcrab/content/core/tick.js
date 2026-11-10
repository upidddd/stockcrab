// Main loop: read the board, ask the engine, draw the answer.

// Why a position read from the screen cannot exist, or null.
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

// Retry delay after a failed request: 2 s, 4 s ... 15 s.
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
    candidateKey = null;
    return;
  }
  if (Date.now() < retryAt) return;

  let fen = readFen(board);
  if (fenSource === "dom" || fenSource === "lichess") {
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
    candidateKey = null;
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
  const key = [fen, ...QUERY_KEYS.map((k) => settings[k]), JSON.stringify((settings.uci || {})[settings.model] || {})].join("|");
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

  // "turn" mode: every position is mine
  const mine = settings.side === "turn" || fen.split(" ")[1] === myColour(board);
  if (!keepAlive) {
    try {
      keepAlive = browser.runtime.connect();
      keepAlive.onDisconnect.addListener(() => (keepAlive = null));
    } catch (e) {}
  }
  if (!mine && (!settings.premove || !searching(settings))) {
    setStatus(settings.premove ? "Opponent's turn · premoves need a calculating model" : "Opponent's turn");
    return;
  }
  setStatus(mine ? "Thinking…" : `Opponent's turn, checking for a ${settings.premoveMode === "safe" ? "safe " : ""}premove…`, "busy");
  let res;
  try {
    res = await browser.runtime.sendMessage(
      mine
        ? {
            type: "hint", id, fen,
            elo: settings.elo, movetime: modelInfo().quick ? 20000 : settings.movetime, depth: settings.depth, hash: settings.hash,
            aggression: settings.aggression,
            multipv: 1 + settings.others,
            nodes: settings.nodes * 1000, strengthBy: settings.strengthBy, skill: settings.skill,
            wdl: settings.showWdl, nnue: settings.useNnue,
            maiaRating: settings.maiaRating, maiaOppo: settings.maiaOppo,
            uci: (settings.uci || {})[settings.model], quickDepth: settings.quickDepth,
            opening: (fen.split(" ")[1] === "w" ? settings.openingWhite : settings.openingBlack).trim(),
            bookMaxLoss: settings.bookMaxLoss >= 500 ? 1e9 : settings.bookMaxLoss,
          }
        : {
            type: "premove", id, fen,
            movetime: settings.movetime, hash: settings.hash, gap: settings.safeGap, per: settings.premovePer,
            mode: settings.premoveMode, likelyCount: settings.likelyCount, likelyWithin: settings.likelyWithin,
            obviousLead: settings.obviousLead, replyGap: settings.replyGap,
            pawnTrade: settings.pawnTrade, tradeTolerance: settings.tradeTolerance, nnue: settings.useNnue,
            uci: (settings.uci || {})[settings.model],
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
  const marks = marksForMyTurn(res, settings.others, fen);
  show(board, marks, true);
  setStatus(bestStatus(marks, res), "ok");
}
