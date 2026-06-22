// ============================================================
// NO WAY OUT — procedural forest engine
// Recursive branching trees rendered to <canvas>, parallax-ready.
// ============================================================

// deterministic PRNG so a given seed always draws the same forest
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawTree(ctx, x, baseY, trunkLen, trunkW, ang, rnd, color, maxDepth, sway = 0) {
  function branch(x, y, len, w, a, depth) {
    if (depth > maxDepth || w < 0.4) return;
    const rad = (a * Math.PI) / 180;
    const x2 = x + Math.cos(rad) * len;
    const y2 = y + Math.sin(rad) * len;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = w;
    ctx.strokeStyle = color;
    ctx.lineCap = "round";
    ctx.stroke();
    const n = rnd() < 0.4 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const spread = (14 + rnd() * 20) * (rnd() < 0.5 ? -1 : 1);
      let na = a + spread + (rnd() - 0.5) * 12 + sway;
      na = Math.max(-172, Math.min(-8, na));
      branch(x2, y2, len * (0.68 + rnd() * 0.12), w * (0.6 + rnd() * 0.1), na, depth + 1);
    }
  }
  branch(x, baseY, trunkLen, trunkW, ang, 0);
}

/**
 * Renders a forest band into a canvas.
 * opts: { width, height, count, baseBand:[y0,y1], scaleRange:[s0,s1], seed, palette:[colors far->near], sway, maxDepthRange:[a,b] }
 */
function renderForest(canvas, opts) {
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = opts.width * dpr;
  canvas.height = opts.height * dpr;
  canvas.style.width = opts.width + "px";
  canvas.style.height = opts.height + "px";
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, opts.width, opts.height);

  const rnd = mulberry32(opts.seed);
  const items = [];
  for (let i = 0; i < opts.count; i++) {
    const t = rnd();
    const x = -40 + rnd() * (opts.width + 80);
    const baseY = opts.baseBand[0] + t * (opts.baseBand[1] - opts.baseBand[0]) + (rnd() - 0.5) * 14;
    const sc = opts.scaleRange[0] + t * (opts.scaleRange[1] - opts.scaleRange[0]);
    const h = opts.height * sc * (0.85 + rnd() * 0.3);
    const w = Math.max(0.8, 3 * sc * (0.8 + rnd() * 0.4));
    items.push({ t, x, baseY, h, w });
  }
  items.sort((a, b) => a.t - b.t);
  items.forEach((it, i) => {
    const ci = Math.min(opts.palette.length - 1, Math.floor(it.t * opts.palette.length));
    const color = opts.palette[ci];
    const op = 0.55 + it.t * 0.45;
    ctx.save();
    ctx.globalAlpha = op;
    const depth = opts.maxDepthRange
      ? Math.floor(opts.maxDepthRange[0] + rnd() * (opts.maxDepthRange[1] - opts.maxDepthRange[0]))
      : 9;
    drawTree(ctx, it.x, it.baseY, it.h * 0.26, it.w, -90, mulberry32(opts.seed * 991 + i * 7 + 3), color, depth, opts.sway || 0);
    ctx.restore();
  });
}

window.NWOForest = { renderForest, mulberry32 };
