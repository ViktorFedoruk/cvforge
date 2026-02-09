import { supabase } from "../js/supabase.js";
import { generateCVHTML } from "../editor/generate-cv-html.js";

let cvId = null;
let cvData = null;
let currentUser = null;

/* -------------------------------------------------------
   LOAD CURRENT USER
------------------------------------------------------- */
async function loadCurrentUser() {
  const { data } = await supabase.auth.getSession();
  currentUser = data?.session?.user || null;
}

/* -------------------------------------------------------
   LOAD DATA
------------------------------------------------------- */
async function loadCV(id) {
  const { data: cv } = await supabase
    .from("cv")
    .select("*")
    .eq("id", id)
    .single();

  const { data: cv_profile } = await supabase
    .from("cv_profiles")
    .select("*")
    .eq("cv_id", id)
    .single();

  const { data: experience } = await supabase
    .from("experience")
    .select("*")
    .eq("cv_id", id)
    .order("order_index", { ascending: true });

  const { data: skills } = await supabase
    .from("skills")
    .select("*")
    .eq("cv_id", id);

  const { data: advantages } = await supabase
    .from("advantages")
    .select("*")
    .eq("cv_id", id);

  const { data: education } = await supabase
    .from("education")
    .select("*")
    .eq("cv_id", id);

  const expStats = calculateExperience(experience || []);

  cvData = {
    cv,
    cv_profile,
    experience: experience || [],
    skills: skills || [],
    advantages: advantages || [],
    education: education || [],
    expStats
  };
}

/* -------------------------------------------------------
   RENDER VIEW
------------------------------------------------------- */
function renderView() {
  const topbarEl = document.getElementById("cvTopbar");
  const contentEl = document.getElementById("cvContent");

  const cv = cvData.cv;

  // CASE: RLS запретил SELECT
  if (!cv) {
    topbarEl.style.display = "none";

    contentEl.innerHTML = `
      <div class="cv-locked">
        <i class="fas fa-lock"></i>
        <h2>Резюме недоступно</h2>
        <p>Владелец отключил публичный доступ к этому резюме.</p>
      </div>
    `;

    document.querySelector(".cv-view-wrapper")?.classList.add("ready");
    return;
  }

  const isOwner = currentUser && currentUser.id === cv.user_id;
  const isPublic = cv.is_public === true;

  // CASE: Гость или не-владелец, а резюме закрыто
  if (!isOwner && !isPublic) {
    topbarEl.style.display = "none";

    contentEl.innerHTML = `
      <div class="cv-locked">
        <i class="fas fa-lock"></i>
        <h2>Резюме недоступно</h2>
        <p>Владелец отключил публичный доступ к этому резюме.</p>
      </div>
    `;

    document.querySelector(".cv-view-wrapper")?.classList.add("ready");
    return;
  }

  /* -------------------------------------------------------
     2) Рендерим обычный контент
  ------------------------------------------------------- */
  const html = generateCVHTML(cvData);
  contentEl.innerHTML = html;

  /* -------------------------------------------------------
     2.1) Загружаем аватар (ВАЖНО!)
  ------------------------------------------------------- */
  if (cvData.cv_profile.avatar_url && window.loadAvatarWithCache) {
    window.loadAvatarWithCache(
      cvData.cv_profile.avatar_url + "?width=200&height=200&quality=70",
      cv.id,
      contentEl
    );
  }

  /* -------------------------------------------------------
     3) Топбар
  ------------------------------------------------------- */
  let topbarHTML = "";

  if (!currentUser) {
    topbarEl.style.display = "none";

  } else if (!isOwner) {
    topbarHTML = `
      <div class="cv-topbar-left">
        <button id="backToDashboard" class="topbar-btn">
          <i class="fas fa-arrow-left"></i>
          Назад
        </button>
      </div>
      <div class="cv-topbar-center"></div>
      <div class="cv-topbar-right"></div>
    `;

  } else {
    topbarHTML = `
      <div class="cv-topbar-left">
        <button id="backToDashboard" class="topbar-btn">
          <i class="fas fa-arrow-left"></i>
          Вернуться к дашборду
        </button>
      </div>

      <div class="cv-topbar-center">
        <h1 class="cv-title">${cv.title}</h1>
      </div>

      <div class="cv-topbar-right">
        <button id="editCvBtn" class="topbar-btn primary">
          <i class="fas fa-edit"></i>
          Редактировать
        </button>
      </div>
    `;
  }

  if (topbarHTML) {
    const tempTopbar = document.createElement("div");
    tempTopbar.innerHTML = topbarHTML;

    morphdom(topbarEl, tempTopbar, { childrenOnly: true });
    topbarEl.style.display = "";
  }

  document.querySelector(".cv-view-wrapper")?.classList.add("ready");
}

/* -------------------------------------------------------
   EXPERIENCE CALCULATIONS
------------------------------------------------------- */
function diffInMonths(start, end) {
  const s = new Date(start);
  const e = end ? new Date(end) : new Date();

  return (
    (e.getFullYear() - s.getFullYear()) * 12 +
    (e.getMonth() - s.getMonth())
  );
}

function formatExperience(months) {
  if (!months || months < 1) return "менее месяца";

  const years = Math.floor(months / 12);
  const m = months % 12;

  const yStr =
    years > 0
      ? years === 1
        ? "1 год"
        : years < 5
        ? `${years} года`
        : `${years} лет`
      : "";

  const mStr =
    m > 0
      ? m === 1
        ? "1 месяц"
        : m < 5
        ? `${m} месяца`
        : `${m} месяцев`
      : "";

  return [yStr, mStr].filter(Boolean).join(" ");
}

function calculateExperience(experienceList) {
  let totalMonths = 0;

  for (const exp of experienceList) {
    if (!exp.start_date) continue;

    const months = diffInMonths(exp.start_date, exp.current ? null : exp.end_date);
    totalMonths += months;

    exp._durationMonths = months;
    exp._durationFormatted = formatExperience(months);
  }

  return {
    totalMonths,
    totalFormatted: formatExperience(totalMonths)
  };
}

/* -------------------------------------------------------
   EVENTS
------------------------------------------------------- */
function setupEvents() {
  document.addEventListener("click", e => {
    if (e.target.closest("#backToDashboard")) {
      window.location.href = "/dashboard.html";
    }

    if (e.target.closest("#editCvBtn")) {
      window.location.href = `/cv/cv-edit.html?id=${cvId}`;
    }
  });
}

/* -------------------------------------------------------
   INIT
------------------------------------------------------- */
async function init() {
  const params = new URLSearchParams(window.location.search);
  cvId = params.get("id");

  await loadCurrentUser();
  await loadCV(cvId);

  renderView();
  setupEvents();
}

init();
