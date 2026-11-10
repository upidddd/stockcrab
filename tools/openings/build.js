// Builds src/stockcrab/assets/openings.json from the lichess opening list (a.tsv ... e.tsv, CC0).
// Run: node tools/openings/build.js
const fs = require("fs");
const path = require("path");
const { Chess } = require("../../src/stockcrab/engine/maia/chess.js");

const here = __dirname;
const names = [];
const pos = {}; // placement + side -> { uci: [line indexes] }
const after = {}; // placement + side + uci -> position after the move
const named = {}; // placement + side -> index of the line that ends there
const key = (c) => c.fen().split(" ").slice(0, 2).join(" ");

for (const f of ["a", "b", "c", "d", "e"]) {
  const rows = fs.readFileSync(path.join(here, f + ".tsv"), "utf8").trim().split("\n").slice(1);
  for (const row of rows) {
    const [eco, name, pgn] = row.split("\t");
    const i = names.length;
    names.push([eco, name]);
    const c = new Chess();
    for (const san of pgn.replace(/\d+\.(\.\.)?/g, " ").trim().split(/\s+/)) {
      const k = key(c);
      const m = c.move(san);
      const uci = m.from + m.to + (m.promotion || "");
      ((pos[k] ??= {})[uci] ??= []).push(i);
      after[k + " " + uci] = key(c);
    }
    const end = key(c);
    if (!(end in named) || names[named[end]][1].length > name.length) named[end] = i;
  }
}
// each book move: [line indexes, the line named after the position it reaches or -1]
for (const [k, moves] of Object.entries(pos)) {
  for (const uci of Object.keys(moves)) moves[uci] = [moves[uci], named[after[k + " " + uci]] ?? -1];
}
const out = { source: "lichess-org/chess-openings (CC0)", names, pos };
fs.writeFileSync(path.join(here, "../../src/stockcrab/assets/openings.json"), JSON.stringify(out));
console.log(names.length, "lines,", Object.keys(pos).length, "positions");
