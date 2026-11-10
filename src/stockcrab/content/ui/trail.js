// Cursor trail: small particles behind the mouse pointer.

let trailCanvas = null;
let trailParts = [];
let trailFrame = 0;

// A colour mixed with white.
function mixWhite(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.round(v + (255 - v) * k).toString(16).padStart(2, "0");
  return "#" + f(n >> 16) + f((n >> 8) & 255) + f(n & 255);
}

function trailColours() {
  const base = /^#[0-9a-f]{6}$/i.test(settings.accent) ? settings.accent : "#e4572e";
  return settings.flowColours === "duo" ? [base, settings.colourPremove || "#00b8d4"] : [base, deepShade(base), mixWhite(base, 0.4)];
}

function trailSize() {
  const dpr = window.devicePixelRatio || 1;
  trailCanvas.width = innerWidth * dpr;
  trailCanvas.height = innerHeight * dpr;
  trailCanvas.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
}

function trailStep(now) {
  const ctx = trailCanvas.getContext("2d");
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  trailParts = trailParts.filter((p) => now - p.born < p.life);
  for (const p of trailParts) {
    const t = (now - p.born) / p.life;
    const dt = (now - p.last) / 16.7;
    p.last = now;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 0.03 * dt;
    ctx.globalAlpha = (1 - t) * 0.9;
    ctx.fillStyle = p.c;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * (1 - t * 0.7), 0, Math.PI * 2);
    ctx.fill();
  }
  trailFrame = trailParts.length ? requestAnimationFrame(trailStep) : 0;
  if (!trailFrame) ctx.clearRect(0, 0, innerWidth, innerHeight);
}

addEventListener("pointermove", (e) => {
  if (!settings.enabled || !settings.cursorTrail || e.pointerType === "touch" || !extensionAlive()) return;
  if (!trailCanvas || !trailCanvas.isConnected) {
    trailCanvas = document.createElement("canvas");
    trailCanvas.className = "stockcrab-trail";
    trailCanvas.style.cssText = "position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483646";
    document.documentElement.appendChild(trailCanvas);
    trailSize();
    addEventListener("resize", trailSize);
  }
  const now = performance.now();
  const cols = trailColours();
  for (let i = 0; i < 2 && trailParts.length < 220; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = 0.3 + Math.random() * 0.9;
    trailParts.push({
      x: e.clientX, y: e.clientY, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.4,
      r: 1.6 + Math.random() * 2.4, c: cols[(Math.random() * cols.length) | 0],
      born: now, last: now, life: 450 + Math.random() * 400,
    });
  }
  if (!trailFrame) trailFrame = requestAnimationFrame(trailStep);
}, { passive: true, capture: true });
