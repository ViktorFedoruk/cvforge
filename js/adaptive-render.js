(function () {
  const CACHE_KEY = "__cvforge_gpu_level_v6";

  // ============================================================
  //  UTILITIES
  // ============================================================
  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  // ============================================================
  //  CACHE (вечный)
  // ============================================================
  function getCachedLevel() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      return JSON.parse(raw).level || null;
    } catch {
      return null;
    }
  }

  function setCachedLevel(level) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ level }));
    } catch {}
  }

  // ============================================================
  //  GPU BENCHMARK (улучшенный Canvas тест)
  // ============================================================
  async function benchmarkGPU() {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 180;
    const ctx = canvas.getContext("2d");

    let frames = 0;
    const start = performance.now();
    const duration = 600;

    return new Promise((resolve) => {
      function frame() {
        const now = performance.now();
        if (now - start > duration) {
          resolve(frames / (duration / 1000));
          return;
        }

        for (let i = 0; i < 40; i++) {
          ctx.fillStyle = `rgba(${(frames * 5 + i * 11) % 255}, 120, 200, 0.4)`;
          ctx.fillRect(Math.random() * 320, Math.random() * 180, 40, 40);
        }

        frames++;
        requestAnimationFrame(frame);
      }

      frame();
    });
  }

  // ============================================================
  //  REAL FPS TEST (1 секунда)
  // ============================================================
  async function benchmarkRealFPS() {
    return new Promise(resolve => {
      let frames = 0;
      let last = performance.now();

      function loop() {
        frames++;
        const now = performance.now();
        if (now - last >= 1000) {
          resolve(frames);
          return;
        }
        requestAnimationFrame(loop);
      }

      requestAnimationFrame(loop);
    });
  }

  // ============================================================
  //  CPU BENCHMARK (усиленный)
  // ============================================================
  function benchmarkCPU() {
    const start = performance.now();
    let x = 0;
    for (let i = 0; i < 200000; i++) x += Math.sqrt(i % 100);
    return performance.now() - start;
  }

  // ============================================================
  //  DOM ANALYZER
  // ============================================================
  function analyzeDOM(elements) {
    let heavyScore = 0;

    elements.forEach((el) => {
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const area = Math.max(1, rect.width * rect.height);

      let score = 0;

      if (cs.backdropFilter !== "none") score += 20;
      if (cs.filter !== "none") score += cs.filter.includes("blur") ? 15 : 4;
      if (cs.boxShadow !== "none") score += 5;
      if (cs.transform !== "none") score += cs.transform.includes("3d") ? 10 : 4;
      if (cs.animationName !== "none") score += 6;

      if (area > 400 * 400) score *= 2;
      else if (area > 250 * 250) score *= 1.5;

      heavyScore += score;
    });

    return heavyScore;
  }

  // ============================================================
  //  HYBRID DECISION ENGINE
  // ============================================================
  function decideLevelHybrid({ gpuFps, realFps, cpuMs, domScore, hw }) {
    let score = 0;

    score += Math.min(gpuFps, 60) / 60 * 30;
    score += Math.min(realFps, 60) / 60 * 30;
    score += Math.max(0, Math.min(1, 120 / cpuMs)) * 15;
    score += Math.max(0, 1 - domScore / 2500) * 15;

    if (hw.memory >= 8) score += 5;
    if (hw.cores >= 8) score += 5;

    if (score > 75) return "gpu-high";
    if (score > 55) return "gpu-mid";
    if (score > 35) return "gpu-low";
    return "gpu-verylow";
  }

  // ============================================================
  //  HOME SCREEN DEGRADATION
  // ============================================================
  function applyHomeLandingDegradation() {
    const style = document.createElement("style");
    style.innerHTML = `
      .gpu-mid .home-hero::before,
      .gpu-mid .home-cta-final::before { filter: blur(100px) !important; opacity: .8 !important; }

      .gpu-low .home-hero::before,
      .gpu-low .home-cta-final::before { filter: blur(60px) !important; opacity: .5 !important; }

      .gpu-verylow .home-hero::before,
      .gpu-verylow .home-cta-final::before { display: none !important; }

      .gpu-mid .home-resume-preview { animation-duration: 9s !important; transform: perspective(900px) rotate(6deg) rotateY(-4deg) rotateX(1deg) !important; }

      .gpu-low .home-resume-preview,
      .gpu-verylow .home-resume-preview { animation: none !important; transform: none !important; }

      .gpu-low .home-floating,
      .gpu-verylow .home-floating { animation: none !important; transform: none !important; }

      .gpu-low .home-step-content,
      .gpu-verylow .home-step-content { backdrop-filter: none !important; background: #fff !important; }

      .gpu-low .home-footer,
      .gpu-verylow .home-footer { backdrop-filter: none !important; background: #fff !important; }

      .gpu-low .home-hero-content,
      .gpu-low .home-step-item,
      .gpu-low .home-cta-inner,
      .gpu-verylow .home-hero-content,
      .gpu-verylow .home-step-item,
      .gpu-verylow .home-cta-inner {
        animation: none !important;
        opacity: 1 !important;
        transform: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  // ============================================================
  //  DASHBOARD DEGRADATION
  // ============================================================
  function applyDashboardDegradation() {
    const style = document.createElement("style");
    style.innerHTML = `

      /* CV CARD */
      .gpu-mid .cv-card {
        backdrop-filter: blur(6px) saturate(120%) !important;
        box-shadow: 0 10px 24px rgba(0,0,0,0.05) !important;
      }

      .gpu-low .cv-card,
      .gpu-verylow .cv-card {
        backdrop-filter: none !important;
        background: #fff !important;
        transform: none !important;
        box-shadow: 0 6px 16px rgba(0,0,0,0.06) !important;
      }

      .gpu-low .cv-card:hover,
      .gpu-verylow .cv-card:hover {
        transform: none !important;
        box-shadow: 0 6px 16px rgba(0,0,0,0.06) !important;
      }

      /* NEW CARD */
      .gpu-low .cv-card-new-inner,
      .gpu-verylow .cv-card-new-inner {
        backdrop-filter: none !important;
        background: #fff !important;
      }

      /* FOOTER */
      .gpu-low .cv-card-footer,
      .gpu-verylow .cv-card-footer {
        backdrop-filter: none !important;
        background: #fff !important;
      }

      /* ACTION BUTTONS */
      .gpu-low .cv-card-action-btn,
      .gpu-verylow .cv-card-action-btn {
        transform: none !important;
      }

      /* PRIMARY BUTTON */
      .gpu-low .primary-btn,
      .gpu-verylow .primary-btn {
        transform: none !important;
      }

      /* MODAL */
      .gpu-low .modal-content,
      .gpu-verylow .modal-content {
        backdrop-filter: none !important;
        background: #fff !important;
        box-shadow: 0 10px 24px rgba(0,0,0,0.12) !important;
      }

      .gpu-low .modal-backdrop,
      .gpu-verylow .modal-backdrop {
        background: rgba(0,0,0,0.25) !important;
      }

      /* TOASTS */
      .gpu-low .toast,
      .gpu-verylow .toast {
        backdrop-filter: none !important;
        background: #fff !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.08) !important;
        transition: none !important;
        transform: none !important;
        opacity: 1 !important;
      }
    `;
    document.head.appendChild(style);
  }

  function applyWizardDegradation() {
    const style = document.createElement("style");
    style.innerHTML = `

        /* =========================================================
        WRAPPER (главная стеклянная панель)
        ========================================================== */

        /* MID — уменьшаем blur и тени */
        .gpu-mid .wizard-wrapper {
        backdrop-filter: blur(6px) !important;
        box-shadow: 0 14px 32px rgba(15,23,42,0.06) !important;
        }

        /* LOW & VERYLOW — убираем стекло полностью */
        .gpu-low .wizard-wrapper,
        .gpu-verylow .wizard-wrapper {
        backdrop-filter: none !important;
        background: #ffffff !important;
        box-shadow: 0 6px 16px rgba(0,0,0,0.05) !important;
        animation: none !important;
        }

        /* =========================================================
        HEADER + PROGRESS
        ========================================================== */

        .gpu-low .wizard-header,
        .gpu-verylow .wizard-header {
        animation: none !important;
        }

        .gpu-low .wizard-progress,
        .gpu-verylow .wizard-progress {
        animation: none !important;
        }

        .gpu-low #wizardProgressFill,
        .gpu-verylow #wizardProgressFill {
        box-shadow: none !important;
        transition: width 0.25s linear !important;
        }

        /* =========================================================
        STEPS NAV (круги, подсветки, blur)
        ========================================================== */

        /* MID — уменьшаем blur */
        .gpu-mid .wizard-steps {
        backdrop-filter: blur(4px) !important;
        box-shadow: 0 6px 20px rgba(15,23,42,0.05) !important;
        }

        /* LOW — убираем blur, тени, анимации */
        .gpu-low .wizard-steps,
        .gpu-verylow .wizard-steps {
        backdrop-filter: none !important;
        background: #ffffff !important;
        box-shadow: none !important;
        animation: none !important;
        }

        /* ACTIVE STEP — убираем pulse */
        .gpu-low .wizard-step.active .step-circle,
        .gpu-verylow .wizard-step.active .step-circle {
        animation: none !important;
        box-shadow: none !important;
        transform: none !important;
        }

        /* HOVER эффект */
        .gpu-low .wizard-step:hover,
        .gpu-verylow .wizard-step:hover {
        transform: none !important;
        background: #ffffff !important;
        }

        /* =========================================================
        PANELS (основные карточки шагов)
        ========================================================== */

        /* MID — мягче тени */
        .gpu-mid .wizard-panel {
        box-shadow: 0 12px 28px rgba(15,23,42,0.06) !important;
        }

        /* LOW — убираем анимации, blur, shimmer */
        .gpu-low .wizard-panel,
        .gpu-verylow .wizard-panel {
        animation: none !important;
        backdrop-filter: none !important;
        background: #ffffff !important;
        box-shadow: 0 6px 16px rgba(0,0,0,0.05) !important;
        }

        .gpu-low .wizard-panel::before,
        .gpu-verylow .wizard-panel::before {
        animation: none !important;
        opacity: 0 !important;
        }

        /* =========================================================
        FORM FIELDS (inputs, textarea)
        ========================================================== */

        /* MID — уменьшаем тени */
        .gpu-mid .form-field input,
        .gpu-mid .form-field textarea {
        box-shadow: 0 1px 2px rgba(0,0,0,0.02) !important;
        }

        /* LOW — убираем hover/active эффекты */
        .gpu-low .form-field input,
        .gpu-low .form-field textarea,
        .gpu-verylow .form-field input,
        .gpu-verylow .form-field textarea {
        box-shadow: none !important;
        transform: none !important;
        transition: none !important;
        }

        /* =========================================================
        TAGS / SKILLS / PILLS
        ========================================================== */

        .gpu-low .tag-pill,
        .gpu-verylow .tag-pill,
        .gpu-low .skill-pill,
        .gpu-verylow .skill-pill {
        box-shadow: none !important;
        transform: none !important;
        animation: none !important;
        }

        /* =========================================================
        CARDS (experience, education)
        ========================================================== */

        .gpu-low .card,
        .gpu-verylow .card {
        box-shadow: none !important;
        transform: none !important;
        animation: none !important;
        }

        .gpu-low .card:hover,
        .gpu-verylow .card:hover {
        transform: none !important;
        box-shadow: none !important;
        }

        /* =========================================================
        MODALS (avatar crop)
        ========================================================== */

        /* MID — уменьшаем blur */
        .gpu-mid .avatar-modal {
        backdrop-filter: blur(4px) !important;
        }

        /* LOW — убираем blur полностью */
        .gpu-low .avatar-modal,
        .gpu-verylow .avatar-modal {
        backdrop-filter: none !important;
        background: rgba(0,0,0,0.4) !important;
        }

        .gpu-low .avatar-modal-content,
        .gpu-verylow .avatar-modal-content {
        backdrop-filter: none !important;
        background: #ffffff !important;
        box-shadow: 0 10px 24px rgba(0,0,0,0.15) !important;
        animation: none !important;
        }

        /* =========================================================
        SUCCESS PANEL
        ========================================================== */

        .gpu-low .success-panel,
        .gpu-verylow .success-panel {
        animation: none !important;
        box-shadow: none !important;
        }

        .gpu-low .success-icon,
        .gpu-verylow .success-icon {
        animation: none !important;
        }

        /* =========================================================
        BUTTONS
        ========================================================== */

        .gpu-low .btn-primary,
        .gpu-low .btn-secondary,
        .gpu-verylow .btn-primary,
        .gpu-verylow .btn-secondary {
        transform: none !important;
        box-shadow: none !important;
        transition: none !important;
        }

        .gpu-low .btn-primary:hover,
        .gpu-low .btn-secondary:hover,
        .gpu-verylow .btn-primary:hover,
        .gpu-verylow .btn-secondary:hover {
        transform: none !important;
        box-shadow: none !important;
        }

    `;
    document.head.appendChild(style);
    }

    function applyCvViewDegradation() {
    const style = document.createElement("style");
    style.innerHTML = `

        /* =========================================================
        PAGE BACKGROUND
        ========================================================== */

        /* MID — замедляем анимацию */
        .gpu-mid body {
        animation-duration: 28s !important;
        }

        /* LOW — убираем анимацию */
        .gpu-low body,
        .gpu-verylow body {
        animation: none !important;
        background-size: cover !important;
        }

        /* =========================================================
        ROOT WRAPPER (главная стеклянная панель)
        ========================================================== */

        /* MID — уменьшаем blur и тени */
        .gpu-mid .cv-root {
        backdrop-filter: blur(6px) !important;
        box-shadow: 0 12px 28px rgba(15,23,42,0.06) !important;
        }

        /* LOW — убираем стекло */
        .gpu-low .cv-root,
        .gpu-verylow .cv-root {
        backdrop-filter: none !important;
        background: #ffffff !important;
        box-shadow: 0 6px 16px rgba(0,0,0,0.05) !important;
        border-color: rgba(0,0,0,0.06) !important;
        }

        /* =========================================================
        TOPBAR (стеклянная панель)
        ========================================================== */

        .gpu-mid .cv-topbar {
        backdrop-filter: blur(6px) !important;
        box-shadow: 0 8px 20px rgba(0,0,0,0.05) !important;
        }

        .gpu-low .cv-topbar,
        .gpu-verylow .cv-topbar {
        backdrop-filter: none !important;
        background: #ffffff !important;
        box-shadow: none !important;
        border-color: rgba(0,0,0,0.06) !important;
        }

        .gpu-low .topbar-btn,
        .gpu-verylow .topbar-btn {
        backdrop-filter: none !important;
        box-shadow: none !important;
        transform: none !important;
        }

        .gpu-low .topbar-btn:hover,
        .gpu-verylow .topbar-btn:hover {
        transform: none !important;
        box-shadow: none !important;
        }

        /* =========================================================
        PROFILE BLOCK
        ========================================================== */

        .gpu-mid .cv-profile {
        backdrop-filter: blur(6px) !important;
        box-shadow: 0 12px 28px rgba(0,0,0,0.05) !important;
        }

        .gpu-low .cv-profile,
        .gpu-verylow .cv-profile {
        backdrop-filter: none !important;
        background: #ffffff !important;
        box-shadow: none !important;
        border-color: rgba(0,0,0,0.06) !important;
        }

        .gpu-low .cv-profile-avatar,
        .gpu-verylow .cv-profile-avatar {
        box-shadow: none !important;
        border-color: rgba(0,0,0,0.08) !important;
        }

        /* =========================================================
        CONTACT TAGS
        ========================================================== */

        .gpu-low .cv-profile-contacts div,
        .gpu-verylow .cv-profile-contacts div {
        backdrop-filter: none !important;
        background: #ffffff !important;
        box-shadow: none !important;
        }

        /* =========================================================
        ADVANTAGES TAGS
        ========================================================== */

        .gpu-low .cv-adv-tag,
        .gpu-verylow .cv-adv-tag {
        backdrop-filter: none !important;
        box-shadow: none !important;
        transform: none !important;
        }

        /* =========================================================
        EXPERIENCE CARDS
        ========================================================== */

        .gpu-mid .cv-exp-item {
        backdrop-filter: blur(6px) !important;
        box-shadow: 0 10px 24px rgba(0,0,0,0.05) !important;
        }

        .gpu-low .cv-exp-item,
        .gpu-verylow .cv-exp-item {
        backdrop-filter: none !important;
        background: #ffffff !important;
        box-shadow: none !important;
        transform: none !important;
        }

        .gpu-low .cv-exp-item:hover,
        .gpu-verylow .cv-exp-item:hover {
        transform: none !important;
        box-shadow: none !important;
        }

        /* =========================================================
        SKILLS COLUMNS
        ========================================================== */

        .gpu-mid .cv-skill-col {
        backdrop-filter: blur(6px) !important;
        box-shadow: 0 10px 24px rgba(0,0,0,0.05) !important;
        }

        .gpu-low .cv-skill-col,
        .gpu-verylow .cv-skill-col {
        backdrop-filter: none !important;
        background: #ffffff !important;
        box-shadow: none !important;
        }

        .gpu-low .cv-skill-item,
        .gpu-verylow .cv-skill-item {
        box-shadow: none !important;
        transform: none !important;
        }

        /* =========================================================
        EDUCATION CARDS
        ========================================================== */

        .gpu-low .cv-edu-item,
        .gpu-verylow .cv-edu-item {
        backdrop-filter: none !important;
        background: #ffffff !important;
        box-shadow: none !important;
        transform: none !important;
        }

        .gpu-low .cv-edu-item:hover,
        .gpu-verylow .cv-edu-item:hover {
        transform: none !important;
        box-shadow: none !important;
        }

        /* =========================================================
        EDIT BUTTON
        ========================================================== */

        .gpu-low .cv-edit-btn,
        .gpu-verylow .cv-edit-btn {
        backdrop-filter: none !important;
        box-shadow: none !important;
        transform: none !important;
        opacity: 1 !important;
        }

        .gpu-low .cv-edit-btn:hover,
        .gpu-verylow .cv-edit-btn:hover {
        transform: none !important;
        box-shadow: none !important;
        }

        /* =========================================================
        LOCKED VIEW
        ========================================================== */

        .gpu-low .cv-locked,
        .gpu-verylow .cv-locked {
        backdrop-filter: none !important;
        background: #ffffff !important;
        box-shadow: none !important;
        }

    `;
    document.head.appendChild(style);
    }

    function applyEditorDegradation() {
    const style = document.createElement("style");
    style.innerHTML = `

        /* =========================================================
        PAGE BACKGROUND
        ========================================================== */

        .gpu-mid body {
        animation-duration: 28s !important;
        }

        .gpu-low body,
        .gpu-verylow body {
        animation: none !important;
        background-size: cover !important;
        }

        /* =========================================================
        EDITOR ROOT WRAPPER
        ========================================================== */

        .gpu-mid .cv-editor-root {
        backdrop-filter: blur(6px) !important;
        box-shadow: 0 12px 28px rgba(15,23,42,0.06) !important;
        }

        .gpu-low .cv-editor-root,
        .gpu-verylow .cv-editor-root {
        backdrop-filter: none !important;
        background: #ffffff !important;
        box-shadow: 0 6px 16px rgba(0,0,0,0.05) !important;
        border-color: rgba(0,0,0,0.06) !important;
        }

        /* =========================================================
        TOPBAR
        ========================================================== */

        .gpu-mid #cvEditorTopbar {
        backdrop-filter: blur(6px) !important;
        box-shadow: 0 8px 20px rgba(0,0,0,0.05) !important;
        }

        .gpu-low #cvEditorTopbar,
        .gpu-verylow #cvEditorTopbar {
        backdrop-filter: none !important;
        background: #ffffff !important;
        box-shadow: none !important;
        border-color: rgba(0,0,0,0.06) !important;
        }

        .gpu-low .topbar-btn,
        .gpu-verylow .topbar-btn {
        backdrop-filter: none !important;
        box-shadow: none !important;
        transform: none !important;
        }

        .gpu-low .topbar-btn:hover,
        .gpu-verylow .topbar-btn:hover {
        transform: none !important;
        box-shadow: none !important;
        }

        /* =========================================================
        EDITOR SECTIONS
        ========================================================== */

        .gpu-mid .editor-section {
        backdrop-filter: blur(6px) !important;
        box-shadow: 0 10px 24px rgba(0,0,0,0.05) !important;
        }

        .gpu-low .editor-section,
        .gpu-verylow .editor-section {
        backdrop-filter: none !important;
        background: #ffffff !important;
        box-shadow: none !important;
        border-color: rgba(0,0,0,0.06) !important;
        }

        /* =========================================================
        INPUTS & TEXTAREAS
        ========================================================== */

        .gpu-low input,
        .gpu-low textarea,
        .gpu-low select,
        .gpu-verylow input,
        .gpu-verylow textarea,
        .gpu-verylow select {
        box-shadow: none !important;
        transform: none !important;
        transition: none !important;
        background: #ffffff !important;
        }

        /* =========================================================
        LIST ITEMS (experience, education)
        ========================================================== */

        .gpu-mid .editor-item,
        .gpu-mid .editor-exp-block,
        .gpu-mid .editor-edu-block {
        backdrop-filter: blur(4px) !important;
        box-shadow: 0 8px 20px rgba(0,0,0,0.05) !important;
        }

        .gpu-low .editor-item,
        .gpu-low .editor-exp-block,
        .gpu-low .editor-edu-block,
        .gpu-verylow .editor-item,
        .gpu-verylow .editor-exp-block,
        .gpu-verylow .editor-edu-block {
        backdrop-filter: none !important;
        background: #ffffff !important;
        box-shadow: none !important;
        transform: none !important;
        }

        .gpu-low .editor-item:hover,
        .gpu-low .editor-exp-block:hover,
        .gpu-low .editor-edu-block:hover,
        .gpu-verylow .editor-item:hover,
        .gpu-verylow .editor-exp-block:hover,
        .gpu-verylow .editor-edu-block:hover {
        transform: none !important;
        box-shadow: none !important;
        }

        /* =========================================================
        TAGS & SKILLS
        ========================================================== */

        .gpu-low .adv-tag,
        .gpu-low .skill-pill,
        .gpu-verylow .adv-tag,
        .gpu-verylow .skill-pill {
        box-shadow: none !important;
        transform: none !important;
        backdrop-filter: none !important;
        }

        /* =========================================================
        DATEPICKER
        ========================================================== */

        .gpu-mid #glassDatepicker {
        backdrop-filter: blur(6px) !important;
        box-shadow: 0 12px 28px rgba(0,0,0,0.05) !important;
        }

        .gpu-low #glassDatepicker,
        .gpu-verylow #glassDatepicker {
        backdrop-filter: none !important;
        background: #ffffff !important;
        box-shadow: none !important;
        animation: none !important;
        }

        .gpu-low .gdp-menu,
        .gpu-verylow .gdp-menu {
        backdrop-filter: none !important;
        background: #ffffff !important;
        box-shadow: none !important;
        }

        /* =========================================================
        DROPDOWNS
        ========================================================== */

        .gpu-low .select-input-dropdown,
        .gpu-verylow .select-input-dropdown {
        backdrop-filter: none !important;
        background: #ffffff !important;
        box-shadow: none !important;
        transform: none !important;
        transition: none !important;
        }

        /* =========================================================
        AVATAR MODAL
        ========================================================== */

        .gpu-mid .avatar-modal {
        backdrop-filter: blur(4px) !important;
        }

        .gpu-low .avatar-modal,
        .gpu-verylow .avatar-modal {
        backdrop-filter: none !important;
        background: rgba(0,0,0,0.4) !important;
        }

        .gpu-low .avatar-modal-content,
        .gpu-verylow .avatar-modal-content {
        backdrop-filter: none !important;
        background: #ffffff !important;
        box-shadow: none !important;
        animation: none !important;
        }

        /* =========================================================
        BUTTONS
        ========================================================== */

        .gpu-low .add-btn,
        .gpu-low .add-btn-2,
        .gpu-low .delete-btn,
        .gpu-low .avatar-btn,
        .gpu-verylow .add-btn,
        .gpu-verylow .add-btn-2,
        .gpu-verylow .delete-btn,
        .gpu-verylow .avatar-btn {
        box-shadow: none !important;
        transform: none !important;
        backdrop-filter: none !important;
        }

        .gpu-low .add-btn:hover,
        .gpu-low .add-btn-2:hover,
        .gpu-low .delete-btn:hover,
        .gpu-low .avatar-btn:hover,
        .gpu-verylow .add-btn:hover,
        .gpu-verylow .add-btn-2:hover,
        .gpu-verylow .delete-btn:hover,
        .gpu-verylow .avatar-btn:hover {
        transform: none !important;
        box-shadow: none !important;
        }

    `;
    document.head.appendChild(style);
    }

function enableViewportRendering() {
    const lazyElements = document.querySelectorAll(
        ".lazy-render, .editor-exp-block, .editor-edu-block, .cv-exp-item, .cv-edu-item, .skills-column"
    );

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
        }
        });
    }, {
        rootMargin: "200px 0px", // подгружаем заранее
        threshold: 0.01
    });

    lazyElements.forEach(el => {
        el.classList.add("lazy-init");
        observer.observe(el);
    });
}

function enableLazyHydrate() {
  const heavyBlocks = document.querySelectorAll(
    ".editor-exp-block, .editor-edu-block, .skills-column, .editor-section, .cv-exp-item, .cv-edu-item, .cv-skill-col, .cv-card, .wizard-panel"
  );

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;

      const el = entry.target;

      el.dataset.hydrated = "1";

      if ("requestIdleCallback" in window) {
        requestIdleCallback(() => hydrateElement(el));
      } else {
        setTimeout(() => hydrateElement(el), 0);
      }

      observer.unobserve(el);
    });
  }, {
    rootMargin: "200px 0px",
    threshold: 0.01
  });

  heavyBlocks.forEach(el => {
    el.dataset.hydrated = "0";
    observer.observe(el);
  });
}

function hydrateElement(el) {
  el.classList.add("hydrated");
}

function virtualizeList(containerSelector, itemSelector, itemHeight = 220) {
  const container = document.querySelector(containerSelector);
  if (!container) return;

  const items = Array.from(container.querySelectorAll(itemSelector));
  if (items.length <= 8) return; // виртуализация не нужна

  const total = items.length;
  const viewport = document.createElement("div");
  viewport.style.position = "relative";
  viewport.style.height = total * itemHeight + "px";

  container.innerHTML = "";
  container.appendChild(viewport);

  const pool = [];

  function render() {
    const scrollTop = container.scrollTop;
    const height = container.clientHeight;

    const start = Math.floor(scrollTop / itemHeight);
    const end = Math.min(total, start + Math.ceil(height / itemHeight) + 3);

    viewport.innerHTML = "";

    for (let i = start; i < end; i++) {
      const el = items[i].cloneNode(true);
      el.style.position = "absolute";
      el.style.top = i * itemHeight + "px";
      el.style.left = 0;
      el.style.right = 0;
      viewport.appendChild(el);
    }
  }

  container.addEventListener("scroll", render);
  render();
}

  // ============================================================
  //  APPLY OPTIMIZATION
  // ============================================================
  function applyOptimization(level) {
    document.documentElement.classList.add(level);
    applyHomeLandingDegradation();
    applyDashboardDegradation();
    applyWizardDegradation();
    applyCvViewDegradation();
    applyEditorDegradation();
    enableViewportRendering();
    enableLazyHydrate();

    virtualizeList(".editor-list", ".editor-exp-block", 260);
    virtualizeList(".editor-list", ".editor-edu-block", 260);
    virtualizeList(".cv-exp-list", ".cv-exp-item", 240);
    virtualizeList(".cv-edu-list", ".cv-edu-item", 240);
  }

  // ============================================================
  //  MAIN
  // ============================================================
  async function init() {
    const cached = getCachedLevel();
    if (cached) {
      applyOptimization(cached);
      return;
    }

    if (document.visibilityState !== "visible") {
      document.addEventListener("visibilitychange", init, { once: true });
      return;
    }

    await sleep(150);

    const gpuFps = await benchmarkGPU();
    const realFps = await benchmarkRealFPS();
    const cpuMs = benchmarkCPU();
    const domScore = analyzeDOM(Array.from(document.querySelectorAll("*")));

    const hw = {
      memory: navigator.deviceMemory || 4,
      cores: navigator.hardwareConcurrency || 4
    };

    const level = decideLevelHybrid({ gpuFps, realFps, cpuMs, domScore, hw });

    setCachedLevel(level);
    applyOptimization(level);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
