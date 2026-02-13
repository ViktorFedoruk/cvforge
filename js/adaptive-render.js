(function () {
  const CACHE_KEY = "__cvforge_gpu_level_v6";
  const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 часа

  // ================================
  // CACHE
  // ================================
  function getCachedLevel() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data.level || !data.ts) return null;
      if (Date.now() - data.ts > CACHE_TTL) return null;
      return data.level;
    } catch {
      return null;
    }
  }

  function setCachedLevel(level) {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ level, ts: Date.now() })
      );
    } catch {}
  }

  // ================================
  // GPU BENCHMARK
  // ================================
  async function benchmarkGPU() {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 180;
    const ctx = canvas.getContext("2d");

    let frames = 0;
    const start = performance.now();
    const duration = 220;

    return new Promise((resolve) => {
      function frame() {
        const now = performance.now();
        if (now - start > duration) {
          resolve(frames / (duration / 1000));
          return;
        }

        for (let i = 0; i < 30; i++) {
          ctx.fillStyle = `rgba(${(frames * 7 + i * 13) % 255}, 120, 200, 0.4)`;
          ctx.fillRect(Math.random() * 320, Math.random() * 180, 40, 40);
        }

        frames++;
        requestAnimationFrame(frame);
      }

      frame();
    });
  }

  // ================================
  // CPU BENCHMARK
  // ================================
  function benchmarkCPU() {
    const start = performance.now();
    let x = 0;
    for (let i = 0; i < 50000; i++) x += Math.sqrt(i % 100);
    return performance.now() - start;
  }

  // ================================
  // DOM ANALYZER
  // ================================
  function analyzeDOM(elements) {
    let heavyScore = 0;
    const heavyElements = [];

    elements.forEach((el) => {
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const area = Math.max(1, rect.width * rect.height);

      let score = 0;

      if (cs.backdropFilter !== "none") score += 20;
      if (cs.filter !== "none") {
        if (cs.filter.includes("blur")) score += 15;
        else score += 4;
      }
      if (cs.boxShadow !== "none") score += 5;
      if (cs.transform !== "none") {
        if (cs.transform.includes("3d")) score += 10;
        else score += 4;
      }
      if (cs.animationName !== "none") score += 6;

      if (area > 400 * 400) score *= 2;
      else if (area > 250 * 250) score *= 1.5;

      if (score > 0) {
        heavyScore += score;
        heavyElements.push({ el, cs, rect, score, area });
      }
    });

    return { heavyScore, heavyElements };
  }

  // ================================
  // LEVEL DECISION
  // ================================
  function decideLevel(fps, cpuMs, heavyScore) {
    if (fps >= 55 && cpuMs < 25 && heavyScore < 600) return "gpu-high";
    if (fps >= 45 && cpuMs < 40 && heavyScore < 1200) return "gpu-mid";
    if (fps >= 30 && cpuMs < 70 && heavyScore < 2200) return "gpu-low";
    return "gpu-verylow";
  }

  // ================================
  // OPTIMIZATION HELPERS
  // ================================

  // ——— BLUR ———
  function softenBlur(heavyElements) {
    heavyElements.forEach(({ el, cs }) => {
      if (!cs.filter.includes("blur")) return;
      const match = cs.filter.match(/blur\(([^)]+)\)/);
      if (!match) return;
      const raw = parseFloat(match[1]);
      const reduced = Math.max(0, Math.min(raw * 0.3, 3));
      el.style.filter =
        reduced === 0
          ? "none"
          : cs.filter.replace(/blur\([^)]+\)/, `blur(${reduced}px)`);
    });
  }

  function removeBlur(heavyElements) {
    heavyElements.forEach(({ el, cs }) => {
      if (cs.filter !== "none") el.style.filter = "none";
    });
  }

  // ——— BACKDROP FILTER / GLASS ———
  function softenBackdropFilter(heavyElements) {
    heavyElements.forEach(({ el, cs }) => {
      if (cs.backdropFilter === "none") return;
      el.style.backdropFilter = "blur(4px)";
      el.style.backgroundColor = "rgba(255,255,255,0.9)";
    });
  }

  function fallbackGlassToSolid(heavyElements) {
    heavyElements.forEach(({ el, cs }) => {
      const hasGlass =
        cs.backdropFilter !== "none" || cs.filter.includes("blur");

      if (!hasGlass) return;

      el.style.backdropFilter = "none";
      el.style.filter = "none";

      el.style.backgroundColor = "#ffffff";
      el.style.border = "1px solid rgba(0,0,0,0.08)";
      el.style.boxShadow = "0 0 1px rgba(0,0,0,0.15)";
    });
  }

  // ——— TRANSFORMS ———
  function softenTransforms(heavyElements) {
    heavyElements.forEach(({ el, cs }) => {
      if (cs.transform === "none") return;
      el.style.transform = "none";
    });
  }

  function removeTransforms(heavyElements) {
    heavyElements.forEach(({ el, cs }) => {
      if (cs.transform !== "none") el.style.transform = "none";
    });
  }

  // ——— ANIMATIONS ———
  function softenAnimations(heavyElements) {
    heavyElements.forEach(({ el, cs }) => {
      if (cs.animationName === "none") return;
      el.style.animationDuration = "2s";
    });
  }

  function removeAnimations(heavyElements) {
    heavyElements.forEach(({ el, cs }) => {
      if (cs.animationName !== "none") el.style.animation = "none";
      if (cs.transitionDuration !== "0s") el.style.transition = "none";
    });
  }

  // ——— GRADIENT SHIFT / BACKGROUND ANIMATIONS ———
  function injectGlobalDegradationStyles() {
    const style = document.createElement("style");
    style.innerHTML = `
      /* Глобальная деградация градиентов по пресетам */
      .gpu-mid .gradientshift,
      .gpu-mid .bg-animated,
      .gpu-mid .bg-shift,
      .gpu-mid .animated-gradient {
        animation-duration: 12s !important;
      }

      .gpu-low .gradientshift,
      .gpu-low .bg-animated,
      .gpu-low .bg-shift,
      .gpu-low .animated-gradient {
        animation-duration: 20s !important;
      }

      .gpu-verylow .gradientshift,
      .gpu-verylow .bg-animated,
      .gpu-verylow .bg-shift,
      .gpu-verylow .animated-gradient {
        animation: none !important;
        background-position: center !important;
      }

      /* Глобальное отключение тяжёлых эффектов для offscreen-блоков */
      .vp-offscreen,
      .vp-offscreen * {
        animation: none !important;
        transition: none !important;
        box-shadow: none !important;
        filter: none !important;
        backdrop-filter: none !important;
        transform: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  // ——— HOVER EFFECTS ———
  function disableHoverLift() {
    const style = document.createElement("style");
    style.innerHTML = `
      .gpu-low *:hover,
      .gpu-verylow *:hover {
        transform: none !important;
        box-shadow: inherit !important;
      }
    `;
    document.head.appendChild(style);
  }

  // ——— GLOBAL ANIMATIONS / SHADOWS / BLUR FOR LOW PRESETS ———
  function disableAnimationsForLowPreset() {
    const style = document.createElement("style");
    style.innerHTML = `
      .gpu-low *, .gpu-verylow * {
        animation: none !important;
        transition: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  function disableShadowsForLowPreset() {
    const style = document.createElement("style");
    style.innerHTML = `
      .gpu-low *, .gpu-verylow * {
        box-shadow: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  function disableBlurForVeryLow() {
    const style = document.createElement("style");
    style.innerHTML = `
      .gpu-verylow * {
        backdrop-filter: none !important;
        filter: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  // ================================
  // VIEWPORT VIRTUALIZATION (АКТИВНЫЙ РЕНДЕР ТОЛЬКО ВО ВЬЮПОРТЕ)
  // ================================
  function enableViewportVirtualization(groups, margin = 300) {
    const blocks = [];

    groups.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        blocks.push(el);
      });
    });

    if (!blocks.length) return;

    function update() {
      const vh = window.innerHeight;

      blocks.forEach(el => {
        const rect = el.getBoundingClientRect();
        const visible =
          rect.bottom > -margin && rect.top < vh + margin;

        if (visible) {
          if (el.classList.contains("vp-offscreen")) {
            el.classList.remove("vp-offscreen");
          }
          el.style.visibility = "visible";
          el.style.opacity = "1";
        } else {
          if (!el.classList.contains("vp-offscreen")) {
            el.classList.add("vp-offscreen");
          }
          el.style.visibility = "hidden";
          el.style.opacity = "0";
        }
      });
    }

    update();
    window.addEventListener("scroll", () => requestAnimationFrame(update));
    window.addEventListener("resize", () => requestAnimationFrame(update));
  }

  // ================================
  // APPLY OPTIMIZATION
  // ================================
  function applyOptimization(level, heavyElements) {
    const root = document.documentElement;
    root.classList.remove("gpu-high", "gpu-mid", "gpu-low", "gpu-verylow");
    root.classList.add(level);

    injectGlobalDegradationStyles();
    disableBlurForVeryLow();
    disableShadowsForLowPreset();
    disableAnimationsForLowPreset();

    if (level === "gpu-high") return;

    if (level === "gpu-mid") {
      root.classList.add("perf-solid");
      softenBlur(heavyElements);
      softenBackdropFilter(heavyElements);
      softenTransforms(heavyElements);
      softenAnimations(heavyElements);
    }

    if (level === "gpu-low") {
        root.classList.add("perf-solid");
      softenBlur(heavyElements);
      heavyElements.forEach(({ el, cs }) => {
        if (cs.backdropFilter !== "none") {
          el.style.backdropFilter = "blur(1px)";
          el.style.backgroundColor = "rgba(255,255,255,0.75)";
        }
      });
      softenTransforms(heavyElements);
      disableHoverLift();
      softenAnimations(heavyElements);
    }

    if (level === "gpu-verylow") {
      root.classList.add("perf-solid");
      removeBlur(heavyElements);
      fallbackGlassToSolid(heavyElements);
      removeTransforms(heavyElements);
      removeAnimations(heavyElements);
      disableHoverLift();
    }
  }

  // ================================
  // ADAPTIVE PRESET FALLBACK (FPS < 40 > 3s)
  // ================================
  function startAdaptivePresetFallback() {
    let lastFrames = 0;
    let lastTime = performance.now();
    let lowFpsSeconds = 0;
    let fallbackActive = true;

    function loop() {
      const now = performance.now();
      lastFrames++;

      if (now - lastTime >= 1000) {
        const fps = lastFrames;
        lastFrames = 0;
        lastTime = now;

        if (fps < 40) {
          lowFpsSeconds++;
        } else {
          lowFpsSeconds = 0;
        }

        if (fallbackActive && lowFpsSeconds >= 3) {
          const changed = downgradePreset();
          if (!changed) {
            fallbackActive = false; // уже gpu-verylow
          }
          lowFpsSeconds = 0;
        }
      }

      requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);
  }

  function downgradePreset() {
    const root = document.documentElement;

    if (root.classList.contains("gpu-high")) {
      root.classList.remove("gpu-high");
      root.classList.add("gpu-mid");
      return true;
    }

    if (root.classList.contains("gpu-mid")) {
      root.classList.remove("gpu-mid");
      root.classList.add("gpu-low");
      return true;
    }

    if (root.classList.contains("gpu-low")) {
      root.classList.remove("gpu-low");
      root.classList.add("gpu-verylow");
      return true;
    }

    return false;
  }

  // ================================
  // MAIN
  // ================================
  async function init() {
    const cached = getCachedLevel();
    const elements = Array.from(document.querySelectorAll("*"));
    const { heavyScore, heavyElements } = analyzeDOM(elements);

    // Включаем виртуализацию крупных блоков:
    // — лендинг
    // — мастер
    // — просмотр резюме
    enableViewportVirtualization([
      ".home-step-content",
      ".home-cta-final",
      ".home-hero-content",
      ".home-resume-preview",
      ".wizard-wrapper",
      ".wizard-step",
      ".cv-section",
      ".cv-page",
      ".experience-item",
      ".education-item"
    ]);

    if (cached) {
      applyOptimization(cached, heavyElements);
      startAdaptivePresetFallback();
      return;
    }

    const [fps, cpuMs] = await Promise.all([benchmarkGPU(), benchmarkCPU()]);
    const level = decideLevel(fps, cpuMs, heavyScore);

    setCachedLevel(level);
    applyOptimization(level, heavyElements);
    startAdaptivePresetFallback();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
