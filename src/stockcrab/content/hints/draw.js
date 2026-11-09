//! StockCrab · Hint painter
//! Draws the arrows, outlines, cards and icons over the board (one SVG, one blur layer).
//! File: content/hints/draw.js. A content script (runs on chess.com and lichess pages); files of one kind share a single global scope and load in the order of manifest.json.

const fading = new WeakSet();

// Removes the drawn hint. With `fade` it dissolves for ~140 ms first (when animations are on).
function clearMarks(fade = false) {
  const soft = fade && settings.animate && !reducedMotion();
  document.querySelectorAll("." + MARK).forEach((el) => {
    if (fading.has(el)) return;
    if (soft && el.animate) {
      fading.add(el);
      try {
        const a = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, easing: "ease-in", fill: "forwards" });
        a.onfinish = () => el.remove();
        setTimeout(() => el.remove(), 400); // safety net if the animation never reports back
        return;
      } catch (e) {}
    }
    el.remove();
  });
}

const SVG_NS = "http://www.w3.org/2000/svg";
const svgEl = (name, attrs) => {
  const el = document.createElementNS(SVG_NS, name);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
};

const colourOf = (kind) => ({ best: settings.colourBest, alt: settings.colourAlt, premove: settings.colourPremove })[kind];

function squareRect(board, sq, boardRect) {
  if (SITE === "lichess") {
    const r = (board.querySelector("cg-board") || board).getBoundingClientRect();
    const size = r.width / 8;
    const white = bottomColour(board) === "w";
    const f = FILES.indexOf(sq[0]);
    const rank = Number(sq[1]);
    return {
      x: r.left - boardRect.left + (white ? f : 7 - f) * size,
      y: r.top - boardRect.top + (white ? 8 - rank : rank - 1) * size,
      w: size,
      h: size,
    };
  }
  const probe = document.createElement("div");
  probe.className = `highlight ${MARK} square-${FILES.indexOf(sq[0]) + 1}${sq[1]}`;
  probe.style.cssText = "visibility:hidden;pointer-events:none";
  board.appendChild(probe);
  const r = probe.getBoundingClientRect();
  probe.remove();
  if (!r.width || Math.abs(r.width / (boardRect.width / 8) - 1) > 0.12) {
    const size = boardRect.width / 8;
    const white = bottomColour(board) === "w";
    const f = FILES.indexOf(sq[0]);
    const rank = Number(sq[1]);
    return { x: (white ? f : 7 - f) * size, y: (white ? 8 - rank : rank - 1) * size, w: size, h: size };
  }
  return { x: r.left - boardRect.left, y: r.top - boardRect.top, w: r.width, h: r.height };
}

const FONT = '"Inter","SF Pro Text","Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';

