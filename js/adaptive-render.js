(function () {
  const CACHE_KEY = "__cvforge_gpu_level_v4";
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

      // Убираем border-radius из анализа — больше не трогаем
      // if (parseFloat(cs.borderRadius) > 20) score += 2;

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
  function softenShadows(heavyElements, factor = 0.5) {
    heavyElements.forEach(({ el, cs, area }) => {
      if (cs.boxShadow === "none") return;
      const localFactor = area > 400 * 400 ? factor * 0.4 : factor;
      el.style.boxShadow = `0 2px 8px rgba(0,0,0,${0.06 * localFactor})`;
    });
  }

  function removeShadows(heavyElements) {
    heavyElements.forEach(({ el, cs }) => {
      if (cs.boxShadow !== "none") el.style.boxShadow = "none";
    });
  }

  function softenBlur(heavyElements) {
    heavyElements.forEach(({ el, cs }) => {
      if (!cs.filter.includes("blur")) return;
      const match = cs.filter.match(/blur\(([^)]+)\)/);
      if (!match) return;
      const raw = parseFloat(match[1]);
      const reduced = Math.max(0, Math.min(raw * 0.3, 3));
      el.style.filter = reduced === 0 ? "none" : cs.filter.replace(/blur\([^)]+\)/, `blur(${reduced}px)`);
    });
  }

  function removeBlur(heavyElements) {
    heavyElements.forEach(({ el, cs }) => {
      if (cs.filter !== "none") el.style.filter = "none";
    });
  }

  function softenBackdropFilter(heavyElements) {
    heavyElements.forEach(({ el, cs }) => {
      if (cs.backdropFilter === "none") return;
      el.style.backdropFilter = "none";
      el.style.backgroundColor = "rgba(255,255,255,0.85)";
    });
  }

  function removeBackdropFilter(heavyElements) {
    heavyElements.forEach(({ el, cs }) => {
      if (cs.backdropFilter !== "none") {
        el.style.backdropFilter = "none";
        el.style.backgroundColor = "rgba(255,255,255,0.9)";
      }
    });
  }

  function softenTransforms(heavyElements) {
    heavyElements.forEach(({ el, cs, area }) => {
      if (cs.transform === "none") return;
      if (cs.transform.includes("3d")) {
        el.style.transform = "none";
        return;
      }
      if (area > 400 * 400) el.style.transform = "none";
    });
  }

  function removeTransforms(heavyElements) {
    heavyElements.forEach(({ el, cs }) => {
      if (cs.transform !== "none") el.style.transform = "none";
    });
  }

  function softenAnimations(heavyElements, factor = 0.5) {
    heavyElements.forEach(({ el, cs, area }) => {
      if (cs.animationName === "none") return;
      const dur = parseFloat(cs.animationDuration);
      if (isNaN(dur) || dur === 0) return;
      const localFactor = area > 400 * 400 ? factor * 0.4 : factor;
      el.style.animationDuration = dur * localFactor + "s";
    });
  }

  function removeAnimations(heavyElements) {
    heavyElements.forEach(({ el, cs }) => {
      if (cs.animationName !== "none") el.style.animation = "none";
      if (cs.transitionDuration !== "0s") el.style.transition = "none";
    });
  }

  // ================================
  // APPLY OPTIMIZATION
  // ================================
  function applyOptimization(level, heavyElements) {
    document.documentElement.classList.add(level);

    if (level === "gpu-high") return;

    if (level === "gpu-mid") {
      softenShadows(heavyElements, 0.6);
      softenBlur(heavyElements);
      softenBackdropFilter(heavyElements);
      softenTransforms(heavyElements);
      softenAnimations(heavyElements, 0.6);
    }

    if (level === "gpu-low") {
      softenShadows(heavyElements, 0.4);
      softenBlur(heavyElements);
      removeBackdropFilter(heavyElements);
      softenTransforms(heavyElements);
      softenAnimations(heavyElements, 0.4);
    }

    if (level === "gpu-verylow") {
      removeShadows(heavyElements);
      removeBlur(heavyElements);
      removeBackdropFilter(heavyElements);
      removeTransforms(heavyElements);
      removeAnimations(heavyElements);
    }
  }

  // ================================
  // MAIN
  // ================================
  async function init() {
    const cached = getCachedLevel();
    const elements = Array.from(document.querySelectorAll("*"));
    const { heavyScore, heavyElements } = analyzeDOM(elements);

    if (cached) {
      applyOptimization(cached, heavyElements);
      return;
    }

    const [fps, cpuMs] = await Promise.all([benchmarkGPU(), benchmarkCPU()]);
    const level = decideLevel(fps, cpuMs, heavyScore);

    setCachedLevel(level);
    applyOptimization(level, heavyElements);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
