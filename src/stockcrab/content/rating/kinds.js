//! StockCrab · Rating kinds
//! The kinds of move (Brilliant ... Blunder, Book, Forced, Miss), their colours and the win-chance formula.
//! File: content/rating/kinds.js. A content script (runs on chess.com and lichess pages); files of one kind share a single global scope and load in the order of manifest.json.

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
