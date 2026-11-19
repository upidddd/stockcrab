// Default settings, loop state, saving.

const MOBILE = BUILD === "mobile";
const DEFAULTS = {
  enabled: false,
  collapsed: MOBILE, // on a phone the panel starts as a strip under the board
  // engine
  elo: 3800, // within the model's own range (MODEL_INFO), its top = full strength; kept per model in eloByModel
  eloByModel: {}, // model -> Elo, so each engine keeps its own strength
  skillByModel: {}, // model -> Skill level
  movetime: MOBILE ? 3000 : 6000,
  depth: 0, // 0 = no limit
  aggression: 0,
  hash: MOBILE ? 32 : 128,
  side: "auto", // "auto", "w", "b" or "turn" (whoever is to move)
  model: MOBILE ? "sf19-lite" : "sf19-full",
  strengthBy: "elo", // "elo" or "skill"
  skill: 20, // Skill Level 0..20
  nodes: 0, // thousands of nodes, 0 = no limit
  showWdl: false,
  useNnue: true, // Fairy-Stockfish: NNUE or classical evaluation
  character: "Balanced", // StockCrab v1's personality
  crabTalk: true, // StockCrab v1 comments on the game in the status line
  maiaRating: 1500,
  maiaOppo: 500, // 500 = same as maiaRating
  maiaShow: "score", // card shows "share" of players or "score"
  maiaMinShare: 5, // % of players
  openingWhite: "", // opening name, "Any book line" or "Gambits"; empty = engine only
  openingBlack: "",
  quickDepth: 8, // the Quick model's fixed depth
  uci: {}, // the user's own engine options: model -> { option: value }
  bookMaxLoss: 150, // cp behind the engine's move; 500 = never leave the book
  // moves
  others: MOBILE ? 1 : 2, // extra moves next to the best one
  goodWithin: 50, // cp behind the best
  scoreUnits: "pawns",
  showList: true,
  lineLength: 4, // moves of the best line in the list, 0 = off
  scoresFor: "mover", // "mover" (the side to move) or "white"
  evalBar: true,
  threat: false, // the opponent's threat: their best move if it were their turn
  colourThreat: "#3b82f6",
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
  blur: MOBILE ? 0 : 4, // px, 0 = off
  hintStyle: "glossy", // "glossy" (sheen, gradient, glow) or "flat"
  glow: MOBILE ? 4 : 7, // glow around glossy hints, 0 = off
  panelIcon: "", // the user's own picture for the panel's header (a data: PNG), empty = the crab
  showOutline: true,
  showHead: true,
  showLabels: true,
  version: 5, // for migrations
  animate: true,
  // panel
  theme: "auto", // "auto", "light" or "dark"
  accent: "#e4572e", // panel, HUD and cursor trail
  cursorTrail: false,
  corner: "br",
  hotkey: true,
  showHud: false,
  hudCorner: "tl",
  checkUpdates: true,
  sections: { configs: false, engine: !MOBILE, uci: false, moves: false, analysis: false, opening: false, premove: false, look: false, panel: false },
  presets: {}, // saved configs: name -> settings
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
