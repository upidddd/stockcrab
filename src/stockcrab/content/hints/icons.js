//! StockCrab · Icon kit
//! The icon of every kind of move: the built-in vector icons and the user's own icon files.
//! File: content/hints/icons.js. A content script (runs on chess.com and lichess pages); files of one kind share a single global scope and load in the order of manifest.json.

// Icons for the kinds of move, drawn as vector shapes in unit space (the disc has radius 1), in the style of a
// game review: a coloured disc with a white ring and a bold glyph. Used on the board and, small, in the panel.
// Icon files the user put into the extension's icons/ folder (brilliant.svg|png|webp, great.*, best.*, ...).
// They replace the drawn icons. Which ones exist is found out once by trying to load each of them.
const ICON_FILES = {};
function probeIconFiles() {
  for (const id of Object.keys(QUALITY)) {
    for (const ext of ["svg", "png", "webp"]) {
      try {
        const url = browser.runtime.getURL(`icons/${id}.${ext}`);
        const img = new Image();
        img.onload = () => {
          if (!ICON_FILES[id] || ext === "svg") {
            ICON_FILES[id] = url;
            rerender(); // show the real icon on the hint that is already drawn
          }
        };
        img.src = url; // a missing file simply never loads
      } catch (e) {}
    }
  }
}

function iconMarkup(cls) {
  if (ICON_FILES[cls.id]) {
    return `<image href="${ICON_FILES[cls.id]}" x="-1.08" y="-1.08" width="2.16" height="2.16" preserveAspectRatio="xMidYMid meet"/>`;
  }
  const ink = cls.id === "inaccuracy" ? "#2b2300" : "#fff"; // white on every disc, dark only on the yellow one
  const excl = `<path d="M0 -0.56 V0.1"/><circle cx="0" cy="0.5" r="0.15" fill="${ink}" stroke="none"/>`;
  const ques = `<path d="M-0.3 -0.28 A0.34 0.34 0 1 1 0.12 0.04 C0.02 0.12 0 0.2 0 0.3"/><circle cx="0" cy="0.62" r="0.15" fill="${ink}" stroke="none"/>`;
  const at = (x, k, body) => `<g transform="translate(${x} 0) scale(${k})">${body}</g>`;
  const star = (() => {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI / 5) * i - Math.PI / 2;
      const r = i % 2 ? 0.27 : 0.66;
      pts.push(`${(Math.cos(a) * r).toFixed(3)},${(Math.sin(a) * r + 0.04).toFixed(3)}`);
    }
    return `<polygon points="${pts.join(" ")}" fill="${ink}" stroke-width="0.08"/>`;
  })();
  const check = `<path d="M-0.44 0.04 L-0.12 0.36 L0.46 -0.3"/>`;
  const glyph = {
    brilliant: at(-0.31, 0.78, excl) + at(0.31, 0.78, excl),
    great: at(0, 0.95, excl),
    best: star,
    excellent: check,
    good: at(0, 0.8, check),
    inaccuracy: at(-0.3, 0.68, ques) + at(0.4, 0.62, excl),
    mistake: at(0, 0.95, ques),
    blunder: at(-0.34, 0.68, ques) + at(0.34, 0.68, ques),
    book: `<path d="M0 -0.4 V0.46 M0 -0.4 C-0.18 -0.52 -0.46 -0.52 -0.6 -0.4 V0.38 C-0.46 0.28 -0.18 0.28 0 0.46 C0.18 0.28 0.46 0.28 0.6 0.38 V-0.4 C0.46 -0.52 0.18 -0.52 0 -0.4" stroke-width="0.2"/>`,
    forced: `<path d="M-0.5 0 H0.46 M0.1 -0.38 L0.5 0 L0.1 0.38"/>`,
    miss: `<path d="M-0.4 -0.4 L0.4 0.4 M0.4 -0.4 L-0.4 0.4"/>`,
  }[cls.id];
  return `<circle r="1" fill="${cls.colour}" stroke="#fff" stroke-width="0.1"/><g fill="none" stroke="${ink}" stroke-width="0.27" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>`;
}

function qualityIcon(cls, cx, cy, r) {
  const g = svgEl("g", { transform: `translate(${cx} ${cy}) scale(${r})` });
  g.innerHTML = iconMarkup(cls);
  return g;
}