import { supabase } from './supabase.js';
import { generateCVHTML } from '/editor/generate-cv-html.js';

let currentUser = null;
let cvList = [];
let cvToDeleteId = null;

/* -------------------------------------------------------
   AUTH
------------------------------------------------------- */
async function requireAuth() {
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session) {
    window.location.href = '/auth/index.html';
    return null;
  }

  return data.session.user;
}

/* -------------------------------------------------------
   LOAD CV LIST
------------------------------------------------------- */
async function loadCVs(user) {
  const { data, error } = await supabase
    .from('cv')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Ошибка загрузки CV:', error);
    document.getElementById('error').textContent = error.message;
    return [];
  }

  return data || [];
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
   LOAD FULL CV STATE (FOR PREVIEW)
------------------------------------------------------- */
async function loadFullCVState(cvId) {
  const { data: cv } = await supabase
    .from('cv')
    .select('*')
    .eq('id', cvId)
    .single();

  const { data: cv_profile } = await supabase
    .from('cv_profiles')
    .select('*')
    .eq('cv_id', cvId)
    .single();

  const { data: experience } = await supabase
    .from('experience')
    .select('*')
    .eq('cv_id', cvId)
    .order('order_index', { ascending: true });

  const { data: skills } = await supabase
    .from('skills')
    .select('*')
    .eq('cv_id', cvId);

  const { data: advantages } = await supabase
    .from('advantages')
    .select('*')
    .eq('cv_id', cvId);

  const { data: education } = await supabase
    .from('education')
    .select('*')
    .eq('cv_id', cvId);

  const expStats = calculateExperience(experience || []);

  return {
    cv,
    cv_profile: cv_profile || {},
    experience: experience || [],
    skills: skills || [],
    advantages: advantages || [],
    education: education || [],
    expStats
  };
}

/* -------------------------------------------------------
   RENDER MINI PREVIEW — адаптивный скейл cv_root
------------------------------------------------------- */
async function renderPreviewIntoCard(cv) {
  const container = document.getElementById(`preview-cv-${cv.id}`);
  if (!container) return;

  try {
    const state = await loadFullCVState(cv.id);
    const html = generateCVHTML(state);
    container.innerHTML = html;

    requestAnimationFrame(() => applyPreviewScale(cv.id));

  } catch (err) {
    console.error("Ошибка рендера мини-превью:", err);
  }
}

/* -------------------------------------------------------
   APPLY SCALE — масштабирует cv_root под рамку
------------------------------------------------------- */
function applyPreviewScale(id) {
  const inner = document.getElementById(`preview-cv-${id}`);
  const frame = inner?.parentElement;
  if (!inner || !frame) return;

  const DOC_W = 1040;
  const DOC_H = 1;

  const availableW = frame.clientWidth;
  const availableH = frame.clientHeight;

  const scale = Math.min(availableW / DOC_W, availableH / DOC_H);

  inner.style.width = DOC_W + "px";
  inner.style.height = DOC_H + "px";
  inner.style.transform = `scale(${scale})`;
  inner.style.transformOrigin = "top left";
}

/* Пересчёт при ресайзе */
window.addEventListener("resize", () => {
  cvList.forEach(cv => applyPreviewScale(cv.id));
});

/* -------------------------------------------------------
   DELETE CV
------------------------------------------------------- */
async function deleteCVCascade(cvId) {
  try {
    await supabase.from('experience').delete().eq('cv_id', cvId);
    await supabase.from('skills').delete().eq('cv_id', cvId);
    await supabase.from('advantages').delete().eq('cv_id', cvId);
    await supabase.from('education').delete().eq('cv_id', cvId);
    await supabase.from('cv').delete().eq('id', cvId);

    await refreshCVList();
  } catch (err) {
    console.error('Ошибка удаления CV:', err);
    document.getElementById('error').textContent = 'Ошибка удаления резюме';
  }
}

/* -------------------------------------------------------
   CREATE NEW CV
------------------------------------------------------- */
function createCV() {
  window.location.href = `/cv/cv-create.html`;
}

/* -------------------------------------------------------
   SHARE — COPY LINK
------------------------------------------------------- */
function copyShareLink(cvId) {
  const link = `${window.location.origin}/cv/cv-view.html?id=${cvId}`;
  navigator.clipboard.writeText(link);
  showToast("Ссылка скопирована", "success");
}

