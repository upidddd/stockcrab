// Panel status line and move list.

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

// Status line with the best move.
function bestStatus(marks, res) {
  const m = marks[0];
  const exact = fenSource === "game" || fenSource === "page";
  const parts = [`Best: ${m.san}  ${m.label}`.trim()];
  if (res.maia) parts.push(`players ${settings.maiaRating}`);
  else if (res.depth) parts.push(`depth ${res.depth}`);
  if (!exact && /^O-O/.test(m.san)) parts.push("check that you can still castle");
  return parts.join(" · ");
}
