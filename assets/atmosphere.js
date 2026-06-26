// ============================================================
// NO WAY OUT — atmosphere: embers, leaves, dust, rain, lightning, cycle
// ============================================================

const CYCLE_DURATION_MS = 240000;
const CYCLE_PHASES = [
  { id: "dawn", frac: 0.125 },
  { id: "scouting", frac: 0.25 },
  { id: "race", frac: 0.125 },
  { id: "lockdown", frac: 0.0833 },
  { id: "night", frac: 0.4167 },
];

function observeVisibility(el, onChange) {
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => onChange(e.isIntersecting)),
    { threshold: 0.05 }
  );
  io.observe(el);
  return io;
}

class EmberField {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.count = opts.count ?? 26;
    this.color = opts.color ?? "230,183,60";
    this.speed = opts.speed ?? 1;
    this.particles = [];
    this.running = true;
    this._resize();
    window.addEventListener("resize", () => this._resize());
    this._seed();
    observeVisibility(canvas.closest("section, header, .coda") || canvas, (v) => {
      this.running = v;
      if (v) requestAnimationFrame(this._tick);
    });
    this._tick = this._tick.bind(this);
    requestAnimationFrame(this._tick);
  }
  _resize() {
    const r = this.canvas.getBoundingClientRect();
    this.w = r.width; this.h = r.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = this.w * dpr;
    this.canvas.height = this.h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  _seed() {
    this.particles = Array.from({ length: this.count }, () => this._spawn(true));
  }
  _spawn(initial = false) {
    return {
      x: Math.random() * this.w,
      y: initial ? Math.random() * this.h : this.h + 20,
      r: 0.6 + Math.random() * 1.8,
      vy: (0.18 + Math.random() * 0.35) * this.speed,
      vx: (Math.random() - 0.5) * 0.25,
      drift: Math.random() * Math.PI * 2,
      driftSpeed: 0.004 + Math.random() * 0.01,
      flick: Math.random() * Math.PI * 2,
    };
  }
  _tick() {
    if (!this.running) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    for (const p of this.particles) {
      p.y -= p.vy;
      p.drift += p.driftSpeed;
      p.x += Math.sin(p.drift) * 0.4 + p.vx * 0.1;
      p.flick += 0.07;
      if (p.y < -20) Object.assign(p, this._spawn(), { y: this.h + 10 });
      const flicker = 0.4 + Math.sin(p.flick) * 0.3;
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
      grad.addColorStop(0, `rgba(${this.color},${0.85 * flicker})`);
      grad.addColorStop(1, `rgba(${this.color},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(this._tick);
  }
}

class LeafField {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.count = opts.count ?? 14;
    this.color = opts.color ?? "90,154,130";
    this.particles = [];
    this.running = true;
    this._resize();
    window.addEventListener("resize", () => this._resize());
    this.particles = Array.from({ length: this.count }, () => this._spawn(true));
    observeVisibility(canvas.closest("section, header") || canvas, (v) => {
      this.running = v;
      if (v) requestAnimationFrame(this._tick);
    });
    this._tick = this._tick.bind(this);
    requestAnimationFrame(this._tick);
  }
  _resize() {
    const r = this.canvas.getBoundingClientRect();
    this.w = r.width; this.h = r.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = this.w * dpr;
    this.canvas.height = this.h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  _spawn(initial = false) {
    return {
      x: Math.random() * this.w,
      y: initial ? Math.random() * this.h : -20,
      r: 3 + Math.random() * 4,
      vy: 0.25 + Math.random() * 0.4,
      sway: Math.random() * Math.PI * 2,
      swaySpeed: 0.01 + Math.random() * 0.02,
      swayAmp: 18 + Math.random() * 22,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.03,
      x0: 0,
    };
  }
  _tick() {
    if (!this.running) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    for (const p of this.particles) {
      if (p.x0 === 0) p.x0 = p.x;
      p.y += p.vy;
      p.sway += p.swaySpeed;
      p.rot += p.rotSpeed;
      p.x = p.x0 + Math.sin(p.sway) * p.swayAmp;
      if (p.y > this.h + 20) Object.assign(p, this._spawn(), { y: -20, x0: Math.random() * this.w });
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = `rgba(${this.color},0.5)`;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.r, p.r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    requestAnimationFrame(this._tick);
  }
}

class DustField {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.count = opts.count ?? 12;
    this.color = opts.color ?? "180,170,155";
    this.particles = [];
    this.running = true;
    this._resize();
    window.addEventListener("resize", () => this._resize());
    this.particles = Array.from({ length: this.count }, () => this._spawn(true));
    observeVisibility(canvas.closest("section, header") || canvas, (v) => {
      this.running = v;
      if (v) requestAnimationFrame(this._tick);
    });
    this._tick = this._tick.bind(this);
    requestAnimationFrame(this._tick);
  }
  _resize() {
    const r = this.canvas.getBoundingClientRect();
    this.w = r.width; this.h = r.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = this.w * dpr;
    this.canvas.height = this.h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  _spawn(initial = false) {
    return {
      x: Math.random() * this.w,
      y: initial ? Math.random() * this.h : Math.random() * this.h,
      r: 0.4 + Math.random() * 1.2,
      vx: (Math.random() - 0.5) * 0.15,
      vy: -0.04 - Math.random() * 0.08,
      drift: Math.random() * Math.PI * 2,
      driftSpeed: 0.002 + Math.random() * 0.006,
      alpha: 0.08 + Math.random() * 0.18,
    };
  }
  _tick() {
    if (!this.running) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    for (const p of this.particles) {
      p.drift += p.driftSpeed;
      p.x += p.vx + Math.sin(p.drift) * 0.12;
      p.y += p.vy;
      if (p.y < -10 || p.x < -10 || p.x > this.w + 10) Object.assign(p, this._spawn());
      ctx.fillStyle = `rgba(${this.color},${p.alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(this._tick);
  }
}

class RainField {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.count = opts.count ?? 80;
    this.activePhases = opts.activePhases ?? ["night", "lockdown"];
    this.particles = [];
    this.running = false;
    this.phase = "dawn";
    this._resize();
    window.addEventListener("resize", () => this._resize());
    this.particles = Array.from({ length: this.count }, () => this._spawn(true));
    observeVisibility(canvas.closest("section, header, .coda") || canvas, (v) => {
      this.visible = v;
      this._updateRunning();
    });
    this.visible = true;
    document.addEventListener("nwo:cycle-phase", (e) => {
      this.phase = e.detail.phase;
      this._updateRunning();
    });
    this._tick = this._tick.bind(this);
  }
  _updateRunning() {
    const shouldRun = this.visible && this.activePhases.includes(this.phase);
    if (shouldRun && !this.running) {
      this.running = true;
      requestAnimationFrame(this._tick);
    } else if (!shouldRun) {
      this.running = false;
      this.ctx.clearRect(0, 0, this.w, this.h);
    }
  }
  _resize() {
    const r = this.canvas.getBoundingClientRect();
    this.w = r.width; this.h = r.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = this.w * dpr;
    this.canvas.height = this.h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  _spawn(initial = false) {
    return {
      x: Math.random() * this.w,
      y: initial ? Math.random() * this.h : -20,
      len: 8 + Math.random() * 14,
      vy: 6 + Math.random() * 8,
      vx: -1.5 - Math.random() * 1.5,
      alpha: 0.12 + Math.random() * 0.2,
    };
  }
  _tick() {
    if (!this.running) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.y > this.h + 20) Object.assign(p, this._spawn());
      ctx.strokeStyle = `rgba(180,190,210,${p.alpha})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 2, p.y - p.len);
      ctx.stroke();
    }
    requestAnimationFrame(this._tick);
  }
}

function generateBoltPath(w, h, startX) {
  const sx = startX ?? w * (0.3 + Math.random() * 0.4);
  const points = [{ x: sx, y: 0 }];
  const branches = [];
  let x = sx;
  let y = 0;
  const segments = 6 + Math.floor(Math.random() * 5);
  for (let i = 0; i < segments; i++) {
    y += (h / segments) * (0.7 + Math.random() * 0.5);
    x += (Math.random() - 0.5) * w * 0.12;
    const px = x;
    const py = Math.min(y, h * 0.85);
    points.push({ x: px, y: py });
    if (Math.random() > 0.55 && i < segments - 2) {
      branches.push({
        x1: px, y1: py,
        x2: px + (Math.random() - 0.5) * 60,
        y2: py + 20 + Math.random() * 40,
      });
    }
  }
  return { points, branches };
}

function drawLightningBolt(el, color = "#f4e8a0") {
  const rect = el.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  if (w < 10 || h < 10) return null;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:28;overflow:visible;";

  const { points, branches } = generateBoltPath(w, h);
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }

  const glow = document.createElementNS("http://www.w3.org/2000/svg", "path");
  glow.setAttribute("d", d);
  glow.setAttribute("fill", "none");
  glow.setAttribute("stroke", color);
  glow.setAttribute("stroke-width", "6");
  glow.setAttribute("stroke-linecap", "round");
  glow.setAttribute("opacity", "0.35");
  glow.setAttribute("filter", "blur(4px)");

  const core = document.createElementNS("http://www.w3.org/2000/svg", "path");
  core.setAttribute("d", d);
  core.setAttribute("fill", "none");
  core.setAttribute("stroke", "#fff");
  core.setAttribute("stroke-width", "1.5");
  core.setAttribute("stroke-linecap", "round");

  svg.appendChild(glow);
  svg.appendChild(core);

  for (const b of branches) {
    const branch = document.createElementNS("http://www.w3.org/2000/svg", "line");
    branch.setAttribute("x1", String(b.x1));
    branch.setAttribute("y1", String(b.y1));
    branch.setAttribute("x2", String(b.x2));
    branch.setAttribute("y2", String(b.y2));
    branch.setAttribute("stroke", color);
    branch.setAttribute("stroke-width", "1");
    branch.setAttribute("opacity", "0.7");
    svg.appendChild(branch);
  }

  el.style.position = el.style.position || "relative";
  el.appendChild(svg);
  return svg;
}

function lightningStrike(el, { color = "rgba(244,210,104,0.9)", boltColor = "#f4e8a0", duration = 900, shake = true, bolt = true } = {}) {
  let boltEl = null;
  if (bolt) boltEl = drawLightningBolt(el, boltColor);

  const flash = document.createElement("div");
  flash.style.cssText = `position:absolute;inset:0;pointer-events:none;z-index:30;background:${color};opacity:0;mix-blend-mode:screen;`;
  el.appendChild(flash);

  if (shake) {
    document.body.classList.add("lightning-shake");
    setTimeout(() => document.body.classList.remove("lightning-shake"), 400);
  }

  const seq = [
    { t: 0, o: 0 },
    { t: 40, o: 0.95 },
    { t: 90, o: 0.15 },
    { t: 140, o: 0.8 },
    { t: 220, o: 0 },
  ];
  let start = null;
  function step(ts) {
    if (!start) start = ts;
    const elapsed = ts - start;
    let o = 0;
    for (let i = 0; i < seq.length - 1; i++) {
      if (elapsed >= seq[i].t && elapsed <= seq[i + 1].t) {
        const f = (elapsed - seq[i].t) / (seq[i + 1].t - seq[i].t);
        o = seq[i].o + (seq[i + 1].o - seq[i].o) * f;
      }
    }
    flash.style.opacity = o;
    if (elapsed < duration) requestAnimationFrame(step);
    else {
      flash.remove();
      if (boltEl) boltEl.remove();
    }
  }
  requestAnimationFrame(step);
}

function startLightningStorm(el) {
  const trigger = () => {
    lightningStrike(el);
    const next = 15000 + Math.random() * 15000;
    setTimeout(trigger, next);
  };
  setTimeout(trigger, 5000);
}

function startSectionStorm(sectionEl, opts = {}) {
  const {
    minMs = 18000,
    maxMs = 35000,
    color = "rgba(244,210,104,0.9)",
    boltColor = "#f4e8a0",
    shake = true,
    onlyPhases = null,
    initialDelay = 8000,
  } = opts;

  let timer = null;
  let currentPhase = document.body.dataset.cyclePhase || "night";

  function getPhase() {
    return document.body.dataset.cyclePhase || currentPhase;
  }

  function schedule() {
    clearTimeout(timer);
    const delay = minMs + Math.random() * (maxMs - minMs);
    timer = setTimeout(trigger, delay);
  }

  function trigger() {
    const phase = getPhase();
    if (!onlyPhases || onlyPhases.includes(phase)) {
      const visible = sectionEl.getBoundingClientRect().bottom > 0 && sectionEl.getBoundingClientRect().top < window.innerHeight;
      if (visible) lightningStrike(sectionEl, { color, boltColor, shake });
    }
    schedule();
  }

  document.addEventListener("nwo:cycle-phase", (e) => {
    currentPhase = e.detail.phase;
  });

  setTimeout(() => {
    schedule();
  }, initialDelay);

  return () => clearTimeout(timer);
}

class CycleController {
  constructor(opts = {}) {
    this.duration = opts.duration ?? CYCLE_DURATION_MS;
    // Open the site in the cool navy "night" palette (matches the hero key art).
    // Booting at "dawn" tinted the opening murky green, so offset the start clock
    // to begin partway through the cycle at the requested phase.
    const startPhase = opts.startPhase ?? "night";
    const startProgress = this._phaseStartProgress(startPhase);
    this.startTime = performance.now() - this.duration * startProgress;
    this.phase = startPhase;
    this.progress = startProgress;
    this.paused = false;
    this._hold = null; // when set, cycle is frozen at this progress (manual eval)
    this._tick = this._tick.bind(this);
    this._updateLoopItems = this._updateLoopItems.bind(this);
    requestAnimationFrame(this._tick);
  }

  _phaseStartProgress(phase) {
    let acc = 0;
    for (const ph of CYCLE_PHASES) {
      if (ph.id === phase) return acc;
      acc += ph.frac;
    }
    return 0;
  }

  // ---- manual controls (dev eval) ----
  jumpToProgress(p) {
    p = Math.max(0, Math.min(0.9999, p));
    this.progress = p;
    this.startTime = performance.now() - this.duration * p;
    if (this.paused) this._hold = p;
  }

  jumpToPhase(id) {
    this.jumpToProgress(this._phaseStartProgress(id) + 0.0002);
  }

  setPaused(v) {
    this.paused = !!v;
    if (this.paused) {
      this._hold = this.progress;
    } else {
      this.startTime = performance.now() - this.duration * this.progress;
      this._hold = null;
    }
  }

  togglePaused() { this.setPaused(!this.paused); return this.paused; }

  _phaseAtProgress(p) {
    let acc = 0;
    for (const ph of CYCLE_PHASES) {
      acc += ph.frac;
      if (p < acc) return ph.id;
    }
    return "night";
  }

  _phaseProgress(p) {
    let acc = 0;
    for (const ph of CYCLE_PHASES) {
      const end = acc + ph.frac;
      if (p < end) return (p - acc) / ph.frac;
      acc = end;
    }
    return 0;
  }

  _phaseTokens(phase) {
    const tokens = {
      dawn:     { warmth: 0.7, brightness: 0.12, hue: 140, sky: "rgba(74,134,112,0.08)" },
      scouting: { warmth: 0.45, brightness: 0.18, hue: 40, sky: "rgba(123,116,100,0.06)" },
      race:     { warmth: 0.85, brightness: 0.14, hue: 45, sky: "rgba(202,160,51,0.07)" },
      lockdown: { warmth: 0.25, brightness: 0.06, hue: 30, sky: "rgba(90,82,64,0.09)" },
      night:    { warmth: 0.1, brightness: 0, hue: 220, sky: "rgba(82,108,168,0.07)" },
    };
    return tokens[phase] || tokens.night;
  }

  _lerp(a, b, t) {
    return a + (b - a) * t;
  }

  _tick(now) {
    if (this._hold == null) {
      const elapsed = (now - this.startTime) % this.duration;
      this.progress = elapsed / this.duration;
    } else {
      this.progress = this._hold;
    }
    const phase = this._phaseAtProgress(this.progress);
    const local = this._phaseProgress(this.progress);
    const prevPhase = this.phase;

    const body = document.body;
    body.dataset.cyclePhase = phase;
    body.style.setProperty("--cycle-progress", this.progress.toFixed(4));
    body.style.setProperty("--cycle-local", local.toFixed(4));

    const tok = this._phaseTokens(phase);
    body.style.setProperty("--cycle-warmth", tok.warmth.toFixed(3));
    body.style.setProperty("--cycle-brightness", tok.brightness.toFixed(3));
    body.style.setProperty("--cycle-hue-shift", tok.hue.toFixed(1));
    body.style.setProperty("--sky-tint", tok.sky);

    const hand = document.querySelector(".loop-clock-hand");
    if (hand) hand.setAttribute("transform", `rotate(${this.progress * 360} 130 130)`);

    const veil = document.getElementById("sky-veil");
    if (veil) {
      const breathe = 0.5 + Math.sin(now / 4000) * 0.15;
      veil.style.opacity = String(0.35 + tok.brightness * breathe);
      veil.style.background = `radial-gradient(120% 80% at 50% ${20 + local * 15}%,
        ${tok.sky} 0%, transparent 65%)`;
    }

    if (phase !== prevPhase) {
      this.phase = phase;
      document.dispatchEvent(new CustomEvent("nwo:cycle-phase", {
        detail: { phase, prev: prevPhase, progress: this.progress },
      }));
    }
    this._updateLoopItems();

    requestAnimationFrame(this._tick);
  }

  _updateLoopItems() {
    const phase = this.phase;
    document.querySelectorAll(".loop-item").forEach((item) => {
      const match = item.dataset.phase === phase;
      item.classList.toggle("active", match);
    });
  }
}

function attachWatchGlow(el, opts = {}) {
  const glow = document.createElement("div");
  const size = opts.size ?? 420;
  glow.style.cssText = `position:absolute;width:${size}px;height:${size}px;border-radius:50%;
    pointer-events:none;z-index:5;left:0;top:0;
    background:radial-gradient(circle, rgba(230,183,60,0.16) 0%, rgba(230,183,60,0.05) 40%, transparent 70%);
    transform:translate(-50%,-50%);transition:opacity .4s ease;opacity:0;will-change:transform;`;
  el.appendChild(glow);
  let tx = 0, ty = 0, cx = 0, cy = 0, raf = null;
  el.addEventListener("mousemove", (e) => {
    const r = el.getBoundingClientRect();
    tx = e.clientX - r.left; ty = e.clientY - r.top;
    glow.style.opacity = "1";
    if (!raf) raf = requestAnimationFrame(loop);
  });
  el.addEventListener("mouseleave", () => { glow.style.opacity = "0"; });
  function loop() {
    cx += (tx - cx) * 0.08;
    cy += (ty - cy) * 0.08;
    glow.style.transform = `translate(${cx - size / 2}px, ${cy - size / 2}px)`;
    if (Math.abs(tx - cx) > 0.5 || Math.abs(ty - cy) > 0.5) raf = requestAnimationFrame(loop);
    else raf = null;
  }
}

window.NWOAtmos = {
  EmberField,
  LeafField,
  DustField,
  RainField,
  CycleController,
  CYCLE_PHASES,
  lightningStrike,
  startLightningStorm,
  startSectionStorm,
  attachWatchGlow,
};