/* -------------------------------------------------------
   TOASTS
------------------------------------------------------- */
function showToast(message, type = "success") {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/* -------------------------------------------------------
   RENDER CV LIST
------------------------------------------------------- */
async function renderCVList() {
  const listContainer = document.getElementById('cvList');
  const createBtn = document.getElementById('createCvBtn');
  listContainer.innerHTML = '';

  if (!cvList.length) {
    createBtn.textContent = 'Создать первое CV';

    const newCard = document.createElement('div');
    newCard.className = 'cv-card cv-card-new';
    newCard.onclick = createCV;

    newCard.innerHTML = `
      <div class="cv-card-new-inner">
        <i class="fas fa-plus" style="font-size:20px;"></i>
        <span>Создать новое CV</span>
      </div>
    `;

    listContainer.appendChild(newCard);
    return;
  }

  createBtn.textContent = 'Создать новое CV';

  for (const cv of cvList) {
    const card = document.createElement('div');
    card.className = 'cv-card';

    card.innerHTML = `
        <div class="cv-card-preview">
            <div class="cv-card-preview-frame">
                <div class="cv-card-preview-inner" id="preview-cv-${cv.id}"></div>
            </div>
        </div>

        <div class="cv-card-footer">
            <div class="cv-card-footer-main">
              <div class="cv-card-title">${cv.title || 'Без названия'}</div>

              <div class="cv-card-access">
                <label class="cv-public-toggle">
                  <input type="checkbox" class="public-toggle" data-cv-id="${cv.id}" ${cv.is_public ? "checked" : ""}>
                  <span>Публичное резюме</span>
                </label>
              </div>

              <div class="cv-card-meta">
                ${new Date(cv.created_at).toLocaleDateString('ru-RU')} • ${cv.language?.toUpperCase() || 'RU'}
              </div>
            </div>

            <div class="cv-card-footer-actions">
              <button class="share-btn" title="Поделиться" data-cv-id="${cv.id}" ${cv.is_public ? "" : "disabled"}>
                <i class="fas fa-share-alt"></i>
              </button>
              <button class="cv-card-action-btn cv-view-btn" title="Просмотреть">
                  <i class="fas fa-eye"></i>
              </button>
              <button class="cv-card-action-btn cv-card-edit-btn" title="Редактировать">
                  <i class="fas fa-pen"></i>
              </button>
              <button class="cv-card-action-btn cv-delete-btn" title="Удалить">
                  <i class="fas fa-trash"></i>
              </button>
            </div>
        </div>
    `;

    /* VIEW */
    card.querySelector('.cv-view-btn').onclick = e => {
      e.stopPropagation();
      window.location.href = `/cv/cv-view.html?id=${cv.id}`;
    };

    /* EDIT */
    card.querySelector('.cv-card-edit-btn').onclick = e => {
      e.stopPropagation();
      window.location.href = `/cv/cv-edit.html?id=${cv.id}`;
    };

    /* DELETE */
    card.querySelector('.cv-delete-btn').onclick = e => {
      e.stopPropagation();
      openDeleteModal(cv.id);
    };

    /* PUBLIC TOGGLE — блокируем всплытие */
    const toggle = card.querySelector('.public-toggle');
    toggle.addEventListener('mousedown', e => e.stopPropagation());
    toggle.addEventListener('click', e => e.stopPropagation());

    /* PUBLIC TOGGLE — логика */
    toggle.onchange = async (e) => {
      const isPublic = e.target.checked;
      const cvId = e.target.dataset.cvId;

      await supabase.from("cv")
        .update({ is_public: isPublic })
        .eq("id", cvId);

      const shareBtn = card.querySelector(".share-btn");
      shareBtn.disabled = !isPublic;

      showToast(
        isPublic ? "Резюме стало публичным" : "Публичный доступ отключён",
        "success"
      );
    };

    /* SHARE — мгновенное копирование */
    card.querySelector('.share-btn').onclick = (e) => {
      e.stopPropagation();
      const btn = e.currentTarget;
      if (btn.disabled) return;

      copyShareLink(cv.id);
    };

    /* CARD CLICK → VIEW */
    card.onclick = () => {
      window.location.href = `/cv/cv-view.html?id=${cv.id}`;
    };

    listContainer.appendChild(card);
    renderPreviewIntoCard(cv);
  }

  /* NEW CARD */
  const newCard = document.createElement('div');
  newCard.className = 'cv-card cv-card-new';
  newCard.onclick = createCV;

  newCard.innerHTML = `
    <div class="cv-card-new-inner">
      <i class="fas fa-plus" style="font-size:20px;"></i>
      <span>Создать новое CV</span>
    </div>
  `;

  listContainer.appendChild(newCard);
}

/* -------------------------------------------------------
   REFRESH LIST
------------------------------------------------------- */
async function refreshCVList() {
  cvList = await loadCVs(currentUser);
  await renderCVList();
}

/* -------------------------------------------------------
   DELETE MODAL
------------------------------------------------------- */
function openDeleteModal(cvId) {
  cvToDeleteId = cvId;
  document.getElementById('deleteModal').classList.remove('hidden');
}

function closeDeleteModal() {
  cvToDeleteId = null;
  document.getElementById('deleteModal').classList.add('hidden');
}

/* -------------------------------------------------------
   INIT
------------------------------------------------------- */
(async () => {
  currentUser = await requireAuth();
  if (!currentUser) return;

  document.getElementById('createCvBtn').onclick = createCV;

  document.getElementById('cancelDeleteBtn').onclick = closeDeleteModal;
  document.querySelector('#deleteModal .modal-backdrop').onclick = closeDeleteModal;

  document.getElementById('confirmDeleteBtn').onclick = async () => {
    if (cvToDeleteId) await deleteCVCascade(cvToDeleteId);
    closeDeleteModal();
  };

  await refreshCVList();
})();
