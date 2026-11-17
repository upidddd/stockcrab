// Cursor trail: a thin ribbon behind the mouse pointer that narrows to its tail and pulls back when the mouse stops.

const TRAIL_LIFE = 180; // ms a point stays in the ribbon
const TRAIL_WIDTH = 4.4; // px at the pointer
let trailCanvas = null;
let trailPts = [];
let trailFrame = 0;

function trailSize() {
  const dpr = window.devicePixelRatio || 1;
  trailCanvas.width = innerWidth * dpr;
  trailCanvas.height = innerHeight * dpr;
  trailCanvas.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
}

// The ribbon as one filled outline: left edge forward, round head, right edge back.
function trailStep(now) {
  const ctx = trailCanvas.getContext("2d");
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  trailPts = trailPts.filter((p) => now - p.t < TRAIL_LIFE);
  const n = trailPts.length;
  if (n < 2) {
    trailPts = [];
    trailFrame = 0;
    return;
  }
  const left = [];
  const right = [];
  for (let i = 0; i < n; i++) {
    const p = trailPts[i];
    const a = trailPts[Math.max(0, i - 1)];
    const b = trailPts[Math.min(n - 1, i + 1)];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    const life = 1 - (now - p.t) / TRAIL_LIFE;
    const w = (TRAIL_WIDTH / 2) * Math.pow(life, 1.4) * (0.35 + 0.65 * (i / (n - 1)));
    left.push([p.x + nx * w, p.y + ny * w]);
    right.push([p.x - nx * w, p.y - ny * w]);
  }
  const head = trailPts[n - 1];
  const headW = Math.hypot(left[n - 1][0] - head.x, left[n - 1][1] - head.y);
  ctx.beginPath();
  ctx.moveTo(trailPts[0].x, trailPts[0].y);
  for (let i = 1; i < n; i++) ctx.quadraticCurveTo(left[i - 1][0], left[i - 1][1], (left[i - 1][0] + left[i][0]) / 2, (left[i - 1][1] + left[i][1]) / 2);
  ctx.lineTo(left[n - 1][0], left[n - 1][1]);
  const ang = Math.atan2(left[n - 1][1] - head.y, left[n - 1][0] - head.x);
  ctx.arc(head.x, head.y, headW, ang, ang + Math.PI, true);
  for (let i = n - 1; i > 0; i--) ctx.quadraticCurveTo(right[i][0], right[i][1], (right[i][0] + right[i - 1][0]) / 2, (right[i][1] + right[i - 1][1]) / 2);
  ctx.closePath();
  const tail = trailPts[0];
  const grad = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
  const col = /^#[0-9a-f]{6}$/i.test(settings.accent) ? settings.accent : DEFAULTS.accent;
  grad.addColorStop(0, col + "00");
  grad.addColorStop(1, col + "e6");
  ctx.fillStyle = grad;
  ctx.fill();
  trailFrame = requestAnimationFrame(trailStep);
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
  const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
  for (const ev of events.length ? events : [e]) {
    const last = trailPts[trailPts.length - 1];
    if (last && Math.hypot(ev.clientX - last.x, ev.clientY - last.y) < 2) continue;
    trailPts.push({ x: ev.clientX, y: ev.clientY, t: now });
  }
  if (trailPts.length > 64) trailPts.splice(0, trailPts.length - 64);
  if (!trailFrame) trailFrame = requestAnimationFrame(trailStep);
}, { passive: true, capture: true });
