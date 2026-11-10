// Opening book: the lichess opening list, and hints that follow a chosen opening.

let book = null;
function loadBook() {
  book ??= fetch(browser.runtime.getURL("assets/openings.json")).then((r) => r.json());
  return book;
}

// Which lines a choice allows: "Any book line", "Gambits", or an opening name (with its variations).
function bookFilter(choice) {
  if (!choice) return null;
  const want = choice.trim().toLowerCase();
  if (["*", "any", "any book line"].includes(want)) return () => true;
  if (["gambit", "gambits", "any gambit"].includes(want)) return (name) => /Gambit/.test(name);
  return (name) => {
    const n = name.toLowerCase();
    return n === want || n.startsWith(want + ":") || n.startsWith(want + ",");
  };
}

// Book moves in a position, the one that keeps the most chosen lines first (for Gambits: one that starts a gambit right away).
async function bookMoves(fen, choice) {
  const ok = bookFilter(choice);
  if (!ok) return [];
  const gambits = /^(any )?gambits?$/i.test(choice.trim());
  const b = await loadBook();
  const at = b.pos[fen.split(" ").slice(0, 2).join(" ")];
  if (!at) return [];
  return Object.entries(at)
    .map(([move, [lines, named]]) => {
      const kept = lines.filter((i) => ok(b.names[i][1]));
      const short = kept.reduce((a, i) => (a < 0 || b.names[i][1].length < b.names[a][1].length ? i : a), -1);
      const now = named >= 0 && ok(b.names[named][1]);
      const name = named >= 0 ? named : short;
      return { move, count: kept.length, now, name: name >= 0 ? b.names[name][1] : "", eco: name >= 0 ? b.names[name][0] : "" };
    })
    .filter((m) => m.count)
    .sort((x, y) => (gambits ? y.now - x.now : 0) || y.count - x.count);
}

// Opening names for the panel: families first, then every line.
async function openingNames() {
  const b = await loadBook();
  const full = [...new Set(b.names.map(([, n]) => n))];
  const families = [...new Set(full.map((n) => n.split(/[:,]/)[0]))];
  return [...families.sort(), ...full.filter((n) => !families.includes(n)).sort()];
}

// A hint that plays the book move while it is not much worse than the engine's move.
async function hintWithBook(msg) {
  let moves = [];
  try {
    moves = await bookMoves(msg.fen, msg.opening);
  } catch (e) {
    console.error("[stockcrab] opening book", e);
  }
  const res = await submit(msg);
  if (!moves.length || !res || !res.move || res.move === "(none)") return res;
  const pick = moves[0];
  let line = (res.lines || []).find((l) => l.move === pick.move) || null;
  if (!line && !MODELS[modelId].maia) {
    const check = await submit({ ...msg, multipv: 1, aggression: 0, goCmd: `go movetime ${Math.min(msg.movetime || 500, 500)} searchmoves ${pick.move}` });
    line = check?.lines?.find((l) => l.move === pick.move) || null;
  }
  const best = (res.lines || [])[0] || res.chosen;
  const loss = line && best ? best.score - line.score : 0;
  return { ...res, book: { ...pick, line, loss, ok: !(loss > (msg.bookMaxLoss ?? 150)) } };
}
