// Default settings, loop state, saving.

const DEFAULTS = {
  enabled: false,
  collapsed: false,
  // engine
  elo: 3190,
  movetime: 6000,
  depth: 0, // 0 = no limit
  aggression: 0,
  hash: 128,
  side: "auto", // "auto", "w", "b" or "turn" (whoever is to move)
  model: "sf19-full",
  strengthBy: "elo", // "elo" or "skill"
  skill: 20, // Skill Level 0..20
  nodes: 0, // thousands of nodes, 0 = no limit
  showWdl: false,
  useNnue: true, // Fairy-Stockfish: NNUE or classical evaluation
  maiaRating: 1500,
  maiaOppo: 500, // 500 = same as maiaRating
  maiaShow: "score", // card shows "share" of players or "score"
  maiaMinShare: 5, // % of players
  openingWhite: "", // opening name, "Any book line" or "Gambits"; empty = engine only
  openingBlack: "",
  showHud: false,
  cursorTrail: false,
  bookMaxLoss: 150, // cp behind the engine's move; 500 = never leave the book
  // moves
  others: 2, // extra moves next to the best one
  goodWithin: 50, // cp behind the best
  scoreUnits: "pawns",
  showList: true,
  // premove
  premove: true,
  premoveMode: "smart", // "smart", "likely" or "safe"
  obviousLead: 80, // cp
  replyGap: 20, // cp
  pawnTrade: true,
  tradeTolerance: 100, // cp
  likelyCount: 4,
  likelyWithin: 100, // cp
  safeGap: 25, // cp
  premovePer: 240, // ms per opponent reply
  // look
  colourBest: "#e4572e",
  colourAlt: "#e4572e",
  colourPremove: "#00b8d4",
  colourOutline: "#e4572e",
  lineWidth: 100,
  opacity: 70,
  blur: 4, // px, 0 = off
  showOutline: true,
  showHead: true,
  showLabels: true,
  showSquare: false,
  version: 3, // for migrations
  animate: true,
  flowColours: "crab", // "crab", "duo" or "off"
  // panel
  corner: "br",
  hotkey: true,
  sections: { presets: false, engine: true, moves: false, opening: false, premove: false, look: false, panel: false },
  presets: {}, // name -> settings
};
let settings = JSON.parse(JSON.stringify(DEFAULTS));
let lastKey = null;
let candidateKey = null;
let requestId = 0;
let keepAlive = null;
let failures = 0; // consecutive failures, for the retry delay
let retryAt = 0;
let current = null; // { marks, size } drawn now
let lastView = null; // last answer, for redraws

function save() {
  try {
    browser.storage.local.set({ stockcrab: settings });
  } catch (e) {}
}
