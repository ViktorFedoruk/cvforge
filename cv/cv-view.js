import { supabase } from "../js/supabase.js";
import { generateCVHTML } from "../editor/generate-cv-html.js";

let cvId = null;
let cvData = null;
let editMode = false;

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

  // 🔥 Расчёт опыта
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
  const html = generateCVHTML(cvData);

  const topbar = `
    <div class="cv-topbar-left">
      <button id="backToDashboard" class="topbar-btn">
        <i class="fas fa-arrow-left"></i>
        Вернуться к дашборду
      </button>
    </div>

    <div class="cv-topbar-center">
      <h1 class="cv-title" data-edit="title">${cvData.cv.title}</h1>
    </div>

    <div class="cv-topbar-right">
      <button id="editCvBtn" class="topbar-btn primary">
        <i class="fas fa-edit"></i>
        Редактировать
      </button>
    </div>
  `;

  document.getElementById("cvTopbar").innerHTML = topbar;
  document.getElementById("cvContent").innerHTML = html;
}

/* -------------------------------------------------------
   ENABLE INLINE EDITING
------------------------------------------------------- */
function enableInlineEditing() {
  editMode = true;

  document.querySelectorAll(`
    [data-edit],
    [data-edit-adv],
    [data-edit-skill-name],
    [data-edit-skill-level],
    [data-edit-exp-position],
    [data-edit-exp-company],
    [data-edit-exp-start],
    [data-edit-exp-end],
    [data-edit-exp-description],
    [data-edit-edu-inst],
    [data-edit-edu-degree],
    [data-edit-edu-start],
    [data-edit-edu-end],
    [data-edit-edu-description]
  `).forEach(el => {
    el.setAttribute("contenteditable", "true");
    el.classList.add("editable");
  });

  const topbar = `
    <button id="backToDashboard" class="topbar-btn">
      <i class="fas fa-arrow-left"></i> Дашборд
    </button>

    <h1 class="cv-title" data-edit="title">${cvData.cv.title}</h1>

    <div class="edit-actions">
      <button id="cancelEditBtn" class="topbar-btn">Отмена</button>
      <button id="saveEditBtn" class="topbar-btn primary">Сохранить</button>
    </div>
  `;

  document.getElementById("cvTopbar").innerHTML = topbar;
}

/* -------------------------------------------------------
   SAVE INLINE CHANGES
------------------------------------------------------- */
async function saveInlineChanges() {
  try {
    const newTitle = getText("[data-edit='title']");

    await supabase
      .from("cv")
      .update({ title: newTitle })
      .eq("id", cvId);

    const updatedProfile = {
      full_name: getText("[data-edit='full_name']"),
      position: getText("[data-edit='position']"),
      summary: getText("[data-edit='summary']"),
      email: getText("[data-edit='email']"),
      phone: getText("[data-edit='phone']"),
      location: getText("[data-edit='location']")
    };

    await supabase
      .from("cv_profiles")
      .update(updatedProfile)
      .eq("cv_id", cvId);

    for (const adv of cvData.advantages) {
      const value = getText(`[data-edit-adv="${adv.id}"]`);
      await supabase.from("advantages").update({ tag: value }).eq("id", adv.id);
    }

    for (const skill of cvData.skills) {
      const name = getText(`[data-edit-skill-name="${skill.id}"]`);
      const level = normalizeSkillLevel(getText(`[data-edit-skill-level="${skill.id}"]`));
      await supabase.from("skills").update({ name, level }).eq("id", skill.id);
    }

    for (const exp of cvData.experience) {
      const position = getText(`[data-edit-exp-position="${exp.id}"]`);
      const company = getText(`[data-edit-exp-company="${exp.id}"]`);
      const start_date = parseDate(getText(`[data-edit-exp-start="${exp.id}"]`));
      const end_date = parseDate(getText(`[data-edit-exp-end="${exp.id}"]`));
      const description = getText(`[data-edit-exp-description="${exp.id}"]`);

      await supabase
        .from("experience")
        .update({ position, company, start_date, end_date, description })
        .eq("id", exp.id);
    }

    for (const ed of cvData.education) {
      const institution = getText(`[data-edit-edu-inst="${ed.id}"]`);
      const degree = getText(`[data-edit-edu-degree="${ed.id}"]`);
      const start_date = parseDate(getText(`[data-edit-edu-start="${ed.id}"]`));
      const end_date = parseDate(getText(`[data-edit-edu-end="${ed.id}"]`));
      const description = getText(`[data-edit-edu-description="${ed.id}"]`);

      await supabase
        .from("education")
        .update({ institution, degree, start_date, end_date, description })
        .eq("id", ed.id);
    }

    window.location.href = `/cv/cv-view.html?id=${cvId}`;

  } catch (err) {
    console.error("Ошибка сохранения:", err);
    alert("Ошибка сохранения. Проверь консоль.");
  }
}

/* -------------------------------------------------------
   HELPERS
------------------------------------------------------- */
function getText(selector) {
  const el = document.querySelector(selector);
  return el ? el.innerText.trim() : "";
}

function parseDate(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function normalizeSkillLevel(level) {
  const map = {
    "Эксперт": "expert",
    "Опытный": "used",
    "Знаком": "familiar"
  };
  return map[level] || null;
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
      enableInlineEditing();
    }

    if (e.target.closest("#cancelEditBtn")) {
      window.location.reload();
    }

    if (e.target.closest("#saveEditBtn")) {
      saveInlineChanges();
    }
  });
}

/* -------------------------------------------------------
   INIT
------------------------------------------------------- */
async function init() {
  const params = new URLSearchParams(window.location.search);
  cvId = params.get("id");

  await loadCV(cvId);
  renderView();
  setupEvents();
}

init();
