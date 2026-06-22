// ============================================================
// NO WAY OUT — The Yellow Candle
// A living candle: continuous flame + molten BLACK wax that oozes
// from the rim, runs down the sides under gravity, pinches into
// droplets, and gathers into a growing pool at the base.
//
// Symbolism: the warm yellow body is the Man in Yellow — beautiful,
// luminous, the light everyone wants beside them. The black wax is
// what is hidden inside the hope: it never stops bleeding out, and
// it always pools at the bottom.
//
// Self-contained. One shared rAF loop drives every instance.
// HiDPI-aware, pauses when off-screen, respects reduced-motion.
// ============================================================
(function () {
  "use strict";

  const REDUCED = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Virtual drawing box (all geometry is authored here, then
  // "contain"-fit into whatever pixel size the host element has).
  const VW = 120, VH = 380;

  // ---- Candle geometry (virtual units) -------------------------
  const RIM_Y   = 120;          // top surface of the candle
  const RIM_RX  = 19, RIM_RY = 7.5;
  const BASE_Y  = 352;          // where the body meets the pool
  const CX      = 60;

  // Body silhouette: slightly flared toward the base.
  function leftEdge(y)  { const t = clamp((y - RIM_Y) / (BASE_Y - RIM_Y), 0, 1); return lerp(41, 31, t); }
  function rightEdge(y) { const t = clamp((y - RIM_Y) / (BASE_Y - RIM_Y), 0, 1); return lerp(79, 89, t); }

  // ---- tiny math helpers ---------------------------------------
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rand(a, b) { return a + Math.random() * (b - a); }

  // Smooth organic noise: sum of detuned sines in [-1, 1].
  function flick(t) {
    return (0.55 * Math.sin(t * 7.1) +
            0.28 * Math.sin(t * 11.7 + 1.3) +
            0.17 * Math.sin(t * 19.3 + 0.7)) / 1.0;
  }
  function sway(t) {
    return 0.6 * Math.sin(t * 1.7 + 0.4) + 0.4 * Math.sin(t * 2.9 + 2.1);
  }

  const instances = [];

  // ============================================================
  // One candle bound to a host element.
  // ============================================================
  function Candle(host) {
    this.host = host;
    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText = "display:block;width:100%;height:100%;overflow:visible";
    host.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = 0; this.h = 0;
    this.scale = 1; this.ox = 0; this.oy = 0;
    this.visible = true;
    this.rivulets = [];
    this.drops = [];
    this.pool = 0;            // accumulated volume
    this.poolMax = 140;
    this.seedWax();
    this.resize();

    // Keep it crisp on layout changes.
    if (window.ResizeObserver) {
      this._ro = new ResizeObserver(() => this.resize());
      this._ro.observe(host);
    } else {
      window.addEventListener("resize", () => this.resize());
    }
    // Pause work while scrolled away.
    if (window.IntersectionObserver) {
      this._io = new IntersectionObserver((e) => {
        this.visible = e[0].isIntersecting;
      }, { threshold: 0.01 });
      this._io.observe(host);
    }
  }

  Candle.prototype.seedWax = function () {
    // A handful of rivulets staggered in phase so the body is always
    // bleeding somewhere — never all moving or all still at once.
    const defs = [
      { side: -1, x: 0.30, maxLen: 150, speed: 11, width: 4.2 },
      { side:  1, x: 0.74, maxLen: 205, speed:  9, width: 4.8 },
      { side:  1, x: 0.58, maxLen:  92, speed: 14, width: 3.4 },
      { side: -1, x: 0.46, maxLen: 124, speed: 12, width: 3.8 },
      { side: -1, x: 0.16, maxLen: 176, speed:  8, width: 4.4 },
    ];
    for (const d of defs) {
      const anchorX = lerp(leftEdge(RIM_Y + 4) + 2, rightEdge(RIM_Y + 4) - 2, d.x);
      this.rivulets.push({
        side: d.side,
        anchorX,
        topY: RIM_Y + rand(2, 6),
        len: rand(6, d.maxLen * 0.7),     // start mid-run for instant life
        maxLen: d.maxLen * rand(0.85, 1.1),
        speed: d.speed * rand(0.85, 1.15),
        width: d.width,
        wob: rand(0, 6.28),
        wobAmp: rand(0.6, 1.8),
        state: Math.random() < 0.5 ? "growing" : "paused",
        pause: rand(0, 2),
      });
    }
    this.pool = rand(20, 60);
  };

  Candle.prototype.resize = function () {
    const r = this.host.getBoundingClientRect();
    const cw = Math.max(1, r.width), ch = Math.max(1, r.height);
    this.w = cw; this.h = ch;
    this.canvas.width = Math.round(cw * this.dpr);
    this.canvas.height = Math.round(ch * this.dpr);
    // contain-fit the virtual box, centered.
    this.scale = Math.min(cw / VW, ch / VH);
    this.ox = (cw - VW * this.scale) / 2;
    this.oy = (ch - VH * this.scale) / 2;
    if (REDUCED) this.draw(8.0); // one settled frame
  };

  // ---- simulation ----------------------------------------------
  Candle.prototype.update = function (dt, t) {
    dt = Math.min(dt, 0.05);
    for (const r of this.rivulets) {
      if (r.state === "growing") {
        // Surface tension: slows as the run lengthens.
        const ease = 1 - clamp(r.len / r.maxLen, 0, 1) * 0.65;
        r.len += r.speed * ease * dt;
        if (r.len >= r.maxLen) {
          // Pinch off a droplet at the head.
          const hy = r.topY + r.len;
          const hx = this.edgeX(r) + Math.sin(r.wob + r.len * 0.05) * r.wobAmp;
          this.drops.push({ x: hx, y: hy, vy: 14, r: r.width * rand(0.7, 0.95) });
          r.state = "paused";
          r.pause = rand(1.4, 4.2);
          r.len *= 0.82;            // recoil
        }
      } else { // paused — wax cools, then a fresh bead wells up
        r.pause -= dt;
        if (r.pause <= 0) {
          r.state = "growing";
          r.maxLen *= rand(0.9, 1.12);
          r.maxLen = clamp(r.maxLen, 70, 235);
        }
      }
    }

    const g = 240;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.vy += g * dt;
      d.y += d.vy * dt;
      const surface = BASE_Y - this.poolHeight() * 0.5;
      if (d.y >= surface) {
        this.pool = Math.min(this.poolMax, this.pool + d.r * d.r * 0.9);
        this.drops.splice(i, 1);
      } else if (d.y > VH + 20) {
        this.drops.splice(i, 1);
      }
    }
    // The pool very slowly self-levels so it loops forever without overflowing.
    if (this.pool > this.poolMax * 0.7) this.pool -= 2.2 * dt;
  };

  Candle.prototype.edgeX = function (r) {
    // x along the running edge for the rivulet's head depth.
    const y = r.topY + r.len;
    const edge = r.side < 0 ? leftEdge(y) : rightEdge(y);
    // hug just inside the silhouette
    return lerp(r.anchorX, edge + r.side * 1.5, clamp(r.len / 40, 0, 1));
  };

  Candle.prototype.poolHeight = function () {
    return clamp(this.pool / this.poolMax, 0, 1) * 26 + 4;
  };

  // ---- rendering -----------------------------------------------
  Candle.prototype.draw = function (t) {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.save();
    ctx.translate(this.ox, this.oy);
    ctx.scale(this.scale, this.scale);

    const fl = REDUCED ? 0 : flick(t);
    const sw = REDUCED ? 0 : sway(t);

    this.drawGlow(ctx, t, fl);
    this.drawBody(ctx, fl);
    this.drawWax(ctx, t);
    this.drawPool(ctx);
    this.drawWick(ctx);
    this.drawFlame(ctx, t, fl, sw);

    ctx.restore();
  };

  Candle.prototype.drawGlow = function (ctx, t, fl) {
    const cy = 96;
    const R = 92 * (1 + 0.06 * fl);
    const g = ctx.createRadialGradient(CX, cy, 2, CX, cy, R);
    const a = 0.34 + 0.10 * fl;
    g.addColorStop(0, "rgba(255,206,110," + a.toFixed(3) + ")");
    g.addColorStop(0.35, "rgba(230,150,50," + (a * 0.5).toFixed(3) + ")");
    g.addColorStop(1, "rgba(230,150,50,0)");
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = g;
    ctx.fillRect(CX - R, cy - R, R * 2, R * 2);
    ctx.restore();
  };

  Candle.prototype.drawBody = function (ctx, fl) {
    // Silhouette
    ctx.beginPath();
    ctx.moveTo(leftEdge(RIM_Y), RIM_Y);
    ctx.lineTo(leftEdge(BASE_Y), BASE_Y);
    ctx.lineTo(rightEdge(BASE_Y), BASE_Y);
    ctx.lineTo(rightEdge(RIM_Y), RIM_Y);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, RIM_Y, 0, BASE_Y);
    grad.addColorStop(0, "#f7da78");
    grad.addColorStop(0.45, "#dca828");
    grad.addColorStop(1, "#6a5012");
    ctx.fillStyle = grad;
    ctx.fill();

    // Left-side shade + right rim light (cylinder volume)
    const shade = ctx.createLinearGradient(leftEdge(BASE_Y), 0, rightEdge(BASE_Y), 0);
    shade.addColorStop(0, "rgba(40,26,4,0.55)");
    shade.addColorStop(0.28, "rgba(40,26,4,0)");
    shade.addColorStop(0.72, "rgba(255,235,170,0)");
    shade.addColorStop(1, "rgba(255,235,170,0.30)");
    ctx.save(); ctx.clip();
    ctx.fillStyle = shade;
    ctx.fillRect(0, RIM_Y, VW, BASE_Y - RIM_Y);

    // Warm light spilling from the flame onto the upper body.
    const warm = ctx.createLinearGradient(0, RIM_Y, 0, RIM_Y + 120);
    warm.addColorStop(0, "rgba(255,210,120," + (0.22 + 0.10 * fl).toFixed(3) + ")");
    warm.addColorStop(1, "rgba(255,210,120,0)");
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = warm;
    ctx.fillRect(0, RIM_Y, VW, 120);
    ctx.restore();

    // Top surface (the soft melted bowl around the wick).
    ctx.beginPath();
    ctx.ellipse(CX, RIM_Y, RIM_RX, RIM_RY, 0, 0, Math.PI * 2);
    const top = ctx.createRadialGradient(CX, RIM_Y - 2, 1, CX, RIM_Y, RIM_RX);
    top.addColorStop(0, "#3a2c0c");      // molten well, darkened by soot
    top.addColorStop(0.6, "#caa030");
    top.addColorStop(1, "#f3d169");
    ctx.fillStyle = top;
    ctx.fill();
  };

  Candle.prototype.drawWax = function (ctx, t) {
    for (const r of this.rivulets) {
      const x0 = r.anchorX;
      const yTop = r.topY;
      const yHead = yTop + r.len;
      const headX = this.edgeX(r) + Math.sin(r.wob + r.len * 0.05) * r.wobAmp;

      // Build a tapering ribbon that hugs the body edge.
      const steps = 10;
      const left = [], right = [];
      for (let i = 0; i <= steps; i++) {
        const f = i / steps;
        const y = lerp(yTop, yHead, f);
        const cxline = lerp(x0, headX, f * f); // accelerates out/down
        const wob = Math.sin(r.wob + y * 0.06) * r.wobAmp * f;
        const halfW = lerp(r.width * 0.5, r.width * 0.85, f) * (1 - f * 0.25);
        left.push([cxline + wob - halfW, y]);
        right.push([cxline + wob + halfW, y]);
      }
      ctx.beginPath();
      ctx.moveTo(left[0][0], left[0][1]);
      for (let i = 1; i < left.length; i++) ctx.lineTo(left[i][0], left[i][1]);
      for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
      ctx.closePath();
      ctx.fillStyle = "#070606";
      ctx.fill();

      // Glossy bead at the head (surface tension).
      const bx = right[steps][0] - (right[steps][0] - left[steps][0]) / 2;
      ctx.beginPath();
      ctx.arc(bx, yHead, r.width * 0.9, 0, Math.PI * 2);
      ctx.fillStyle = "#050505";
      ctx.fill();
      // specular fleck catching the flame
      ctx.beginPath();
      ctx.arc(bx - r.width * 0.3, yHead - r.width * 0.3, r.width * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,205,120,0.30)";
      ctx.fill();

      // thin warm rim-light down the flame-facing edge
      ctx.beginPath();
      ctx.moveTo(right[0][0], right[0][1]);
      for (let i = 1; i < right.length; i++) ctx.lineTo(right[i][0], right[i][1]);
      ctx.strokeStyle = "rgba(180,130,60,0.22)";
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }

    // Falling droplets.
    for (const d of this.drops) {
      ctx.beginPath();
      // teardrop: round bottom, tapered top from speed
      const stretch = clamp(d.vy / 120, 0, 1.4);
      ctx.ellipse(d.x, d.y, d.r, d.r * (1 + stretch), 0, 0, Math.PI * 2);
      ctx.fillStyle = "#060606";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(d.x - d.r * 0.3, d.y - d.r * 0.2, d.r * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,205,120,0.25)";
      ctx.fill();
    }
  };

  Candle.prototype.drawPool = function (ctx) {
    const h = this.poolHeight();
    const halfW = lerp(20, 40, clamp(this.pool / this.poolMax, 0, 1));
    const topY = BASE_Y - h;
    ctx.beginPath();
    ctx.moveTo(CX - halfW, BASE_Y + 6);
    ctx.bezierCurveTo(CX - halfW, topY, CX - halfW * 0.4, topY - 2, CX, topY - 2);
    ctx.bezierCurveTo(CX + halfW * 0.4, topY - 2, CX + halfW, topY, CX + halfW, BASE_Y + 6);
    ctx.bezierCurveTo(CX + halfW, BASE_Y + 14, CX - halfW, BASE_Y + 14, CX - halfW, BASE_Y + 6);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, topY - 2, 0, BASE_Y + 12);
    g.addColorStop(0, "#100f0e");
    g.addColorStop(1, "#020202");
    ctx.fillStyle = g;
    ctx.fill();
    // meniscus sheen
    ctx.beginPath();
    ctx.ellipse(CX, topY + 1, halfW * 0.66, 2.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(200,150,70,0.18)";
    ctx.fill();
  };

  Candle.prototype.drawWick = function (ctx) {
    ctx.beginPath();
    ctx.moveTo(CX, RIM_Y - 1);
    ctx.quadraticCurveTo(CX + 1.5, RIM_Y - 9, CX - 0.5, RIM_Y - 15);
    ctx.strokeStyle = "#161008";
    ctx.lineWidth = 2.1;
    ctx.lineCap = "round";
    ctx.stroke();
    // glowing ember at the wick top
    ctx.beginPath();
    ctx.arc(CX - 0.5, RIM_Y - 15, 1.7, 0, Math.PI * 2);
    ctx.fillStyle = "#ff7b2a";
    ctx.fill();
  };

  Candle.prototype.drawFlame = function (ctx, t, fl, sw) {
    const baseY = RIM_Y - 13;           // sits at the wick tip
    const h = 60 * (1 + 0.12 * fl);
    const lean = sw * 7 + flick(t * 1.3) * 2;
    const tipX = CX + lean;
    const topY = baseY - h;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    // teardrop builder
    function flameShape(w, hh, by, tx, ty) {
      ctx.beginPath();
      ctx.moveTo(CX - w, by);
      ctx.bezierCurveTo(CX - w, by - hh * 0.55,
                        CX - w * 0.45 + (tx - CX) * 0.4, ty + hh * 0.2,
                        tx, ty);
      ctx.bezierCurveTo(CX + w * 0.45 + (tx - CX) * 0.4, ty + hh * 0.2,
                        CX + w, by - hh * 0.55,
                        CX + w, by);
      ctx.quadraticCurveTo(CX, by + hh * 0.10, CX - w, by);
      ctx.closePath();
    }

    // outer warm mantle
    flameShape(13, h, baseY, tipX, topY);
    let g = ctx.createLinearGradient(0, topY, 0, baseY + 6);
    g.addColorStop(0, "rgba(255,150,40,0)");
    g.addColorStop(0.35, "rgba(255,138,34,0.55)");
    g.addColorStop(1, "rgba(214,92,20,0.85)");
    ctx.fillStyle = g;
    ctx.fill();

    // bright body
    flameShape(8.6, h * 0.82, baseY - 1, CX + lean * 0.8, topY + h * 0.16);
    g = ctx.createLinearGradient(0, topY + h * 0.16, 0, baseY);
    g.addColorStop(0, "rgba(255,210,90,0.55)");
    g.addColorStop(0.5, "rgba(255,224,120,0.95)");
    g.addColorStop(1, "rgba(255,196,70,0.95)");
    ctx.fillStyle = g;
    ctx.fill();

    // blue combustion base around the wick
    flameShape(6.2, h * 0.34, baseY + 1, CX + lean * 0.4, baseY - h * 0.30);
    ctx.fillStyle = "rgba(90,150,255,0.40)";
    ctx.fill();

    // white-hot core
    const coreY = baseY - h * 0.30 + Math.sin(t * 13) * 1.2;
    flameShape(4.0, h * 0.42, baseY - 2, CX + lean * 0.6, coreY - h * 0.12);
    g = ctx.createLinearGradient(0, coreY - h * 0.2, 0, baseY);
    g.addColorStop(0, "rgba(255,248,224,0.6)");
    g.addColorStop(1, "rgba(255,252,238,0.98)");
    ctx.fillStyle = g;
    ctx.fill();

    ctx.restore();
  };

  // ============================================================
  // Shared loop
  // ============================================================
  let last = 0;
  function frame(now) {
    const t = now / 1000;
    const dt = last ? t - last : 0.016;
    last = t;
    for (const c of instances) {
      if (!c.visible) continue;
      c.update(dt, t);
      c.draw(t);
    }
    requestAnimationFrame(frame);
  }

  function mountAll() {
    const hosts = document.querySelectorAll("[data-figure]");
    hosts.forEach((h) => {
      if (h.__candle) return;
      h.__candle = new Candle(h);
      instances.push(h.__candle);
    });
    if (!REDUCED && instances.length && !last) requestAnimationFrame(frame);
  }

  window.NWOCandle = { mountAll };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountAll);
  } else {
    mountAll();
  }
})();
