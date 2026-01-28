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
   RENDER MINI PREVIEW
------------------------------------------------------- */
async function renderPreviewIntoCard(cv) {
  const container = document.getElementById(`preview-cv-${cv.id}`);
  if (!container) return;

  try {
    const state = await loadFullCVState(cv.id);
    const html = generateCVHTML(state);
    container.innerHTML = html;
  } catch (err) {
    console.error('Ошибка рендера мини-превью:', err);
  }
}

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
              <div class="cv-card-meta">
                ${new Date(cv.created_at).toLocaleDateString('ru-RU')} • ${cv.language?.toUpperCase() || 'RU'}
              </div>
            </div>

            <div class="cv-card-footer-actions">
              <button class="cv-card-action-btn cv-view-btn" title="Просмотреть">
                  <i class="fas fa-eye"></i>
              </button>
              <button class="cv-card-action-btn cv-edit-btn" title="Редактировать">
                  <i class="fas fa-pen"></i>
              </button>
              <button class="cv-card-action-btn cv-delete-btn" title="Удалить">
                  <i class="fas fa-trash"></i>
              </button>
            </div>
        </div>
    `;

    card.querySelector('.cv-view-btn').onclick = e => {
      e.stopPropagation();
      window.location.href = `/cv/cv-view.html?id=${cv.id}`;
    };

    card.querySelector('.cv-edit-btn').onclick = e => {
      e.stopPropagation();
      window.location.href = `/cv/cv-view.html?id=${cv.id}&edit=1`;
    };

    card.querySelector('.cv-delete-btn').onclick = e => {
      e.stopPropagation();
      openDeleteModal(cv.id);
    };

    card.onclick = () => {
      window.location.href = `/cv/cv-view.html?id=${cv.id}`;
    };

    listContainer.appendChild(card);
    renderPreviewIntoCard(cv);
  }

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
