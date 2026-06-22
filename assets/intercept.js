// ============================================================
// NO WAY OUT — intercept audio player
// ============================================================
(function () {
  "use strict";

  function fmtTime(s) {
    s = Math.max(0, s | 0);
    const m = Math.floor(s / 60);
    const ss = s % 60;
    return `${m}:${ss.toString().padStart(2, "0")}`;
  }

  // Deterministic fake-waveform bars (visual only — true decode is heavy for a voice track)
  function drawWaveform(canvas, seedStr) {
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    let seed = 0;
    for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) | 0;
    const rnd = window.NWOForest.mulberry32(seed >>> 0);

    const bars = Math.floor(w / 4);
    const mid = h / 2;
    let energy = 0.4;
    for (let i = 0; i < bars; i++) {
      energy += (rnd() - 0.5) * 0.25;
      energy = Math.max(0.12, Math.min(1, energy));
      // slow envelope so it reads as speech, not noise
      const amp = (0.25 + energy * 0.75) * (0.55 + 0.45 * Math.sin(i * 0.13));
      const bh = Math.max(2, amp * h * 0.82);
      const x = i * 4;
      ctx.fillStyle = "rgba(232,225,211,0.22)";
      ctx.fillRect(x, mid - bh / 2, 2.4, bh);
    }
    canvas.dataset.bars = bars;
  }

  function initPlayer(root) {
    const audio = root.querySelector("[data-audio]");
    const playBtn = root.querySelector("[data-play]");
    const waveform = root.querySelector("[data-waveform]");
    const waveCanvas = waveform.querySelector("canvas");
    const progress = root.querySelector("[data-progress]");
    const elapsedEl = root.querySelector("[data-elapsed]");
    const remainEl = root.querySelector("[data-remain]");
    const chapterEls = Array.from(root.querySelectorAll("[data-chapter]"));
    const transcriptPanel = root.querySelector("[data-transcript]");
    let segments = [];
    let chapters = [];
    let segEls = [];
    let duration = 0;
    let loaded = false;
    let userScrolling = false;
    let userScrollTimer = null;

    drawWaveform(waveCanvas, "no-way-out-intercept");
    window.addEventListener("resize", () => drawWaveform(waveCanvas, "no-way-out-intercept"));

    // load transcript JSON (lightweight, always fetched)
    fetch("assets/discussion.json")
      .then((r) => r.json())
      .then((data) => {
        duration = data.duration;
        segments = data.segments;
        chapters = data.chapters;
        remainEl.textContent = "-" + fmtTime(duration);
        renderTranscript();
      })
      .catch(() => {
        transcriptPanel.innerHTML = '<p class="body-text" style="color:var(--ash)">Transcript unavailable.</p>';
      });

    function renderTranscript() {
      const frag = document.createDocumentFragment();
      segments.forEach((seg, i) => {
        const div = document.createElement("div");
        div.className = "t-seg";
        div.dataset.idx = i;
        div.dataset.t = seg.t;
        div.innerHTML = `<span class="ts">${fmtTime(seg.t)}</span>${seg.text}`;
        div.addEventListener("click", () => seekTo(seg.t));
        frag.appendChild(div);
      });
      transcriptPanel.appendChild(frag);
      segEls = Array.from(transcriptPanel.querySelectorAll(".t-seg"));
      transcriptPanel.addEventListener("scroll", () => {
        userScrolling = true;
        clearTimeout(userScrollTimer);
        userScrollTimer = setTimeout(() => (userScrolling = false), 2200);
      });
    }

    function ensureLoaded() {
      if (loaded) return;
      loaded = true;
      const sources = audio.querySelectorAll("source");
      sources.forEach((s) => {
        const real = s.dataset.srcWebm || s.dataset.srcMp4;
        if (real) s.src = real;
      });
      audio.load();
    }

    function seekTo(t) {
      ensureLoaded();
      const trySeek = () => {
        audio.currentTime = t;
        audio.play().catch(() => {});
      };
      if (audio.readyState >= 1) trySeek();
      else audio.addEventListener("loadedmetadata", trySeek, { once: true });
    }

    playBtn.addEventListener("click", () => {
      ensureLoaded();
      if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
    });

    audio.addEventListener("play", () => {
      root.classList.add("playing");
      playBtn.innerHTML = pauseIcon();
    });
    audio.addEventListener("pause", () => {
      root.classList.remove("playing");
      playBtn.innerHTML = playIcon();
    });

    audio.addEventListener("timeupdate", () => {
      const d = duration || audio.duration || 1;
      const pct = (audio.currentTime / d) * 100;
      progress.style.width = pct + "%";
      elapsedEl.textContent = fmtTime(audio.currentTime);
      remainEl.textContent = "-" + fmtTime(Math.max(0, d - audio.currentTime));
      updateActiveSegment(audio.currentTime);
      updateActiveChapter(audio.currentTime);
    });

    function updateActiveSegment(t) {
      if (!segments.length) return;
      let idx = 0;
      for (let i = 0; i < segments.length; i++) {
        if (segments[i].t <= t) idx = i; else break;
      }
      segEls.forEach((el, i) => el.classList.toggle("active", i === idx));
      if (!userScrolling && segEls[idx]) {
        const el = segEls[idx];
        const panelRect = transcriptPanel.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        if (elRect.top < panelRect.top + 20 || elRect.bottom > panelRect.bottom - 20) {
          el.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      }
    }

    function updateActiveChapter(t) {
      if (!chapterEls.length) return;
      let idx = 0;
      for (let i = 0; i < chapterEls.length; i++) {
        if (parseFloat(chapterEls[i].dataset.t) <= t) idx = i; else break;
      }
      chapterEls.forEach((el, i) => el.classList.toggle("active", i === idx));
    }

    waveform.addEventListener("click", (e) => {
      const rect = waveform.getBoundingClientRect();
      const frac = (e.clientX - rect.left) / rect.width;
      const d = duration || 1;
      seekTo(frac * d);
    });

    chapterEls.forEach((el) => {
      el.addEventListener("click", () => seekTo(parseFloat(el.dataset.t)));
    });

    // pull-quote chips jump straight into the player
    root.querySelectorAll("[data-quote-jump]").forEach((el) => {
      el.addEventListener("click", () => {
        seekTo(parseFloat(el.dataset.quoteJump));
        root.querySelector(".player").scrollIntoView({ block: "center", behavior: "smooth" });
      });
    });
  }

  function playIcon() {
    return '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
  }
  function pauseIcon() {
    return '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';
  }

  function init() {
    document.querySelectorAll("[data-intercept-player]").forEach((root) => {
      root.querySelector("[data-play]").innerHTML = playIcon();
      initPlayer(root);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