// Short, simple appearance animations (Web Animations API). Skipped when the page asks for reduced motion.
const reducedMotion = () => {
  try {
    return matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {
    return false;
  }
};
function animateIn(el, frames, delay = 0, duration = 180) {
  if (!el || !el.animate) return;
  try {
    el.animate(frames, { duration, delay, easing: "cubic-bezier(.2,.7,.3,1)", fill: "backwards" });
  } catch (e) {}
}

// Black or white text, whichever reads better on a badge of this colour.
function textOn(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return "#fff";
  const n = parseInt(m[1], 16);
  const lin = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.34 ? "#1b1b1b" : "#fff";
}

// Arrows, square outlines and score badges as one SVG in the board's own pixel space.
// Every part can be switched off or restyled from the panel.
function drawMarks(board, marks, animate = false) {
  const anim = animate && settings.animate && !reducedMotion();
  clearMarks(anim);
  current = null;
  if (!marks.length) return;
  if (getComputedStyle(board).position === "static") board.style.position = "relative";
  const br = board.getBoundingClientRect();
  const svg = svgEl("svg", { class: MARK, width: br.width, height: br.height, viewBox: `0 0 ${br.width} ${br.height}` });
  svg.style.cssText = "position:absolute;left:0;top:0;pointer-events:none;z-index:20;overflow:visible";
  const k = settings.lineWidth / 100;
  const infos = []; // per move: the icon and the card to place on its target cell
  const allParts = []; // every arrow's polygons: the card and the icon keep clear of them

  // Frosted glass: SVG cannot blur what is behind it, so thin HTML layers with `backdrop-filter` sit under the
  // drawing, each clipped to the exact shape of an outline ring or an arrow. The pieces inside the cell stay sharp.
  const blurPx = settings.blur;
  const blurLayer = blurPx > 0 ? document.createElement("div") : null;
  if (blurLayer) {
    blurLayer.setAttribute("class", MARK);
    blurLayer.style.cssText = `position:absolute;left:0;top:0;width:${br.width}px;height:${br.height}px;pointer-events:none;z-index:19`;
  }
  const blurShape = (x, y, w, h, clip) => {
    if (!blurLayer) return;
    const d = document.createElement("div");
    d.style.cssText =
      `position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;` +
      `backdrop-filter:blur(${blurPx}px);-webkit-backdrop-filter:blur(${blurPx}px);clip-path:${clip}`;
    blurLayer.appendChild(d);
  };
  // "M x y L ... Z" for a polygon, always clockwise so that several polygons in one path add up (nonzero fill)
  const polyPath = (pts, ox, oy) => {
    let area = 0;
    pts.forEach(([x, y], i) => {
      const [nx, ny] = pts[(i + 1) % pts.length];
      area += x * ny - nx * y;
    });
    const p = area < 0 ? pts.slice().reverse() : pts;
    return "M" + p.map(([x, y]) => `${(x - ox).toFixed(2)} ${(y - oy).toFixed(2)}`).join("L") + "Z";
  };

  // Last in the list is drawn first, so the main move ends up on top.
  for (const m of marks.slice().reverse()) {
    const from = squareRect(board, m.move.slice(0, 2), br);
    const to = squareRect(board, m.move.slice(2, 4), br);
    if (!from.w || !to.w) continue;
    const played = m.kind === "played"; // the rating of the move I played: just the icon and the word, no outline or arrow
    const col = played ? m.cls.colour : colourOf(m.kind);
    const sq = from.w;
    const alt = m.kind === "alt";
    const op = (alt ? 0.68 : 1) * (settings.opacity / 100);
    // The outlines and the arrow of one move are ONE layer: the see-through is applied to the group as a whole,
    // so where the shaft meets the head, the round start of the line, or the arrow crosses an outline, nothing
    // gets darker (separately transparent pieces would show through each other).
    const shape = svgEl("g", { opacity: op });
    svg.appendChild(shape);

    if (settings.showOutline && !played) {
      const ow = sq * 0.04 * k;
      for (const r of [from, to]) {
        const outline = svgEl("rect", {
          x: r.x + ow / 2, y: r.y + ow / 2, width: r.w - ow, height: r.h - ow,
          fill: "none", stroke: m.kind === "premove" ? settings.colourPremove : settings.colourOutline, "stroke-width": ow, "stroke-linejoin": "miter",
        });
        shape.appendChild(outline);
        if (anim) animateIn(outline, [{ opacity: 0 }, { opacity: 1 }], 0, 160);
        // ring-shaped blur exactly as wide as the outline's own stroke: nothing outside the line is blurred
        const band = ow;
        blurShape(r.x, r.y, r.w, r.h, `path(evenodd, "M0 0H${r.w}V${r.h}H0ZM${band} ${band}V${r.h - band}H${r.w - band}V${band}Z")`);
      }
    }

    const fc = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
    const tc = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
    const len = Math.hypot(tc.x - fc.x, tc.y - fc.y);
    const arrowParts = []; // the polygons of this arrow (shaft and head), for the blur and to keep the card clear of it
    if (len && !played) {
      const ux = (tc.x - fc.x) / len;
      const uy = (tc.y - fc.y) / len;
      const lw = (alt ? sq * 0.05 : sq * 0.075) * k;
      const hl = settings.showHead ? Math.min(sq * 0.45, sq * (alt ? 0.22 : 0.27) * (0.6 + 0.4 * k)) : 0;
      const hw = hl * 0.6;
      const bx = tc.x - ux * hl; // where the head starts
      const by = tc.y - uy * hl;
      const x2 = bx + ux * hl * 0.2;
      const y2 = by + uy * hl * 0.2;
      const line = svgEl("line", {
        x1: fc.x, y1: fc.y, x2, y2, "stroke-linecap": "round",
        stroke: col, "stroke-width": lw,
      });
      shape.appendChild(line);
      if (anim) {
        // the line is drawn from the piece towards the target
        const L = Math.hypot(x2 - fc.x, y2 - fc.y);
        animateIn(line, [{ strokeDasharray: `${L}`, strokeDashoffset: L }, { strokeDasharray: `${L}`, strokeDashoffset: 0 }], 0, 200);
      }
      if (hl) {
        const tip = { x: tc.x - ux * sq * 0.03, y: tc.y - uy * sq * 0.03 };
        const headEl = svgEl("polygon", {
          points: `${tip.x},${tip.y} ${bx - uy * hw},${by + ux * hw} ${bx + uy * hw},${by - ux * hw}`,
          fill: col, stroke: col, "stroke-width": sq * 0.025, "stroke-linejoin": "round",
        });
        shape.appendChild(headEl);
        // the head appears just before the line reaches it, growing out of the tip
        if (anim) animateIn(headEl, [{ opacity: 0, transform: "scale(0.5)", transformOrigin: `${tip.x}px ${tip.y}px` }, { transform: "scale(1)", transformOrigin: `${tip.x}px ${tip.y}px` }], 120, 150);
      }
      // exactly the shape of the drawing: a strip as wide as the line, a triangle as big as the head
      const half = lw / 2;
      const back = lw / 2; // the line has a round cap at its start
      const sx = fc.x - ux * back;
      const sy = fc.y - uy * back;
      const shaft = [[sx - uy * half, sy + ux * half], [sx + uy * half, sy - ux * half], [x2 + uy * half, y2 - ux * half], [x2 - uy * half, y2 + ux * half]];
      arrowParts.push(shaft);
      if (hl) arrowParts.push([[tc.x - ux * sq * 0.03, tc.y - uy * sq * 0.03], [bx - uy * hw, by + ux * hw], [bx + uy * hw, by - ux * hw]]);
      if (blurLayer) {
        const xs = arrowParts.flat().map((p) => p[0]);
        const ys = arrowParts.flat().map((p) => p[1]);
        const ox = Math.min(...xs) - 1;
        const oy = Math.min(...ys) - 1;
        const w = Math.max(...xs) + 1 - ox;
        const h = Math.max(...ys) + 1 - oy;
        blurShape(ox, oy, w, h, `path("${arrowParts.map((pts) => polyPath(pts, ox, oy)).join("")}")`);
      }
    }

    // What goes on the target cell next to the arrow: the icon of the kind of move and one compact card (the score on
    // top, below it the kind of move: "Brilliant", "Great", "premove", and the cell's name if switched on). Both are
    // placed in the last pass, once the card's size is known, in a corner of the cell the arrow does not touch.
    const score = settings.showLabels && m.label ? m.label : "";
    const words = [settings.showSquare && m.move.slice(2, 4), settings.showQuality && qualityText(m.cls, !settings.showIcon), m.kind === "premove" && "premove"].filter(Boolean).join(" · ");
    const info = { to, sq, op, cls: settings.showIcon && m.cls ? m.cls : null, card: null };
    if (score || words) {
      const text = (str, fs, weight, extra = "") => {
        const t = svgEl("text", {
          "font-size": fs, "font-weight": weight, "font-family": FONT, fill: textOn(col), "dominant-baseline": "central",
          style: `font-variant-numeric:tabular-nums;letter-spacing:0.01em;${extra}`,
        });
        t.textContent = str;
        return t;
      };
      const card = svgEl("rect", { fill: col, opacity: Math.min(1, op + 0.05) });
      // the rating of a played move has no score: its word is the whole card, so it is set like a score
      const wordOnly = played && !score;
      const t1 = score ? text(score, sq * (alt ? 0.125 : 0.14), 700) : wordOnly ? text(words, sq * 0.12, 700) : null;
      const t2 = words && !wordOnly ? text(words, sq * 0.09, 500, "opacity:.92") : null;
      svg.appendChild(card);
      if (t1) svg.appendChild(t1);
      if (t2) svg.appendChild(t2);
      info.card = { card, t1, t2, fs1: wordOnly ? sq * 0.12 : sq * (alt ? 0.125 : 0.14), fs2: sq * 0.09 };
    }
    if (info.cls || info.card) infos.push(info);
    allParts.push(...arrowParts);
  }
  if (blurLayer) {
    board.appendChild(blurLayer); // under the drawing (z-index 19 < 20); the cards below add their shapes to it
    if (anim) animateIn(blurLayer, [{ opacity: 0 }, { opacity: 1 }], 0, 160);
  }
  board.appendChild(svg);

  // Place the icon and the card of every move. The card is sized to its text (measured once it is in the page,
  // estimated if that is impossible); if it is too wide for its row, both lines shrink together. They normally sit in
  // the top corners (card left, icon right); if an arrow runs through that spot they move to another corner of the
  // cell, the first arrangement that no arrow touches (otherwise the one touched least).
  const polyHitsRect = (poly, r) => {
    const inside = (p) => p[0] >= r.x && p[0] <= r.x + r.w && p[1] >= r.y && p[1] <= r.y + r.h;
    if (poly.some(inside)) return true;
    const rc = [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];
    const inPoly = (p) => {
      let c = false;
      for (let i = 0, k = poly.length - 1; i < poly.length; k = i++) {
        const [xi, yi] = poly[i];
        const [xk, yk] = poly[k];
        if (yi > p[1] !== yk > p[1] && p[0] < ((xk - xi) * (p[1] - yi)) / (yk - yi) + xi) c = !c;
      }
      return c;
    };
    if (rc.some(inPoly)) return true;
    const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const meets = (a, b, c, d) => cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0;
    for (let i = 0; i < poly.length; i++) {
      for (let k = 0; k < 4; k++) if (meets(poly[i], poly[(i + 1) % poly.length], rc[k], rc[(k + 1) % 4])) return true;
    }
    return false;
  };
  const GAPS = [0.05, 0.04, 0.03, 0.02, 0.01, 0]; // gaps to try, in cells: the card and the icon keep as much air from an arrow as possible
  const OPTIONS = [["TL", "TR"], ["BL", "BR"], ["TL", "BR"], ["BL", "TR"], ["TR", "TL"], ["BR", "BL"], ["TR", "BL"], ["BR", "TL"], ["TR", "BR"], ["BR", "TR"], ["TL", "BL"], ["BL", "TL"]];
  for (const c of infos) {
    const { to, sq } = c;
    const margin = sq * 0.1; // the card never touches the cell's walls
    const r = sq * 0.14;
    const im = sq * 0.08;
    // the card at full size
    let k = null;
    if (c.card) {
      const width = (t, fs) => {
        if (!t) return 0;
        let w;
        try {
          w = t.getComputedTextLength();
        } catch (e) {}
        return w || t.textContent.length * fs * 0.6;
      };
      const { t1, t2 } = c.card;
      const w = Math.max(width(t1, c.card.fs1), width(t2, c.card.fs2));
      k = { w, padX: c.card.fs1 * 0.4, padY: c.card.fs1 * 0.22, gap: t1 && t2 ? c.card.fs1 * 0.1 : 0, f: 1 };
      k.total = w + k.padX * 2;
    }
    const layouts = [];
    const corners = c.cls && k ? OPTIONS : c.cls ? [["", "TR"], ["", "BR"], ["", "TL"], ["", "BL"]] : [["TL", ""], ["BL", ""], ["BR", ""], ["TR", ""]];
    for (const [cc, ic, shrink = 1] of k ? corners.concat(corners.map(([a, b]) => [a, b, 0.8])) : corners) {
      let f = shrink; // a smaller card is the last resort when the arrow leaves little room
      let total = k ? k.total * f : 0;
      if (k) {
        // in the row of the icon the card ends a little before it, otherwise it may use the cell's width
        const sameRow = ic && cc[0] === ic[0];
        const maxW = sameRow ? to.w - im - r * 2 - sq * 0.04 - margin : to.w - margin * 2;
        if (total > maxW) {
          f *= maxW / total;
          total = maxW;
        }
      }
      const h = k ? k.padY * 2 * f + (c.card.t1 ? c.card.fs1 * f : 0) + (c.card.t2 ? c.card.fs2 * f : 0) + k.gap * f : 0;
      const cardRect = k ? { x: cc[1] === "L" ? to.x + margin : to.x + to.w - margin - total, y: cc[0] === "T" ? to.y + margin : to.y + to.h - margin - h, w: total, h } : null;
      const iconRect = ic ? { x: ic[1] === "L" ? to.x + im : to.x + to.w - im - r * 2, y: ic[0] === "T" ? to.y + im : to.y + to.h - im - r * 2, w: r * 2, h: r * 2 } : null;
      // how much air is there between the arrows and the card / the icon: the first (largest) gap that no arrow breaks
      const grow = (q, g) => ({ x: q.x - g, y: q.y - g, w: q.w + g * 2, h: q.h + g * 2 });
      let level = 0; // 0 = the full gap is free, GAPS.length = an arrow runs right through
      for (const q of [cardRect, iconRect]) {
        if (!q) continue;
        let i = 0;
        while (i < GAPS.length && allParts.some((poly) => polyHitsRect(poly, grow(q, GAPS[i] * sq)))) i++;
        level = Math.max(level, i);
      }
      layouts.push({ f, total, h, cardRect, iconRect, level });
    }
    const best = layouts.reduce((a, b) => (b.level < a.level ? b : a));
    if (c.card && k) {
      const { card, t1, t2 } = c.card;
      const { cardRect: q } = best;
      const fs1 = c.card.fs1 * best.f;
      const fs2 = c.card.fs2 * best.f;
      const padX = k.padX * best.f;
      const padY = k.padY * best.f;
      const gap = k.gap * best.f;
      if (best.f < 1) {
        if (t1) t1.setAttribute("font-size", fs1);
        if (t2) t2.setAttribute("font-size", fs2);
      }
      card.setAttribute("x", q.x);
      card.setAttribute("y", q.y);
      card.setAttribute("width", q.w);
      card.setAttribute("height", q.h);
      card.setAttribute("rx", sq * 0.05);
      blurShape(q.x, q.y, q.w, q.h, `inset(0 round ${sq * 0.05}px)`); // exactly under the card
      let cy = q.y + padY;
      if (t1) {
        t1.setAttribute("x", q.x + padX);
        t1.setAttribute("y", cy + fs1 / 2);
        cy += fs1 + gap;
      }
      if (t2) {
        t2.setAttribute("x", q.x + padX);
        t2.setAttribute("y", cy + fs2 / 2);
      }
      if (anim) {
        const origin = `${q.x + q.w / 2}px ${q.y + q.h / 2}px`;
        for (const el of [card, t1, t2]) {
          if (el) animateIn(el, [{ opacity: 0, transform: "scale(0.6)", transformOrigin: origin }, { transform: "scale(1)", transformOrigin: origin }], 150, 170);
        }
      }
    }
    if (c.cls) {
      const q = best.iconRect;
      const cx = q.x + r;
      const cy = q.y + r;
      const icon = qualityIcon(c.cls, cx, cy, r);
      icon.setAttribute("opacity", Math.min(1, c.op + 0.05));
      svg.appendChild(icon);
      blurShape(q.x, q.y, q.w, q.h, `circle(${r}px at ${r}px ${r}px)`); // exactly under the round icon
      if (anim) animateIn(icon, [{ opacity: 0, transform: `translate(${cx}px, ${cy}px) scale(${r * 0.5})` }, { transform: `translate(${cx}px, ${cy}px) scale(${r})` }], 190, 160);
    }
  }
  current = { marks, size: `${Math.round(br.width)}x${Math.round(br.height)}` };
}
