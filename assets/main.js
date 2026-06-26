// ============================================================
// NO WAY OUT — main orchestration
// ============================================================
(function () {
  "use strict";

  const PALETTE_BASE = {
    far:   ["#1b2230", "#222a3a", "#2b3445", "#343f53", "#3f4c63"],
    near:  ["#0c0f15", "#10141c", "#151a24", "#1d2330"],
    town:  ["#16241e", "#1b2e26", "#23392f", "#2c4738"],
  };

  const PALETTE_SHIFTS = {
    dawn:     { hue: 18, sat: 0.08, light: 0.04 },
    scouting: { hue: 0, sat: 0, light: 0.06 },
    race:     { hue: 12, sat: 0.06, light: 0.03 },
    lockdown: { hue: -5, sat: -0.04, light: -0.02 },
    night:    { hue: -10, sat: 0.02, light: 0.085 },
  };

  let currentPhase = "night";

  function shiftHex(hex, { hue = 0, sat = 0, light = 0 } = {}) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.min(255, Math.max(0, Math.round(r + hue * 0.4 + light * 255)));
    g = Math.min(255, Math.max(0, Math.round(g + hue * 0.6 + sat * 40 + light * 255)));
    b = Math.min(255, Math.max(0, Math.round(b - hue * 0.3 + light * 255)));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }

  function palettesForPhase(phase) {
    const shift = PALETTE_SHIFTS[phase] || PALETTE_SHIFTS.night;
    return {
      far:  PALETTE_BASE.far.map((c) => shiftHex(c, shift)),
      near: PALETTE_BASE.near.map((c) => shiftHex(c, shift)),
      town: PALETTE_BASE.town.map((c) => shiftHex(c, shift)),
    };
  }

  function px(el) {
    const r = el.getBoundingClientRect();
    return { w: Math.max(1, r.width), h: Math.max(1, r.height) };
  }

  function renderAllForests(phase) {
    const pal = palettesForPhase(phase || currentPhase);
    document.querySelectorAll("[data-forest]").forEach((canvas) => {
      const type = canvas.dataset.forest;
      const { w, h } = px(canvas);
      const seed = parseInt(canvas.dataset.seed || "7", 10);
      let palette = pal.far, count = 60, baseBand = [h * 0.6, h * 0.98], scaleRange = [0.3, 1.05], maxDepthRange = [8, 11];
      if (type === "near") { palette = pal.near; count = 38; baseBand = [h * 0.78, h * 1.02]; scaleRange = [0.6, 1.6]; }
      if (type === "town") { palette = pal.town; count = 30; baseBand = [h * 0.7, h * 0.99]; scaleRange = [0.4, 1.2]; }
      if (type === "thin") { palette = pal.far; count = 26; baseBand = [h * 0.55, h * 0.95]; scaleRange = [0.35, 0.85]; }
      window.NWOForest.renderForest(canvas, { width: w, height: h, count, baseBand, scaleRange, seed, palette, maxDepthRange });
    });
  }

  function renderAllStructures(phase) {
    if (!window.NWOStructures) return;
    const pal = palettesForPhase(phase || currentPhase);
    document.querySelectorAll("[data-structures]").forEach((canvas) => {
      const type = canvas.dataset.structures;
      const parent = canvas.parentElement;
      const rect = parent.getBoundingClientRect();
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      const seed = parseInt(canvas.dataset.seed || "14", 10);
      const count = parseInt(canvas.dataset.count || "6", 10);

      let palette, baseBand, scaleRange;
      if (type === "huts") {
        palette = pal.town;
        // Occupy bottom 40% of the canvas
        baseBand = [h * 0.6, h * 0.95];
        scaleRange = [0.8, 2.0];
      } else {
        // creatures
        palette = pal.far.map((c) => shiftHex(c, { hue: -8, sat: -0.02, light: -0.01 }));
        baseBand = [h * 0.5, h * 1.0];
        scaleRange = [1.5, 3.5]; // massive busts
      }

      window.NWOStructures.renderStructures(canvas, {
        width: w, height: h, count, baseBand, scaleRange, seed, palette, type,
      });
    });
  }

  function initReveal() {
    const els = document.querySelectorAll(".reveal");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("in");
          else e.target.classList.remove("in");
        });
      },
      { threshold: 0.16, rootMargin: "0px 0px -8% 0px" }
    );
    els.forEach((el) => io.observe(el));
  }

  function initNav() {
    const nav = document.querySelector(".nav");
    if (!nav) return;
    window.addEventListener(
      "scroll",
      () => nav.classList.toggle("scrolled", window.scrollY > 40),
      { passive: true }
    );
  }

  function initParallax() {
    const hero = document.querySelector(".hero");
    const heroTitle = document.querySelector(".hero-title");
    const far = document.querySelector(".hero-trees-far");
    const near = document.querySelector(".hero-trees-near");
    const figure = document.querySelector(".hero-figure-wrap");
    const cards = document.querySelectorAll(".lib-card, .cost-card, .diff-card");

    // ---------------------------------------------------------------
    // Scroll-driven wordmark choreography (rAF-smoothed for buttery motion):
    //   Phase A (P 0->0.5): bottom anchored, top stretches up to the upper bound.
    //   Phase B (P 0.5->1): top anchored at the upper bound, bottom compresses
    //                       back so the title returns to its natural size.
    //   P>=1 (released): the sticky unsticks and the normal title scrolls away.
    // Poisson physics: stretching vertically thins the glyphs horizontally
    //   (scaleX = 1/sqrt(scaleY)), so the letters narrow as they elongate.
    // ---------------------------------------------------------------
    let restTop = 0, H0 = 0, pinRange = 1, upperTop = 0;

    function measure() {
      if (!heroTitle || !hero) return;
      const prev = heroTitle.style.transform;
      heroTitle.style.transform = "none";
      const r = heroTitle.getBoundingClientRect();
      heroTitle.style.transform = prev;
      const vh = window.innerHeight;
      restTop = r.top;                                  // on-screen top while pinned
      H0 = r.height;
      upperTop = vh * 0.07;                             // top edge at full stretch
      pinRange = hero.getBoundingClientRect().height - vh; // sticky pin distance
    }

    const easeInOut = (t) =>
      t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    let curP = 0;

    function applyTitle(P) {
      if (!heroTitle || H0 <= 0) return;
      const B0 = restTop + H0;
      let top, bot;
      if (P <= 0.5) {
        const ps = easeInOut(P / 0.5);
        top = restTop + (upperTop - restTop) * ps;     // bottom anchored, top rises
        bot = B0;
      } else {
        const pc = easeInOut((P - 0.5) / 0.5);
        top = upperTop;                                 // top anchored
        bot = B0 + (upperTop + H0 - B0) * pc;           // bottom compresses up
      }
      const sy = Math.max(0.001, (bot - top) / H0);
      const sx = 1 / Math.sqrt(sy);                     // volume-preserving thinning
      const ty = top - restTop;
      heroTitle.style.transform = `translate3d(0,${ty}px,0) scale(${sx},${sy})`;
    }

    function frame() {
      const targetP =
        pinRange > 0 ? Math.max(0, Math.min(1, window.scrollY / pinRange)) : 0;
      curP += (targetP - curP) * 0.1;                   // buttery glide toward target
      if (Math.abs(targetP - curP) < 0.0002) curP = targetP;
      applyTitle(curP);
      // Parallax the forest as you scroll through the pin: the trees sink (near
      // band fastest for depth, candle slowest), same feel as the pre-sticky build.
      const sink = curP * pinRange;
      if (far) far.style.transform = `translate3d(0,${sink * 0.14}px,0)`;
      if (near) near.style.transform = `translate3d(0,${sink * 0.26}px,0)`;
      if (figure) figure.style.transform = `translate3d(0,${sink * 0.07}px,0)`;
      requestAnimationFrame(frame);
    }

    if (heroTitle && hero) {
      heroTitle.style.transformOrigin = "50% 0%";
      heroTitle.style.willChange = "transform";
      heroTitle.style.backfaceVisibility = "hidden";
      measure();
      window.addEventListener("resize", measure);
      requestAnimationFrame(frame);
    }

    // ---- card parallax (lower sections) ----
    window.addEventListener(
      "scroll",
      () => {
        const vh = window.innerHeight;
        cards.forEach((card) => {
          const rect = card.getBoundingClientRect();
          if (rect.top < vh && rect.bottom > 0) {
            const shift = (rect.top - vh / 2) * 0.05;
            card.style.transform = `translateY(${shift}px)`;
          }
        });
      },
      { passive: true }
    );
  }

  function initLightning() {
    const mny = document.querySelector(".mny");
    if (mny) {
      let fired = false;
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting && !fired) {
              fired = true;
              setTimeout(() => window.NWOAtmos.lightningStrike(mny, {
                color: "rgba(244,210,104,0.9)",
                boltColor: "#f4d268",
              }), 350);
            }
          });
        },
        { threshold: 0.4 }
      );
      io.observe(mny);
      window.NWOAtmos.startSectionStorm(mny, {
        minMs: 22000, maxMs: 45000,
        color: "rgba(244,210,104,0.75)",
        boltColor: "#f4d268",
        shake: false,
      });
    }

    const hero = document.querySelector(".hero");
    if (hero) {
      window.NWOAtmos.startSectionStorm(hero, {
        minMs: 25000, maxMs: 50000,
        onlyPhases: ["night", "lockdown"],
      });
    }

    const loop = document.querySelector(".loop");
    if (loop) {
      window.NWOAtmos.startSectionStorm(loop, {
        minMs: 20000, maxMs: 40000,
        onlyPhases: ["night"],
      });
    }

    const victory = document.querySelector(".victory");
    if (victory) {
      window.NWOAtmos.startSectionStorm(victory, {
        minMs: 28000, maxMs: 55000,
        color: "rgba(184,57,42,0.85)",
        boltColor: "#e85a4a",
        onlyPhases: ["night", "lockdown"],
      });
    }

    const coda = document.querySelector(".coda");
    if (coda) {
      window.NWOAtmos.startSectionStorm(coda, {
        minMs: 22000, maxMs: 42000,
        onlyPhases: ["night"],
      });
    }

    const cost = document.querySelector(".cost");
    if (cost) {
      window.NWOAtmos.startSectionStorm(cost, {
        minMs: 40000, maxMs: 70000,
        color: "rgba(184,57,42,0.55)",
        boltColor: "#c44a3a",
        shake: false,
        onlyPhases: ["night", "lockdown"],
      });
    }
  }

  function initParticles() {
    document.querySelectorAll("[data-embers]").forEach((c) => {
      new window.NWOAtmos.EmberField(c, {
        count: parseInt(c.dataset.count || "24", 10),
        color: c.dataset.color || "230,183,60",
        speed: parseFloat(c.dataset.speed || "1"),
      });
    });
    document.querySelectorAll("[data-leaves]").forEach((c) => {
      new window.NWOAtmos.LeafField(c, {
        count: parseInt(c.dataset.count || "14", 10),
        color: c.dataset.color || "90,154,130",
      });
    });
    document.querySelectorAll("[data-dust]").forEach((c) => {
      new window.NWOAtmos.DustField(c, {
        count: parseInt(c.dataset.count || "12", 10),
        color: c.dataset.color || "180,170,155",
      });
    });
    document.querySelectorAll("[data-rain]").forEach((c) => {
      new window.NWOAtmos.RainField(c, {
        count: parseInt(c.dataset.count || "80", 10),
        activePhases: (c.dataset.phases || "night,lockdown").split(","),
      });
    });
  }

  function initWatchGlow() {
    const mny = document.querySelector(".mny");
    if (mny) window.NWOAtmos.attachWatchGlow(mny, { size: 460 });
  }

  function initLivingCycle() {
    window.NWOAtmos.cycle = new window.NWOAtmos.CycleController({ duration: 240000 });

    document.addEventListener("nwo:cycle-phase", (e) => {
      currentPhase = e.detail.phase;
      renderAllForests(currentPhase);
      renderAllStructures(currentPhase);
    });
  }

  // Manual day/night control for evaluating each phase's look.
  // Local-only build-time preview tool — never shown on the live site.
  function initCycleDevPanel() {
    const cyc = window.NWOAtmos && window.NWOAtmos.cycle;
    if (!cyc) return;
    const host = location.hostname;
    const isLocal = host === "localhost" || host === "127.0.0.1" || host === "";
    if (!isLocal) return;

    const phases = window.NWOAtmos.CYCLE_PHASES.map((p) => p.id);
    const panel = document.createElement("div");
    panel.className = "cyc-dev";
    panel.innerHTML = `
      <div class="cyc-dev-head">
        <span class="cyc-dev-title">CYCLE · DEV</span>
        <button class="cyc-dev-min" title="collapse">–</button>
      </div>
      <div class="cyc-dev-body">
        <div class="cyc-dev-phases">
          ${phases.map((p) => `<button data-phase="${p}">${p}</button>`).join("")}
        </div>
        <input class="cyc-dev-slider" type="range" min="0" max="1000" value="0" aria-label="cycle time">
        <div class="cyc-dev-readout"><span class="cyc-dev-phase-now">night</span><span class="cyc-dev-pct">0%</span></div>
        <button class="cyc-dev-pause">▶ play</button>
      </div>`;
    document.body.appendChild(panel);

    const slider = panel.querySelector(".cyc-dev-slider");
    const pctEl = panel.querySelector(".cyc-dev-pct");
    const phaseNowEl = panel.querySelector(".cyc-dev-phase-now");
    const pauseBtn = panel.querySelector(".cyc-dev-pause");
    const phaseBtns = Array.from(panel.querySelectorAll("[data-phase]"));

    function setPauseLabel() {
      pauseBtn.textContent = cyc.paused ? "▶ play" : "❚❚ pause";
      pauseBtn.classList.toggle("on", cyc.paused);
    }
    phaseBtns.forEach((btn) =>
      btn.addEventListener("click", () => {
        if (!cyc.paused) cyc.setPaused(true);
        cyc.jumpToPhase(btn.dataset.phase);
        setPauseLabel();
      })
    );
    slider.addEventListener("input", () => {
      if (!cyc.paused) cyc.setPaused(true);
      cyc.jumpToProgress(slider.value / 1000);
      setPauseLabel();
    });
    pauseBtn.addEventListener("click", () => { cyc.togglePaused(); setPauseLabel(); });
    panel.querySelector(".cyc-dev-min").addEventListener("click", () =>
      panel.classList.toggle("collapsed")
    );

    (function sync() {
      const p = cyc.progress;
      if (document.activeElement !== slider) slider.value = Math.round(p * 1000);
      pctEl.textContent = Math.round(p * 100) + "%";
      phaseNowEl.textContent = cyc.phase;
      phaseBtns.forEach((b) => b.classList.toggle("active", b.dataset.phase === cyc.phase));
      requestAnimationFrame(sync);
    })();
    setPauseLabel();
  }

  function initHoverEffects() {
    const cards = document.querySelectorAll(".lib-card, .cost-card, .diff-card, .card");
    cards.forEach((card) => {
      card.addEventListener("mousemove", (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const xc = rect.width / 2;
        const yc = rect.height / 2;
        const dx = x - xc;
        const dy = y - yc;
        card.style.transform = `perspective(1000px) rotateX(${-dy / 20}deg) rotateY(${dx / 20}deg) translateY(${(rect.top - window.innerHeight / 2) * 0.05}px)`;
      });
      card.addEventListener("mouseleave", () => {
        const rect = card.getBoundingClientRect();
        card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(${(rect.top - window.innerHeight / 2) * 0.05}px)`;
      });
    });
  }

  function initMagneticCursor() {
    document.querySelectorAll(".btn").forEach((btn) => {
      btn.addEventListener("mousemove", (e) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        btn.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px)`;
      });
      btn.addEventListener("mouseleave", () => {
        btn.style.transform = "translate(0, 0)";
      });
    });
  }

  function buildWarDiagram() {
    const svg = document.querySelector(".war-svg");
    if (!svg) return;
    svg.innerHTML = `
      <defs>
        <radialGradient id="warCenter" cx="50%" cy="50%" r="50%">
          <stop offset="0" stop-color="#e6b73c" stop-opacity=".22"/>
          <stop offset="1" stop-color="#e6b73c" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <polygon points="500,40 880,520 120,520" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="1.2"/>
      <line x1="500" y1="40" x2="500" y2="330" stroke="rgba(255,255,255,.08)" stroke-width="1" stroke-dasharray="3 7"/>
      <line x1="880" y1="520" x2="500" y2="330" stroke="rgba(255,255,255,.08)" stroke-width="1" stroke-dasharray="3 7"/>
      <line x1="120" y1="520" x2="500" y2="330" stroke="rgba(255,255,255,.08)" stroke-width="1" stroke-dasharray="3 7"/>
      <circle class="war-center-glow" cx="500" cy="325" r="120" fill="url(#warCenter)"/>
      <text x="280" y="290" fill="#8b6bc4" font-family="Label,sans-serif" font-size="11" letter-spacing="2.5" text-anchor="middle" transform="rotate(-49 280 290)">NATURAL ALLIES &#183; MUTE</text>
      <text x="720" y="288" fill="#b8392a" font-family="Label,sans-serif" font-size="11" letter-spacing="2.5" text-anchor="middle" transform="rotate(49 720 288)">CAPTOR &amp; CAPTIVE</text>
      <text x="500" y="500" fill="#b8392a" font-family="Label,sans-serif" font-size="12" letter-spacing="3" text-anchor="middle">PREDATION</text>
    `;
    svg.setAttribute("viewBox", "0 0 1000 560");
  }

  function buildClock() {
    const el = document.querySelector(".loop-clock");
    if (!el) return;
    const segs = [
      { frac: 0.125, color: "#4a8670", phase: "dawn" },
      { frac: 0.25, color: "#7b7464", phase: "scouting" },
      { frac: 0.125, color: "#caa033", phase: "race" },
      { frac: 0.0833, color: "#5a5240", phase: "lockdown" },
      { frac: 0.4167, color: "#8c2118", phase: "night" },
    ];
    const r = 100, circ = 2 * Math.PI * r;
    let offset = 0;
    let circles = "";
    segs.forEach((s) => {
      const len = s.frac * circ;
      circles += `<circle r="${r}" fill="none" stroke="${s.color}" stroke-width="26"
        stroke-dasharray="${len} ${circ - len}" stroke-dashoffset="${-offset}"
        transform="rotate(-90 130 130)" cx="130" cy="130"/>`;
      offset += len;
    });
    el.innerHTML = `
      <svg viewBox="0 0 260 260" width="100%" height="100%">
        <circle cx="130" cy="130" r="${r}" fill="none" stroke="#1a1822" stroke-width="26"/>
        ${circles}
        <circle cx="130" cy="130" r="${r - 22}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="1"/>
        <circle cx="130" cy="130" r="${r + 22}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="1"/>
        <line class="loop-clock-hand" x1="130" y1="130" x2="130" y2="42"
          stroke="var(--bone)" stroke-width="2" stroke-linecap="round"
          transform="rotate(0 130 130)"/>
        <circle cx="130" cy="130" r="5" fill="var(--bone)"/>
        <text x="130" y="124" text-anchor="middle" font-family="Gloock,serif" font-size="22" fill="#e8e1d3">CYCLE</text>
        <text x="130" y="146" text-anchor="middle" font-family="Label,sans-serif" font-size="9" letter-spacing="4" fill="#7b7464">ONE NIGHT</text>
      </svg>`;

    const items = document.querySelectorAll(".loop-item");
    const phases = ["dawn", "scouting", "race", "lockdown", "night"];
    items.forEach((item, i) => {
      if (!item.dataset.phase && phases[i]) item.dataset.phase = phases[i];
    });
  }

  function figureSVG({ glow = true, height = 360, id = "" } = {}) {
    const gid = "yfig" + (id || Math.random().toString(36).slice(2));
    return `
      <svg viewBox="0 0 120 380" width="100%" height="100%" preserveAspectRatio="xMidYMax meet" style="overflow:visible">
        <defs>
          <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#f6d873"/>
            <stop offset=".55" stop-color="#dca828"/>
            <stop offset="1" stop-color="#6a5012"/>
          </linearGradient>
        </defs>
        ${glow ? `<ellipse cx="60" cy="220" rx="70" ry="160" fill="url(#${gid})" opacity="0.10" />` : ""}
        <!-- Base candle -->
        <path d="M38 84 Q60 68 82 84 L90 366 L30 366 Z" fill="url(#${gid})"/>
        <!-- Top of candle -->
        <ellipse cx="60" cy="54" rx="18.5" ry="22.5" fill="url(#${gid})"/>
        
        <!-- Dripping Black Wax (Evil hiding in hope) -->
        <path d="M43 72 Q43 140 40 180 Q38 185 41 185 Q45 185 46 150 Q48 110 50 76 Z" fill="#020202"/>
        <path d="M54 75 Q54 110 53 125 Q51 130 54.5 130 Q57 130 56 100 Q58 85 62 76 Z" fill="#020202"/>
        <path d="M68 76 Q69 160 69 220 Q67 225 71 226 Q74 225 73 180 Q74 120 77 75 Z" fill="#020202"/>
        <!-- Pooling Black Wax at base -->
        <path d="M26 366 Q60 350 94 366 Q110 376 95 380 Q60 384 25 380 Q10 376 26 366 Z" fill="#020202"/>
      </svg>`;
  }

  function placeFigures() {
    // The candle is now a live canvas renderer (assets/candle.js):
    // continuous flame + molten black wax dripping into a pool.
    // candle.js auto-mounts on DOMContentLoaded; this is an idempotent
    // safety trigger in case init() runs later.
    if (window.NWOCandle) window.NWOCandle.mountAll();
  }

  function init() {
    renderAllForests();
    renderAllStructures();
    placeFigures();
    buildWarDiagram();
    buildClock();
    initReveal();
    initNav();
    initParallax();
    initLightning();
    initParticles();
    initWatchGlow();
    initLivingCycle();
    initCycleDevPanel();
    initHoverEffects();
    initMagneticCursor();

    let resizeT;
    window.addEventListener("resize", () => {
      clearTimeout(resizeT);
      resizeT = setTimeout(() => { renderAllForests(); renderAllStructures(); }, 200);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
