//! StockCrab · Settings
//! The default settings, the state the main loop keeps, and saving the settings (loading is in core/main.js).
//! File: content/core/settings.js. A content script (runs on chess.com and lichess pages); files of one kind share a single global scope and load in the order of manifest.json.

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
  showRatings: true, // master switch: off = no rating anywhere (no kind icon or name on the hints, no rating of the moves I play)
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


function save() {
  try {
    browser.storage.local.set({ stockcrab: settings });
  } catch (e) {}
}
