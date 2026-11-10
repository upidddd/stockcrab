// Draws the hints (arrows, outlines, cards) over the board.

const fading = new WeakSet();

// Removes the hints, optionally fading out.
function clearMarks(fade = false) {
  const soft = fade && settings.animate;
  document.querySelectorAll("." + MARK).forEach((el) => {
    if (fading.has(el)) return;
    if (soft && el.animate) {
      fading.add(el);
      try {
        const a = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, easing: "ease-in", fill: "forwards" });
        a.onfinish = () => el.remove();
        setTimeout(() => el.remove(), 400);
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

// Appearance animations (the panel switches decide, not the system's reduced-motion setting).
function animateIn(el, frames, delay = 0, duration = 180) {
  if (!el || !el.animate) return;
  try {
    el.animate(frames, { duration, delay, easing: "cubic-bezier(.2,.7,.3,1)", fill: "backwards" });
  } catch (e) {}
}

// Black or white text for a badge colour.
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

// Darker shade for the gradient.
function deepShade(hex) {
  if (/^#e4572e$/i.test(hex)) return "#a8341a";
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const f = (v) => Math.round(v * 0.68).toString(16).padStart(2, "0");
  return "#" + f(n >> 16) + f((n >> 8) & 255) + f(n & 255);
}
const PROMOTION = { q: "= Queen", r: "= Rook", b: "= Bishop", n: "= Knight" };
let flowCounter = 0;

// Draws all hints as one SVG over the board.
function drawMarks(board, marks, animate = false) {
  const anim = animate && settings.animate;
  clearMarks(anim);
  current = null;
  if (!marks.length) return;
  if (getComputedStyle(board).position === "static") board.style.position = "relative";
  const br = board.getBoundingClientRect();
  const svg = svgEl("svg", { class: MARK, width: br.width, height: br.height, viewBox: `0 0 ${br.width} ${br.height}` });
  // Flowing gradient for a colour.
  const defs = svgEl("defs", {});
  svg.appendChild(defs);
  const flowId = ++flowCounter;
  const paints = {};
  const paint = (col) => {
    const mode = settings.flowColours === true ? "crab" : settings.flowColours;
    if (!mode || mode === "off") return col;
    if (paints[col]) return paints[col];
    const id = `stockcrab-flow-${flowId}-${Object.keys(paints).length}`;
    const span = (br.width / 8) * 1.1;
    const g = svgEl("linearGradient", { id, gradientUnits: "userSpaceOnUse", x1: 0, y1: 0, x2: span, y2: span, spreadMethod: "reflect" });
    g.appendChild(svgEl("stop", { offset: 0, "stop-color": col }));
    const other = mode === "duo" ? (col.toLowerCase() === String(settings.colourPremove).toLowerCase() ? settings.colourBest : settings.colourPremove) : deepShade(col);
    g.appendChild(svgEl("stop", { offset: 1, "stop-color": other }));
    g.appendChild(svgEl("animateTransform", { attributeName: "gradientTransform", type: "translate", from: "0 0", to: `${2 * span} ${2 * span}`, dur: "2.6s", repeatCount: "indefinite" }));
    defs.appendChild(g);
    return (paints[col] = `url(#${id})`);
  };
  svg.style.cssText = "position:absolute;left:0;top:0;pointer-events:none;z-index:20;overflow:visible";
  const k = settings.lineWidth / 100;
  const infos = [];
  const allParts = [];

  // Blur layer: plain boxes under the drawing (Chromium ignores clip-path here).
  const blurPx = settings.blur;
  const blurLayer = blurPx > 0 ? document.createElement("div") : null;
  if (blurLayer) {
    blurLayer.setAttribute("class", MARK);
    blurLayer.style.cssText = `position:absolute;left:0;top:0;width:${br.width}px;height:${br.height}px;pointer-events:none;z-index:19`;
  }
  const blurShape = (x, y, w, h, extra = "") => {
    if (!blurLayer || !(w > 0) || !(h > 0)) return;
    const d = document.createElement("div");
    d.style.cssText =
      `position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;` +
      `backdrop-filter:blur(${blurPx}px);-webkit-backdrop-filter:blur(${blurPx}px);${extra}`;
    blurLayer.appendChild(d);
  };
  const blurBar = (x, y, ux, uy, len, thick, round) =>
    blurShape(x, y - thick / 2, len, thick, `transform-origin:0 50%;transform:rotate(${Math.atan2(uy, ux)}rad);` + (round ? `border-radius:${thick / 2}px;` : ""));

  for (const m of marks.slice().reverse()) {
    const from = squareRect(board, m.move.slice(0, 2), br);
    const to = squareRect(board, m.move.slice(2, 4), br);
    if (!from.w || !to.w) continue;
    const col = colourOf(m.kind);
    const sq = from.w;
    const alt = m.kind === "alt";
    const op = (alt ? 0.68 : 1) * (settings.opacity / 100);
    // outlines and arrow of one move in one group
    const shape = svgEl("g", { opacity: op });
    svg.appendChild(shape);

    if (settings.showOutline) {
      const ow = sq * 0.04 * k;
      for (const r of [from, to]) {
        const outline = svgEl("rect", {
          x: r.x + ow / 2, y: r.y + ow / 2, width: r.w - ow, height: r.h - ow,
          fill: "none", stroke: paint(m.kind === "premove" ? settings.colourPremove : settings.colourOutline), "stroke-width": ow, "stroke-linejoin": "miter",
        });
        shape.appendChild(outline);
        if (anim) animateIn(outline, [{ opacity: 0 }, { opacity: 1 }], 0, 160);
        const band = ow;
        blurShape(r.x, r.y, r.w, band);
        blurShape(r.x, r.y + r.h - band, r.w, band);
        blurShape(r.x, r.y + band, band, r.h - 2 * band);
        blurShape(r.x + r.w - band, r.y + band, band, r.h - 2 * band);
      }
    }

    const fc = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
    const tc = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
    const len = Math.hypot(tc.x - fc.x, tc.y - fc.y);
    const arrowParts = [];
    if (len) {
      const ux = (tc.x - fc.x) / len;
      const uy = (tc.y - fc.y) / len;
      const lw = (alt ? sq * 0.05 : sq * 0.075) * k;
      const hl = settings.showHead ? Math.min(sq * 0.45, sq * (alt ? 0.22 : 0.27) * (0.6 + 0.4 * k)) : 0;
      const hw = hl * 0.6;
      const bx = tc.x - ux * hl;
      const by = tc.y - uy * hl;
      const x2 = bx + ux * hl * 0.2;
      const y2 = by + uy * hl * 0.2;
      const line = svgEl("line", {
        x1: fc.x, y1: fc.y, x2, y2, "stroke-linecap": "round",
        stroke: paint(col), "stroke-width": lw,
      });
      shape.appendChild(line);
      if (anim) {
        const L = Math.hypot(x2 - fc.x, y2 - fc.y);
        animateIn(line, [{ strokeDasharray: `${L}`, strokeDashoffset: L }, { strokeDasharray: `${L}`, strokeDashoffset: 0 }], 0, 200);
      }
      if (hl) {
        const tip = { x: tc.x - ux * sq * 0.03, y: tc.y - uy * sq * 0.03 };
        const headEl = svgEl("polygon", {
          points: `${tip.x},${tip.y} ${bx - uy * hw},${by + ux * hw} ${bx + uy * hw},${by - ux * hw}`,
          fill: paint(col), stroke: paint(col), "stroke-width": sq * 0.025, "stroke-linejoin": "round",
        });
        shape.appendChild(headEl);
        if (anim) animateIn(headEl, [{ opacity: 0, transform: "scale(0.5)", transformOrigin: `${tip.x}px ${tip.y}px` }, { transform: "scale(1)", transformOrigin: `${tip.x}px ${tip.y}px` }], 120, 150);
      }
      // blur shapes
      const half = lw / 2;
      const back = lw / 2;
      const sx = fc.x - ux * back;
      const sy = fc.y - uy * back;
      const shaft = [[sx - uy * half, sy + ux * half], [sx + uy * half, sy - ux * half], [x2 + uy * half, y2 - ux * half], [x2 - uy * half, y2 + ux * half]];
      arrowParts.push(shaft);
      if (hl) arrowParts.push([[tc.x - ux * sq * 0.03, tc.y - uy * sq * 0.03], [bx - uy * hw, by + ux * hw], [bx + uy * hw, by - ux * hw]]);
      if (blurLayer) {
        blurBar(sx, sy, ux, uy, Math.hypot(x2 - sx, y2 - sy), lw, true);
        if (hl) {
          const tipX = tc.x - ux * sq * 0.03;
          const tipY = tc.y - uy * sq * 0.03;
          const len = Math.hypot(tipX - bx, tipY - by);
          const n = 6;
          for (let i = 0; i < n; i++) {
            blurBar(bx + ux * (len * i) / n, by + uy * (len * i) / n, ux, uy, len / n, 2 * hw * (1 - (i + 0.5) / n), false);
          }
        }
      }
    }

    // card on the target cell
    const score = settings.showLabels && m.label ? m.label : "";
    const words = [PROMOTION[m.move[4]], settings.showSquare && m.move.slice(2, 4), m.kind === "premove" && "premove"].filter(Boolean).join(" · ");
    const info = { to, sq, op, card: null };
    if (score || words) {
      const text = (str, fs, weight, extra = "") => {
        const t = svgEl("text", {
          "font-size": fs, "font-weight": weight, "font-family": FONT, fill: textOn(col), "dominant-baseline": "central",
          style: `font-variant-numeric:tabular-nums;letter-spacing:0.01em;${extra}`,
        });
        t.textContent = str;
        return t;
      };
      const card = svgEl("rect", { fill: textOn(col) === "#fff" && settings.flowColours !== "duo" ? paint(col) : col, opacity: Math.min(1, op + 0.05) });
      const t1 = score ? text(score, sq * (alt ? 0.125 : 0.14), 700) : null;
      const t2 = words ? text(words, sq * 0.09, 500, "opacity:.92") : null;
      svg.appendChild(card);
      if (t1) svg.appendChild(t1);
      if (t2) svg.appendChild(t2);
      info.card = { card, t1, t2, fs1: sq * (alt ? 0.125 : 0.14), fs2: sq * 0.09 };
    }
    if (info.card) infos.push(info);
    allParts.push(...arrowParts);
  }
  if (blurLayer) {
    board.appendChild(blurLayer);
    if (anim) animateIn(blurLayer, [{ opacity: 0 }, { opacity: 1 }], 0, 160);
  }
  board.appendChild(svg);

  // Places the cards clear of the arrows.
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
  const GAPS = [0.05, 0.04, 0.03, 0.02, 0.01, 0]; // gaps to try, in cells
  const OPTIONS = [["TL", "TR"], ["BL", "BR"], ["TL", "BR"], ["BL", "TR"], ["TR", "TL"], ["BR", "BL"], ["TR", "BL"], ["BR", "TL"], ["TR", "BR"], ["BR", "TR"], ["TL", "BL"], ["BL", "TL"]];
  for (const c of infos) {
    const { to, sq } = c;
    const margin = sq * 0.1;
    const r = sq * 0.14;
    const im = sq * 0.08;
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
    const corners = [["TL", ""], ["BL", ""], ["BR", ""], ["TR", ""]];
    for (const [cc, ic, shrink = 1] of k ? corners.concat(corners.map(([a, b]) => [a, b, 0.8])) : corners) {
      let f = shrink;
      let total = k ? k.total * f : 0;
      if (k) {
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
      const grow = (q, g) => ({ x: q.x - g, y: q.y - g, w: q.w + g * 2, h: q.h + g * 2 });
      let level = 0;
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
      blurShape(q.x, q.y, q.w, q.h, `border-radius:${sq * 0.05}px`);
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
  }
  current = { marks, size: `${Math.round(br.width)}x${Math.round(br.height)}` };
}
