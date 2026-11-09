//! StockCrab · Status line and move list
//! The panel's status line and the list of moves under it.
//! File: content/ui/status.js. A content script (runs on chess.com and lichess pages); files of one kind share a single global scope and load in the order of manifest.json.

function root() {
  return document.getElementById(PANEL_ID)?.shadowRoot;
}

function setStatus(text, kind = "") {
  const el = root()?.querySelector(".status");
  if (!el) return;
  el.textContent = text;
  el.dataset.kind = kind;
  el.title = "Click: copy the position that was read\n" + lastRead;
}

const pretty = (m) => `${m.slice(0, 2)} → ${m.slice(2, 4)}${m.length > 4 ? "=" + m[4].toUpperCase() : ""}`;

function listMoves(marks, animate = false) {
  const box = root()?.querySelector(".moves");
  if (!box) return;
  box.textContent = "";
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  for (const m of marks) {
    const col = colourOf(m.kind);
    const row = el("div", "mv");
    const chip = el("span", "chip");
    chip.style.background = col;
    const name = el("span", "nm");
    if (m.kind === "premove") name.append(el("span", "tag", "premove"));
    name.append(el("b", "san", m.san || m.move), el("span", "co", pretty(m.move)));
    const det = m.detail || "";
    if (det) name.append(el("span", "dt", det));
    const sc = el("span", "sc", m.label || "");
    sc.style.background = col;
    sc.style.color = textOn(col);
    row.append(chip, name, sc);
    box.appendChild(row);
    if (animate && settings.animate && !reducedMotion()) {
      animateIn(row, [{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "translateY(0)" }], (box.children.length - 1) * 45, 160);
    }
  }
}

// "Best: Nf3 +0.40 · depth 24", and a warning when a castle is suggested on a position that was read from the screen
// (its castling rights are only guessed).
function bestStatus(marks, res) {
  const m = marks[0];
  const exact = fenSource === "game" || fenSource === "page";
  const parts = [`Best: ${m.san}  ${m.label}`.trim()];
  if (res.depth) parts.push(`depth ${res.depth}`);
  if (!exact && /^O-O/.test(m.san)) parts.push("check that you can still castle");
  return parts.join(" · ");
}
