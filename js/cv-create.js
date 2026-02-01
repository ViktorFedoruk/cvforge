import { supabase } from "../js/supabase.js";

let currentStep = 1;
let createdCvId = null;
let currentUserId = null;

// Загружаем текущего пользователя
async function loadUser() {
  const { data: { user } } = await supabase.auth.getUser();
  currentUserId = user?.id;
}

await loadUser();

const wizardState = {
  profile: {
    title: "",
    full_name: "",
    position: "",
    location: "",
    email: "",
    phone: "",
    summary: ""
  },
  advantages: [],
  experience: [],
  skills: [],
  education: []
};

/* -------------------------------------------------------
   UI ELEMENTS
------------------------------------------------------- */

const statusEl = document.getElementById("wizardStatus");
const stepLabelEl = document.getElementById("wizardStepLabel");
const stepPercentEl = document.getElementById("wizardStepPercent");
const progressFillEl = document.getElementById("wizardProgressFill");

const prevBtn = document.getElementById("prevStepBtn");
const nextBtn = document.getElementById("nextStepBtn");
const finishBtn = document.getElementById("finishBtn");

/* -------------------------------------------------------
   STEP LABELS
------------------------------------------------------- */

const stepLabels = {
  1: "Шаг 1 из 4 — Профиль",
  2: "Шаг 2 из 4 — Опыт",
  3: "Шаг 3 из 4 — Навыки",
  4: "Шаг 4 из 4 — Образование",
  success: "Готово — резюме создано"
};

const stepPercents = {
  1: 0,
  2: 25,
  3: 50,
  4: 75,
  success: 100
};

/* -------------------------------------------------------
   HELPERS
------------------------------------------------------- */

function setStatus(msg, isError = false) {
  statusEl.textContent = msg || "";
  statusEl.classList.toggle("error", !!isError);
}

function updateProgressUI() {
  const key = currentStep === "success" ? "success" : currentStep;
  stepLabelEl.textContent = stepLabels[key];
  stepPercentEl.textContent = stepPercents[key] + "%";
  progressFillEl.style.width = stepPercents[key] + "%";

  document.querySelectorAll(".wizard-step").forEach((el) => {
    const step = Number(el.dataset.step);
    el.classList.remove("active", "completed");

    if (currentStep === "success") {
      el.classList.add("completed");
      return;
    }
    if (step < currentStep) el.classList.add("completed");
    if (step === currentStep) el.classList.add("active");
  });
}

function showStep(step) {
  // нормализуем step
  if (step === "success") {
    currentStep = "success";
  } else {
    currentStep = Number(step);
  }

  // скрываем все панели
  document.querySelectorAll(".wizard-panel")
    .forEach((el) => el.classList.remove("active"));

  // success экран
  if (step === "success") {
    document.getElementById("stepSuccess").classList.add("active");

    prevBtn.classList.add("hidden");
    nextBtn.classList.add("hidden");
    finishBtn.classList.add("hidden");

    updateProgressUI();
    return;
  }

  // обычные шаги
  const panel = document.getElementById(`step${currentStep}`);
  if (panel) panel.classList.add("active");

  prevBtn.classList.toggle("hidden", currentStep === 1);
  nextBtn.classList.toggle("hidden", currentStep === 4);
  finishBtn.classList.toggle("hidden", currentStep !== 4);

  prevBtn.disabled = currentStep === 1;
  nextBtn.disabled = false;
  finishBtn.disabled = false;

  updateProgressUI();
}

/* -------------------------------------------------------
   AUTO CAPITALIZE
------------------------------------------------------- */

function attachAutoCapitalize() {
  const inputs = document.querySelectorAll(
    'input:not([type="email"]):not([type="tel"]):not([type="date"]):not([type="url"]), textarea'
  );

  inputs.forEach((el) => {
    el.addEventListener("blur", () => {
      const v = el.value;
      if (!v) return;
      el.value = v.charAt(0).toUpperCase() + v.slice(1);
    });
  });
}

function capitalizeFirst(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/* -------------------------------------------------------
   GLOBAL CITY AUTOCOMPLETE — Local search + RU translit
------------------------------------------------------- */

let allCities = [];
let citiesLoaded = false;
let cityDropdown = null;
let activeCityInput = null;

/* -------------------------------------------------------
   RU → EN transliteration
------------------------------------------------------- */
function translit(str) {
  const map = {
    "а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ё":"yo","ж":"zh","з":"z",
    "и":"i","й":"y","к":"k","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r",
    "с":"s","т":"t","у":"u","ф":"f","х":"h","ц":"ts","ч":"ch","ш":"sh","щ":"sch",
    "ы":"y","э":"e","ю":"yu","я":"ya"
  };
  return str
    .toLowerCase()
    .split("")
    .map(ch => map[ch] || ch)
    .join("");
}

/* -------------------------------------------------------
   LOAD CITIES (one-time)
------------------------------------------------------- */
async function loadCities() {
  if (citiesLoaded) return;

  try {
    const res = await fetch("https://countriesnow.space/api/v0.1/countries");
    const json = await res.json();

    if (!json.data) return;

    json.data.forEach(country => {
      country.cities.forEach(city => {
        allCities.push({
          city,
          country: country.country
        });
      });
    });

    citiesLoaded = true;
  } catch (e) {
    console.error("City load error:", e);
  }
}

/* -------------------------------------------------------
   SEARCH CITIES (local strict prefix match + RU translit)
------------------------------------------------------- */
async function searchCities(query, inputEl) {
  const q = query.trim();
  if (!q) return hideCityDropdown();

  await loadCities();

  const qLatin = /[а-я]/i.test(q) ? translit(q) : q;
  const lower = qLatin.toLowerCase();

  const matches = Array.from(
    new Set(
      allCities
        .filter(c => c.city.toLowerCase().startsWith(lower))
        .map(c => `${c.city}, ${c.country}`)
    )
  )
    .sort()
    .slice(0, 10);

  if (!matches.length) return hideCityDropdown();

  showCityDropdown(matches, inputEl);
}

/* -------------------------------------------------------
   SHOW DROPDOWN (attached to specific input)
------------------------------------------------------- */
function showCityDropdown(cities, inputEl) {
  hideCityDropdown();
  activeCityInput = inputEl;

  cityDropdown = document.createElement("div");
  cityDropdown.className = "city-dropdown";

  cities.forEach(city => {
    const item = document.createElement("div");
    item.className = "city-dropdown-item";
    item.textContent = city;

    item.onclick = () => {
      activeCityInput.value = city;

      // ВАЖНО: обновляем state
      activeCityInput.dispatchEvent(new Event("input"));
      activeCityInput.dispatchEvent(new Event("change"));

      hideCityDropdown();
    };

    cityDropdown.appendChild(item);
  });

  const wrapper = inputEl.closest(".city-input-wrapper");
  const container = wrapper.querySelector(".city-dropdown-container");

  container.appendChild(cityDropdown);
}

/* -------------------------------------------------------
   HIDE DROPDOWN
------------------------------------------------------- */
function hideCityDropdown() {
  if (cityDropdown) cityDropdown.remove();
  cityDropdown = null;
  activeCityInput = null;
}

/* -------------------------------------------------------
   ATTACH AUTOCOMPLETE TO ANY INPUT
------------------------------------------------------- */
function attachCityAutocomplete(inputEl) {
  let timeout = null;

  inputEl.addEventListener("input", () => {
    const query = inputEl.value.trim();
    if (!query) return hideCityDropdown();

    clearTimeout(timeout);
    timeout = setTimeout(() => searchCities(query, inputEl), 200);
  });

  inputEl.addEventListener("blur", () => {
    setTimeout(() => hideCityDropdown(), 150);
  });
}

/* -------------------------------------------------------
   UNIVERSITY AUTOCOMPLETE — stable local search + abbreviations
------------------------------------------------------- */

let allUniversities = [];
let universitiesLoaded = false;

let universityDropdown = null;
let activeUniversityInput = null;

/* Популярные аббревиатуры СНГ */
const UNI_ABBR = {
  "мгу": "moscow state university",
  "спбгу": "saint petersburg state university",
  "бгу": "belarusian state university",
  "бгпу": "belarusian state pedagogical university",
  "кфу": "kazan federal university",
  "нгу": "novosibirsk state university",
  "мфти": "moscow institute of physics and technology",
  "вшэ": "higher school of economics",
  "hse": "higher school of economics",
  "msu": "moscow state university",
  "spbu": "saint petersburg state university"
};

/* RU → EN transliteration */
function translitUni(str) {
  const map = {
    "а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ё":"yo","ж":"zh","з":"z",
    "и":"i","й":"y","к":"k","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r",
    "с":"s","т":"t","у":"u","ф":"f","х":"h","ц":"ts","ч":"ch","ш":"sh","щ":"sch",
    "ы":"y","э":"e","ю":"yu","я":"ya"
  };
  return str.toLowerCase().split("").map(ch => map[ch] || ch).join("");
}

/* -------------------------------------------------------
   LOAD UNIVERSITIES (one-time, stable source)
------------------------------------------------------- */
async function loadUniversities() {
  if (universitiesLoaded) return;

  try {
    const res = await fetch(
      "https://raw.githubusercontent.com/Hipo/university-domains-list/master/world_universities_and_domains.json"
    );
    const data = await res.json();

    allUniversities = data.map(u => ({
      name: u.name,
      country: u.country,
      full: `${u.name}, ${u.country}`
    }));

    universitiesLoaded = true;
  } catch (e) {
    console.error("University load error:", e);
  }
}

/* -------------------------------------------------------
   LOCAL SEARCH (fast, stable)
------------------------------------------------------- */
async function searchUniversities(query) {
  let q = query.trim().toLowerCase();
  if (!q) return [];

  await loadUniversities();

  // Аббревиатуры
  if (UNI_ABBR[q]) q = UNI_ABBR[q];

  // Транслит
  if (/[а-я]/i.test(q)) q = translitUni(q);

  return allUniversities
    .filter(u => u.name.toLowerCase().includes(q))
    .slice(0, 20)
    .map(u => u.full);
}

/* -------------------------------------------------------
   SHOW DROPDOWN
------------------------------------------------------- */
function showUniversityDropdown(list, inputEl) {
  hideUniversityDropdown();
  activeUniversityInput = inputEl;

  universityDropdown = document.createElement("div");
  universityDropdown.className = "university-dropdown";

  list.forEach(item => {
    const el = document.createElement("div");
    el.className = "university-dropdown-item";
    el.textContent = item;

    el.onclick = () => {
      activeUniversityInput.value = item;

      // ВАЖНО: обновляем state
      activeUniversityInput.dispatchEvent(new Event("input"));
      activeUniversityInput.dispatchEvent(new Event("change"));

      hideUniversityDropdown();
    };

    universityDropdown.appendChild(el);
  });

  const wrapper = inputEl.closest(".university-input-wrapper");
  wrapper.appendChild(universityDropdown);
}

function hideUniversityDropdown() {
  if (universityDropdown) universityDropdown.remove();
  universityDropdown = null;
}

/* -------------------------------------------------------
   ATTACH AUTOCOMPLETE
------------------------------------------------------- */
function attachUniversityAutocomplete(inputEl) {
  if (!inputEl) return;

  let timeout = null;

  inputEl.addEventListener("input", () => {
    const query = inputEl.value.trim();
    if (!query) return hideUniversityDropdown();

    clearTimeout(timeout);
    timeout = setTimeout(async () => {
      const results = await searchUniversities(query);
      if (results.length) showUniversityDropdown(results, inputEl);
      else hideUniversityDropdown();
    }, 200);
  });

  inputEl.addEventListener("blur", () => {
    setTimeout(() => hideUniversityDropdown(), 150);
  });
}

/* =========================================================
   GLASS DATEPICKER — CORE LOGIC (dropdown версия)
========================================================= */

const dp = document.getElementById("glassDatepicker");
let dpTargetInput = null;
let dpDate = new Date();

const monthsRU = [
  "Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"
];

const weekdaysRU = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

/* --------------------------------------------------------
   DROPDOWN HELPERS
-------------------------------------------------------- */
function openMenu(menu) {
  document.querySelectorAll(".gdp-menu").forEach(m => {
    if (m !== menu) m.classList.add("hidden");
  });
  menu.classList.toggle("hidden");
}

function closeAllMenus() {
  document.querySelectorAll(".gdp-menu").forEach(m => m.classList.add("hidden"));
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".gdp-dropdown")) closeAllMenus();
});

/* --------------------------------------------------------
   РЕНДЕР КАЛЕНДАРЯ
-------------------------------------------------------- */
function renderGlassDatepicker() {
  const daysEl = dp.querySelector(".gdp-days");
  const weekdaysEl = dp.querySelector(".gdp-weekdays");

  const monthBtn = dp.querySelector(".gdp-month-btn");
  const yearBtn = dp.querySelector(".gdp-year-btn");

  const monthMenu = dp.querySelector(".gdp-month-menu");
  const yearMenu = dp.querySelector(".gdp-year-menu");

  /* --- Дни недели --- */
  weekdaysEl.innerHTML = weekdaysRU.map(d => `<div>${d}</div>`).join("");

  /* --- Обновляем кнопки --- */
  monthBtn.textContent = monthsRU[dpDate.getMonth()];
  yearBtn.textContent = dpDate.getFullYear();

  /* --- Меню месяцев --- */
  monthMenu.innerHTML = monthsRU
    .map((m, i) => `
      <div class="gdp-menu-item ${i === dpDate.getMonth() ? "active" : ""}" data-month="${i}">
        ${m}
      </div>
    `)
    .join("");

  /* --- Меню годов --- */
  const currentYear = new Date().getFullYear();
  let yearsHTML = "";
  for (let y = currentYear - 50; y <= currentYear + 50; y++) {
    yearsHTML += `
      <div class="gdp-menu-item ${y === dpDate.getFullYear() ? "active" : ""}" data-year="${y}">
        ${y}
      </div>`;
  }
  yearMenu.innerHTML = yearsHTML;

  /* --- Обработчики меню --- */
  monthMenu.querySelectorAll(".gdp-menu-item").forEach(item => {
    item.onclick = () => {
      dpDate.setMonth(Number(item.dataset.month));
      closeAllMenus();
      renderGlassDatepicker();
    };
  });

  yearMenu.querySelectorAll(".gdp-menu-item").forEach(item => {
    item.onclick = () => {
      dpDate.setFullYear(Number(item.dataset.year));
      closeAllMenus();
      renderGlassDatepicker();
    };
  });

  monthBtn.onclick = () => openMenu(monthMenu);
  yearBtn.onclick = () => openMenu(yearMenu);

  /* --- Рендер дней месяца --- */
  const firstDay = new Date(dpDate.getFullYear(), dpDate.getMonth(), 1);
  const lastDay = new Date(dpDate.getFullYear(), dpDate.getMonth() + 1, 0);

  const startOffset = (firstDay.getDay() + 6) % 7;

  let html = "";

  for (let i = 0; i < startOffset; i++) html += `<div></div>`;

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const yyyy = dpDate.getFullYear();
    const mm = String(dpDate.getMonth() + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");

    const iso = `${yyyy}-${mm}-${dd}`;
    const ru = `${dd}.${mm}.${yyyy}`;

    html += `
      <div class="gdp-day" data-iso="${iso}" data-ru="${ru}">
        ${d}
      </div>
    `;
  }

  daysEl.innerHTML = html;

  /* --- Клик по дню --- */
  daysEl.querySelectorAll(".gdp-day").forEach(day => {
    day.onclick = () => {
      if (dpTargetInput.disabled) return;

      const iso = day.dataset.iso;
      const ru = day.dataset.ru;

      // Вставляем СНГ-формат в поле
      dpTargetInput.value = ru;

      // В state сохраняем ISO
      if (dpTargetInput._onSelect) {
        dpTargetInput._onSelect(iso);
      }

      dp.classList.add("hidden");
    };
  });
}

/* --------------------------------------------------------
   ПЕРЕКЛЮЧЕНИЕ МЕСЯЦЕВ
-------------------------------------------------------- */
dp.querySelector(".gdp-prev").onclick = () => {
  dpDate.setMonth(dpDate.getMonth() - 1);
  renderGlassDatepicker();
};

dp.querySelector(".gdp-next").onclick = () => {
  dpDate.setMonth(dpDate.getMonth() + 1);
  renderGlassDatepicker();
};

/* --------------------------------------------------------
   ATTACH FUNCTION — СНГ формат ДД.ММ.ГГГГ
-------------------------------------------------------- */
function attachGlassDatepicker(input, onSelect) {
  input.type = "text";
  input.placeholder = "ДД.ММ.ГГГГ";
  input._onSelect = onSelect;

  /* --- Маска ДД.ММ.ГГГГ --- */
  input.addEventListener("input", () => {
    let v = input.value.replace(/[^\d]/g, "");

    if (v.length >= 3) v = v.slice(0, 2) + "." + v.slice(2);
    if (v.length >= 6) v = v.slice(0, 5) + "." + v.slice(5);

    input.value = v.slice(0, 10);

    if (/^\d{2}\.\d{2}\.\d{4}$/.test(input.value)) {
      const [dd, mm, yyyy] = input.value.split(".");
      const iso = `${yyyy}-${mm}-${dd}`;

      const d = new Date(iso);
      if (!isNaN(d)) {
        dpDate = d;
        if (input._onSelect) input._onSelect(iso);
      }
    }
  });

  /* --- Открытие календаря --- */
  input.addEventListener("click", () => {
    if (input.disabled) return;

    dpTargetInput = input;

    const rect = input.getBoundingClientRect();
    dp.style.top = rect.bottom + window.scrollY + 8 + "px";
    dp.style.left = rect.left + window.scrollX + "px";

    dp.classList.remove("hidden");
    renderGlassDatepicker();
  });
}

// ============================================================
// STEP 1 — PROFILE, CONTACTS, AVATAR, ADVANTAGES
// ============================================================

/* -------------------------------------------------------
   ИНИЦИАЛИЗАЦИЯ wizardState.profile
------------------------------------------------------- */
if (!wizardState.profile) {
  wizardState.profile = {
    title: "",
    full_name: "",
    position: "",
    location: "",
    email: "",
    phone: "",
    linkedin: "",
    summary: "",
    avatar_url: null
  };
}

if (!wizardState.advantages) wizardState.advantages = [];

/* -------------------------------------------------------
   INPUT ELEMENTS
------------------------------------------------------- */
const cvTitleInput = document.getElementById("cvTitle");
const fullNameInput = document.getElementById("profileFullName");
const positionInput = document.getElementById("profilePosition");

const locationInput = document.getElementById("profileLocation");
attachCityAutocomplete(locationInput);

const emailInput = document.getElementById("profileEmail");
const phoneInput = document.getElementById("profilePhone");
const linkedinInput = document.getElementById("profileLinkedin");
const summaryInput = document.getElementById("profileSummary");

// Extra contacts
const addExtraContactBtn = document.getElementById("addExtraContactBtn");
const extraContactDropdown = document.getElementById("extraContactDropdown");
const extraContactsList = document.getElementById("extraContactsList");

/* -------------------------------------------------------
   СИНХРОНИЗАЦИЯ ПОЛЕЙ С wizardState.profile
------------------------------------------------------- */
cvTitleInput.addEventListener("input", () => {
  wizardState.profile.title = cvTitleInput.value.trim();
});

fullNameInput.addEventListener("input", () => {
  wizardState.profile.full_name = fullNameInput.value.trim();
});

positionInput.addEventListener("input", () => {
  wizardState.profile.position = positionInput.value.trim();
});

locationInput.addEventListener("input", () => {
  wizardState.profile.location = locationInput.value.trim();
});

emailInput.addEventListener("input", () => {
  wizardState.profile.email = emailInput.value.trim();
});

if (phoneInput) {
  phoneInput.addEventListener("input", () => {
    phoneInput.value = phoneInput.value.replace(/[^0-9+\-\s()]/g, "");
    wizardState.profile.phone = phoneInput.value.trim();
  });
}

linkedinInput.addEventListener("input", () => {
  wizardState.profile.linkedin = linkedinInput.value.trim();
});

summaryInput.addEventListener("input", () => {
  wizardState.profile.summary = summaryInput.value.trim();
});

/* -------------------------------------------------------
   JOB TITLES AUTOCOMPLETE
------------------------------------------------------- */
let JOB_TITLES = [];

async function loadJobTitles() {
  const { data, error } = await supabase
    .from("job_titles")
    .select("*")
    .order("weight", { ascending: false });

  if (!error && data) JOB_TITLES = data;
}

loadJobTitles();

function searchJobTitles(query) {
  query = query.toLowerCase();

  return JOB_TITLES.filter(item => {
    const ru = item.ru.toLowerCase();
    const en = item.en.toLowerCase();
    const syns = (item.synonyms || []).map(s => s.toLowerCase());

    return (
      ru.includes(query) ||
      en.includes(query) ||
      syns.some(s => s.includes(query))
    );
  }).slice(0, 8);
}

const positionSuggestions = document.getElementById("positionSuggestions");

function renderPositionSuggestions(list) {
  if (!list.length) {
    positionSuggestions.style.display = "none";
    return;
  }

  positionSuggestions.innerHTML = "";
  positionSuggestions.style.display = "block";

  list.forEach(item => {
    const div = document.createElement("div");
    div.className = "position-suggestion";
    div.textContent = `${item.ru} / ${item.en}`;

    div.onclick = () => {
      positionInput.value = item.ru;
      wizardState.profile.position = item.ru;
      positionSuggestions.style.display = "none";
    };

    positionSuggestions.appendChild(div);
  });
}

positionInput.addEventListener("input", () => {
  const q = positionInput.value.trim();
  wizardState.profile.position = q;

  if (!q) {
    positionSuggestions.innerHTML = "";
    return;
  }

  const results = searchJobTitles(q);
  renderPositionSuggestions(results);
});

positionInput.addEventListener("blur", () => {
  setTimeout(() => {
    positionSuggestions.style.display = "none";
  }, 150);
});

/* -------------------------------------------------------
   AVATAR UPLOAD + MODAL CROPPER
------------------------------------------------------- */

// Кнопки
const uploadBtn = document.getElementById("avatar_upload_btn");
const avatarChangeBtn = document.getElementById("avatar_change_btn");
const avatarDeleteBtn = document.getElementById("avatar_delete_btn");

// Инпут и превью
const avatarFileInput = document.getElementById("avatar_file");
const avatarErrorEl = document.getElementById("avatar_error");

// Переключение кнопок в зависимости от наличия аватара
function updateAvatarButtons(hasAvatar) {
  const uploadBtn = document.getElementById("avatar_upload_btn");
  const changeBtn = document.getElementById("avatar_change_btn");
  const deleteBtn = document.getElementById("avatar_delete_btn");

  if (hasAvatar) {
    uploadBtn.classList.add("hidden");
    changeBtn.classList.remove("hidden");
    deleteBtn.classList.remove("hidden");
  } else {
    uploadBtn.classList.remove("hidden");
    changeBtn.classList.add("hidden");
    deleteBtn.classList.add("hidden");
  }
}

// Сброс аватара
function resetAvatarToPlaceholder() {
  const preview = document.getElementById("avatar_preview");
  preview.innerHTML = `<i class="fa-solid fa-user"></i>`;
  preview.classList.remove("has-image");

  if (!wizardState.profile) wizardState.profile = {};
  wizardState.profile.avatar_url = null;

  updateAvatarButtons(false);
}

/* -------------------------------------------------------
   КНОПКИ
------------------------------------------------------- */

uploadBtn.onclick = () => avatarFileInput.click();
avatarChangeBtn.onclick = () => avatarFileInput.click();

avatarDeleteBtn.onclick = () => {
  resetAvatarToPlaceholder();
  if (avatarFileInput) avatarFileInput.value = "";
  if (avatarErrorEl) avatarErrorEl.textContent = "";
};

/* -------------------------------------------------------
   ВАЛИДАЦИЯ И ОТКРЫТИЕ МОДАЛКИ
------------------------------------------------------- */

avatarFileInput.onchange = async () => {
  const file = avatarFileInput.files[0];
  if (!file) return;

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  const maxSize = 5 * 1024 * 1024;

  if (!allowedTypes.includes(file.type)) {
    avatarErrorEl.textContent = "Можно загружать только JPG, PNG или WEBP.";
    avatarFileInput.value = "";
    return;
  }

  if (file.size > maxSize) {
    avatarErrorEl.textContent = "Размер файла не должен превышать 5MB.";
    avatarFileInput.value = "";
    return;
  }

  avatarErrorEl.textContent = "";
  openAvatarCropperModal(file);
};

/* -------------------------------------------------------
   МОДАЛКА КРОППЕРА
------------------------------------------------------- */

function openAvatarCropperModal(file) {
  const modal = document.getElementById("avatarCropModal");
  const cropArea = document.getElementById("avatarCropArea");
  const zoomInput = document.getElementById("avatarZoom");
  const cancelBtn = document.getElementById("avatarCancel");
  const applyBtn = document.getElementById("avatarApply");

  if (!modal || !cropArea || !zoomInput || !cancelBtn || !applyBtn) return;

  modal.style.display = "flex";
  cropArea.innerHTML = "";

  // Overlay круга
  const overlay = document.createElement("div");
  overlay.className = "avatar-crop-overlay";
  cropArea.appendChild(overlay);

  // Очистка старого objectURL
  if (window.avatarObjectUrl) {
    URL.revokeObjectURL(window.avatarObjectUrl);
  }

  const objectUrl = URL.createObjectURL(file);
  window.avatarObjectUrl = objectUrl;

  // Изображение
  const img = document.createElement("img");
  img.src = objectUrl;
  img.style.position = "absolute";
  img.style.top = "0";
  img.style.left = "0";
  img.style.transformOrigin = "top left";
  cropArea.appendChild(img);

  let zoom = 1;
  let imgX = 0;
  let imgY = 0;
  let isDragging = false;
  let lastX = 0;
  let lastY = 0;

  img.onload = () => {
    const areaRect = cropArea.getBoundingClientRect();

    const scale = Math.min(
      areaRect.width / img.naturalWidth,
      areaRect.height / img.naturalHeight
    );

    zoom = scale;
    zoomInput.value = zoom.toFixed(2);

    imgX = (areaRect.width - img.naturalWidth * zoom) / 2;
    imgY = (areaRect.height - img.naturalHeight * zoom) / 2;

    updateTransform();
  };

  function updateTransform() {
    img.style.transform = `translate(${imgX}px, ${imgY}px) scale(${zoom})`;
  }

  /* ---------------- ЗУМ КОЛЕСОМ ---------------- */
  cropArea.onwheel = e => {
    e.preventDefault();

    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    const newZoom = Math.min(Math.max(zoom + delta, 0.2), 5);

    const rect = cropArea.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    const imgPointX = (cx - imgX) / zoom;
    const imgPointY = (cy - imgY) / zoom;

    zoom = newZoom;
    zoomInput.value = zoom.toFixed(2);

    imgX = cx - imgPointX * zoom;
    imgY = cy - imgPointY * zoom;

    updateTransform();
  };

  /* ---------------- ЗУМ ПОЛЗУНКОМ ---------------- */
  zoomInput.oninput = () => {
    const newZoom = parseFloat(zoomInput.value);

    const rect = cropArea.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    const imgPointX = (cx - imgX) / zoom;
    const imgPointY = (cy - imgY) / zoom;

    zoom = newZoom;

    imgX = cx - imgPointX * zoom;
    imgY = cy - imgPointY * zoom;

    updateTransform();
  };

  /* ---------------- ПЕРЕМЕЩЕНИЕ ---------------- */
  cropArea.onmousedown = e => {
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    img.style.cursor = "grabbing";
  };

  document.onmouseup = () => {
    isDragging = false;
    img.style.cursor = "grab";
  };

  document.onmousemove = e => {
    if (!isDragging) return;

    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;

    imgX += dx;
    imgY += dy;

    lastX = e.clientX;
    lastY = e.clientY;

    updateTransform();
  };

  /* ---------------- ОТМЕНА ---------------- */
  cancelBtn.onclick = () => {
    modal.style.display = "none";
    if (window.avatarObjectUrl) {
      URL.revokeObjectURL(window.avatarObjectUrl);
      window.avatarObjectUrl = null;
    }
    avatarFileInput.value = "";
  };

  /* ---------------- СОХРАНЕНИЕ ---------------- */
  applyBtn.onclick = async () => {
    const canvas = document.createElement("canvas");
    const size = 240;
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");

    const areaRect = cropArea.getBoundingClientRect();
    const circleCenterX = areaRect.width / 2;
    const circleCenterY = areaRect.height / 2;

    const srcX = (circleCenterX - imgX - size / 2) / zoom;
    const srcY = (circleCenterY - imgY - size / 2) / zoom;

    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    ctx.drawImage(
      img,
      srcX,
      srcY,
      size / zoom,
      size / zoom,
      0,
      0,
      size,
      size
    );

    const blob = await new Promise(resolve =>
      canvas.toBlob(resolve, "image/png")
    );

    if (window.avatarObjectUrl) {
      URL.revokeObjectURL(window.avatarObjectUrl);
      window.avatarObjectUrl = null;
    }

    avatarFileInput.value = "";
    modal.style.display = "none";

    await saveCroppedAvatar(blob);
  };
}

/* -------------------------------------------------------
   СОХРАНЕНИЕ АВАТАРА В SUPABASE
------------------------------------------------------- */

async function saveCroppedAvatar(blob) {
  const fileName = `avatar_${Date.now()}.png`;

  const { error } = await supabase.storage
    .from("avatars")
    .upload(fileName, blob, { upsert: true });

  if (!error) {
    const publicUrl = supabase.storage
      .from("avatars")
      .getPublicUrl(fileName).data.publicUrl;

    wizardState.profile.avatar_url = publicUrl;

    const preview = document.getElementById("avatar_preview");
    preview.innerHTML = `<img src="${publicUrl}" alt="avatar">`;
    preview.classList.add("has-image");

    updateAvatarButtons(true);
  } else {
    resetAvatarToPlaceholder();
  }

  const modal = document.getElementById("avatarCropModal");
  if (modal) modal.style.display = "none";
}

/* -------------------------------------------------------
   ADVANTAGES
------------------------------------------------------- */
const advantagesListEl = document.getElementById("advantagesList");
const advantageInput = document.getElementById("advantageInput");
const addAdvantageBtn = document.getElementById("addAdvantageBtn");
const advantagesSuggestionsEl = document.getElementById("advantagesSuggestions");

const ADV_SUGGESTIONS = [
  "Внимательность к деталям",
  "Ответственность",
  "Самоорганизация",
  "Коммуникабельность",
  "Инициативность",
  "Аналитическое мышление"
];

function renderAdvantages() {
  advantagesListEl.innerHTML = "";

  wizardState.advantages.forEach((tag, index) => {
    const pill = document.createElement("div");
    pill.className = "tag-pill";
    pill.innerHTML = `
      <span>${tag}</span>
      <button type="button" data-index="${index}">✕</button>
    `;
    pill.querySelector("button").onclick = () => {
      wizardState.advantages.splice(index, 1);
      renderAdvantages();
      renderAdvSuggestions();
    };
    advantagesListEl.appendChild(pill);
  });
}

function renderAdvSuggestions() {
  advantagesSuggestionsEl.innerHTML = "";

  ADV_SUGGESTIONS.forEach(s => {
    if (wizardState.advantages.includes(s)) return;

    const pill = document.createElement("div");
    pill.className = "suggestion-pill";
    pill.textContent = s;

    pill.onclick = () => {
      wizardState.advantages.push(s);
      renderAdvantages();
      renderAdvSuggestions();
    };

    advantagesSuggestionsEl.appendChild(pill);
  });
}

addAdvantageBtn.onclick = () => {
  const value = advantageInput.value.trim();
  if (!value) return;

  if (!wizardState.advantages.includes(value)) {
    wizardState.advantages.push(value);
    renderAdvantages();
    renderAdvSuggestions();
  }

  advantageInput.value = "";
};

advantageInput.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    e.preventDefault();
    addAdvantageBtn.click();
  }
});

/* -------------------------------------------------------
    EXTRA CONTACTS
------------------------------------------------------- */
const CONTACT_LABELS = {
  telegram: "Telegram",
  github: "GitHub",
  website: "Website",
  twitter: "Twitter / X",
  instagram: "Instagram",
  facebook: "Facebook",
  behance: "Behance",
  dribbble: "Dribbble"
};

addExtraContactBtn.onclick = () => {
  extraContactDropdown.classList.toggle("hidden");
};

extraContactDropdown.querySelectorAll("div").forEach(item => {
  item.onclick = () => {
    const type = item.dataset.type;
    addExtraContactField(type);
    extraContactDropdown.classList.add("hidden");
  };
});

function addExtraContactField(type) {
  const id = `extra_${type}`;
  if (document.getElementById(id)) return;

  const wrapper = document.createElement("div");
  wrapper.className = "form-field extra-contact-field";
  wrapper.id = id;

  wrapper.innerHTML = `
    <label>${CONTACT_LABELS[type]}</label>
    <input type="text" data-contact="${type}" placeholder="Введите ${CONTACT_LABELS[type]}">
    <div class="error-msg"></div>
  `;

  const buttonBlock = document.querySelector(".extra-contacts-toggle");
  extraContactsList.parentNode.insertBefore(wrapper, buttonBlock);

  const input = wrapper.querySelector("input");
  input.addEventListener("input", () => {
    wizardState.profile[type] = input.value.trim();
  });
}

/* -------------------------------------------------------
   VALIDATION HELPERS
------------------------------------------------------- */
function showFieldError(input, msg) {
  if (!input) return;

  const errorEl = input.parentElement.querySelector(".error-msg");
  if (errorEl) {
    errorEl.textContent = msg;
    errorEl.style.display = "block";
  }

  input.classList.add("input-error");
}

function clearFieldError(input) {
  if (!input) return;

  const errorEl = input.parentElement.querySelector(".error-msg");
  if (errorEl) {
    errorEl.textContent = "";
    errorEl.style.display = "none";
  }

  input.classList.remove("input-error");
}

function validateProfileStep() {
  let valid = true;

  function req(input, msg) {
    clearFieldError(input);
    if (!input || !input.value.trim()) {
      showFieldError(input, msg);
      valid = false;
    }
  }

  req(cvTitleInput, "Введите название резюме");
  req(fullNameInput, "Введите имя и фамилию");
  req(positionInput, "Введите желаемую должность");

  clearFieldError(emailInput);
  if (
    emailInput &&
    emailInput.value.trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value)
  ) {
    showFieldError(emailInput, "Некорректный email");
    valid = false;
  }

  clearFieldError(phoneInput);
  if (
    phoneInput &&
    phoneInput.value.trim() &&
    phoneInput.value.replace(/\D/g, "").length < 8
  ) {
    showFieldError(phoneInput, "Некорректный номер телефона");
    valid = false;
  }

  return valid;
}

const fieldsToWatch = [
  cvTitleInput,
  fullNameInput,
  positionInput,
  emailInput,
  phoneInput
];

fieldsToWatch.forEach(field => {
  if (!field) return;
  field.addEventListener("input", () => clearFieldError(field));
});

/* -------------------------------------------------------
   ПЕРВИЧНЫЙ РЕНДЕР ADVANTAGES
------------------------------------------------------- */
renderAdvantages();
renderAdvSuggestions();

/* -------------------------------------------------------
   SAVE PROFILE STATE (для init и на будущее)
------------------------------------------------------- */
function saveProfileToState() {
  if (!wizardState.profile) {
    wizardState.profile = {
      title: "",
      full_name: "",
      position: "",
      location: "",
      email: "",
      phone: "",
      linkedin: "",
      summary: "",
      avatar_url: wizardState.profile?.avatar_url || null
    };
  }

  wizardState.profile.title = cvTitleInput?.value.trim() || "";
  wizardState.profile.full_name = fullNameInput?.value.trim() || "";
  wizardState.profile.position = positionInput?.value.trim() || "";
  wizardState.profile.location = locationInput?.value.trim() || "";
  wizardState.profile.email = emailInput?.value.trim() || "";
  wizardState.profile.phone = phoneInput?.value.trim() || "";
  wizardState.profile.linkedin = linkedinInput?.value.trim() || "";
  wizardState.profile.summary = summaryInput?.value.trim() || "";

  const extraInputs = document.querySelectorAll("[data-contact]");
  extraInputs.forEach(input => {
    const key = input.dataset.contact;
    wizardState.profile[key] = input.value.trim();
  });
}

/* -------------------------------------------------------
   STEP 2 — EXPERIENCE (с кастомным календарём)
------------------------------------------------------- */

const experienceListEl = document.getElementById("experienceList");
const experienceTemplate = document.getElementById("experienceTemplate");
const addExperienceBtn = document.getElementById("addExperienceBtn");

/* -------------------------------------------------------
   Добавление карточки опыта
------------------------------------------------------- */
function addExperienceCard(data = {}) {
  const clone = experienceTemplate.content.cloneNode(true);
  const card = clone.querySelector(".card");
  const titleEl = card.querySelector(".card-title");
  const deleteBtn = card.querySelector(".card-delete-btn");

  // Создаём объект в state
  wizardState.experience.push({
    company: data.company || "",
    position: data.position || "",
    city: data.city || "",
    start_date: data.start_date || "",
    end_date: data.end_date || "",
    description: data.description || "",
    current: !!data.current
  });

  const index = wizardState.experience.length - 1;
  card.dataset.index = index;

  titleEl.textContent = data.company || "Новое место работы";

  /* -------------------------------------------------------
     Привязка полей
  ------------------------------------------------------- */
const fields = card.querySelectorAll("[data-field]");

fields.forEach((field) => {
  const key = field.dataset.field;

  // Чекбокс "Работаю здесь"
  if (field.type === "checkbox") {
    field.checked = !!data[key];

    field.onchange = () => {
      const idx = Number(card.dataset.index);
      wizardState.experience[idx][key] = field.checked;

      const endDateInput = card.querySelector('input[data-field="end_date"]');

      if (field.checked) {
        endDateInput.value = "";
        endDateInput.disabled = true;
        wizardState.experience[idx].end_date = "";
        clearFieldError(endDateInput);
      } else {
        endDateInput.disabled = false;
      }
    };

    return;
  }

  // ДАТЫ (кастомный календарь)
  if (field.type === "date") {
    field.type = "text";
    field.placeholder = "ДД.ММ.ГГГГ";

    // если есть дата в data — конвертируем ISO → СНГ
    if (data[key]) {
      const [yyyy, mm, dd] = data[key].split("-");
      field.value = `${dd}.${mm}.${yyyy}`;
    }

    // ГЛОБАЛЬНЫЙ календарь
    const dp = document.getElementById("glassDatepicker");

    // Инициализация календаря
    attachGlassDatepicker(field, (isoDate) => {
      const idx = Number(card.dataset.index);

      const [yyyy, mm, dd] = isoDate.split("-");
      const ruDate = `${dd}.${mm}.${yyyy}`;

      field.value = ruDate;
      wizardState.experience[idx][key] = isoDate;

      clearFieldError(field);

      // проверка "конец позже начала"
      if (key === "start_date") {
        const endDateInput = card.querySelector('input[data-field="end_date"]');

        if (endDateInput.value) {
          const [ed, em, ey] = endDateInput.value.split(".");
          const endIso = `${ey}-${em}-${ed}`;

          if (endIso < isoDate) {
            endDateInput.value = "";
            wizardState.experience[idx].end_date = "";
            clearFieldError(endDateInput);
          }
        }
      }
    });

    /* -------------------------------------------------------
       РАБОЧЕЕ ЛОКАЛЬНОЕ АВТОСКРЫТИЕ
    ------------------------------------------------------- */

    let clickedInside = false;

    // если кликнули внутри календаря — не скрываем
    dp.addEventListener("mousedown", () => {
      clickedInside = true;
    });

    // показываем календарь при фокусе
    field.addEventListener("focus", () => {
      dp.classList.remove("hidden");
    });

    // скрываем при blur, если НЕ было клика по календарю
    field.addEventListener("blur", () => {
      setTimeout(() => {
        if (!clickedInside) dp.classList.add("hidden");
        clickedInside = false;
      }, 0);
    });

    return;
  }

  // ТЕКСТОВЫЕ ПОЛЯ
  field.value = data[key] || "";
  field.oninput = () => {
    const idx = Number(card.dataset.index);
    const value = capitalizeFirst(field.value);
    field.value = value;

    wizardState.experience[idx][key] = value;

    if (key === "company") {
      titleEl.textContent = value || "Новое место работы";
    }

    clearFieldError(field);
  };
});

  /* --------------------------------------------------------
     Автокомплит города
  ------------------------------------------------------- */
  const expCityInput = card.querySelector('[data-field="city"]');

  if (expCityInput) {
    attachCityAutocomplete(expCityInput);

    if (data.city) expCityInput.value = data.city;

    expCityInput.oninput = () => {
      const idx = Number(card.dataset.index);
      wizardState.experience[idx].city = capitalizeFirst(expCityInput.value);
      clearFieldError(expCityInput);
    };

    expCityInput.addEventListener("change", () => {
      const idx = Number(card.dataset.index);
      wizardState.experience[idx].city = capitalizeFirst(expCityInput.value);
    });
  }

  /* -------------------------------------------------------
     Дизейбл end_date при current=true
  ------------------------------------------------------- */
  const endDateInput = card.querySelector('input[data-field="end_date"]');
  const currentCheckbox = card.querySelector('input[data-field="current"]');

  if (currentCheckbox.checked) {
    endDateInput.value = "";
    endDateInput.disabled = true;
  }

  /* -------------------------------------------------------
     Удаление карточки
  ------------------------------------------------------- */
  deleteBtn.onclick = () => {
    const idx = Number(card.dataset.index);
    wizardState.experience.splice(idx, 1);
    renderExperienceList();
  };

  experienceListEl.appendChild(clone);
}

/* -------------------------------------------------------
   Перерисовка списка опыта
------------------------------------------------------- */
function renderExperienceList() {
  experienceListEl.innerHTML = "";

  wizardState.experience.forEach((item) => {
    addExperienceCard(item);
  });
}

/* -------------------------------------------------------
   Валидация шага 2
------------------------------------------------------- */
function validateExperienceStep() {
  let valid = true;

  wizardState.experience.forEach((exp, index) => {
    const card = experienceListEl.children[index];
    if (!card) return;

    const getField = (name) =>
      card.querySelector(`[data-field="${name}"]`);

    const companyEl = getField("company");
    const positionEl = getField("position");
    const startEl = getField("start_date");
    const endEl = getField("end_date");

    [companyEl, positionEl, startEl, endEl].forEach(clearFieldError);

    if (!exp.company.trim()) {
      showFieldError(companyEl, "Введите название компании");
      valid = false;
    }

    if (!exp.position.trim()) {
      showFieldError(positionEl, "Введите должность");
      valid = false;
    }

    if (!exp.start_date.trim()) {
      showFieldError(startEl, "Укажите дату начала");
      valid = false;
    }

    if (!exp.current) {
      if (!exp.end_date.trim()) {
        showFieldError(endEl, "Укажите дату окончания");
        valid = false;
      } else if (exp.start_date && exp.end_date < exp.start_date) {
        showFieldError(endEl, "Дата окончания раньше начала");
        valid = false;
      }
    }
  });

  return valid;
}

/* -------------------------------------------------------
   Добавление новой карточки
------------------------------------------------------- */
addExperienceBtn.onclick = () => addExperienceCard();

/* -------------------------------------------------------
   ---------- Step 3: Skills ----------
------------------------------------------------------- */

// Новая структура данных
wizardState.skills = {
  expert: [],
  used: [],
  familiar: []
};

// Активная секция по умолчанию
let activeSkillLevel = "used";

const skillNameInput = document.getElementById("skillNameInput");
const addSkillBtn = document.getElementById("addSkillBtn");
const skillsSuggestionsEl = document.getElementById("skillsSuggestions");

const skillsExpertEl = document.getElementById("skillsExpert");
const skillsUsedEl = document.getElementById("skillsUsed");
const skillsFamiliarEl = document.getElementById("skillsFamiliar");

const SKILL_SUGGESTIONS = [
  "Postman",
  "Jira",
  "Confluence",
  "Git",
  "REST API",
  "SQL",
  "TestRail",
  "Playwright",
  "Cypress"
];

/* -------------------------------------------------------
   Создание одного pill-элемента
------------------------------------------------------- */
function createSkillPill(name, level, index) {
  const pill = document.createElement("div");
  pill.className = "tag-pill";
  pill.innerHTML = `
    ${name}
    <button data-level="${level}" data-index="${index}">✕</button>
  `;

  pill.querySelector("button").onclick = (e) => {
    const lvl = e.target.dataset.level;
    const idx = e.target.dataset.index;

    wizardState.skills[lvl].splice(idx, 1);
    pill.remove();

    renderSkillSuggestions();
    updatePillIndexes(lvl);
  };

  return pill;
}

/* -------------------------------------------------------
   Обновление data-index у pill после удаления
------------------------------------------------------- */
function updatePillIndexes(level) {
  const container = getContainer(level);
  const pills = container.querySelectorAll(".tag-pill button");

  pills.forEach((btn, i) => {
    btn.dataset.index = i;
  });
}

/* -------------------------------------------------------
   Получение контейнера секции
------------------------------------------------------- */
function getContainer(level) {
  return document.getElementById(
    "skills" + level.charAt(0).toUpperCase() + level.slice(1)
  );
}

/* -------------------------------------------------------
   Переключение активной секции
------------------------------------------------------- */
function setActiveSection(level) {
  activeSkillLevel = level;

  document.querySelectorAll(".skills-column").forEach(col => {
    col.classList.remove("active");
  });

  document.querySelector(`.skills-column[data-level="${level}"]`)
    .classList.add("active");
}

/* -------------------------------------------------------
   Добавление навыка в активную секцию
------------------------------------------------------- */
function addSkill(name) {
  name = capitalizeFirst(name.trim());
  if (!name) return;

  // Проверка на дубликаты
  if (
    wizardState.skills.expert.includes(name) ||
    wizardState.skills.used.includes(name) ||
    wizardState.skills.familiar.includes(name)
  ) return;

  wizardState.skills[activeSkillLevel].push(name);

  const index = wizardState.skills[activeSkillLevel].length - 1;
  const container = getContainer(activeSkillLevel);

  container.appendChild(createSkillPill(name, activeSkillLevel, index));

  skillNameInput.value = "";
  renderSkillSuggestions();
}

/* -------------------------------------------------------
   Первичный рендер
------------------------------------------------------- */
function renderSkills() {
  ["expert", "used", "familiar"].forEach(level => {
    const container = getContainer(level);
    container.innerHTML = "";

    wizardState.skills[level].forEach((name, index) => {
      container.appendChild(createSkillPill(name, level, index));
    });
  });
}

/* -------------------------------------------------------
   Рекомендации навыков
------------------------------------------------------- */
function renderSkillSuggestions() {
  skillsSuggestionsEl.innerHTML = "";

  SKILL_SUGGESTIONS.forEach(s => {
    const exists =
      wizardState.skills.expert.includes(s) ||
      wizardState.skills.used.includes(s) ||
      wizardState.skills.familiar.includes(s);

    if (exists) return;

    const pill = document.createElement("div");
    pill.className = "suggestion-pill";
    pill.textContent = s;

    pill.onclick = () => addSkill(s);

    skillsSuggestionsEl.appendChild(pill);
  });
}

/* -------------------------------------------------------
   Добавление навыка кнопкой
------------------------------------------------------- */
addSkillBtn.onclick = () => addSkill(skillNameInput.value);

/* -------------------------------------------------------
   Enter добавляет навык
------------------------------------------------------- */
skillNameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addSkill(skillNameInput.value);
  }
});

/* -------------------------------------------------------
   Клик по секции делает её активной
------------------------------------------------------- */
document.querySelectorAll(".skills-column").forEach(col => {
  col.onclick = () => {
    const level = col.dataset.level;
    setActiveSection(level);
  };
});

/* -------------------------------------------------------
   Инициализация
------------------------------------------------------- */
setActiveSection("used");
renderSkills();
renderSkillSuggestions();

/* -------------------------------------------------------
   ---------- Step 4: Education (исправленная версия) ----------
------------------------------------------------------- */

const educationListEl = document.getElementById("educationList");
const educationTemplate = document.getElementById("educationTemplate");
const addEducationBtn = document.getElementById("addEducationBtn");

/* -------------------------------------------------------
   Добавление карточки образования
------------------------------------------------------- */
function addEducationCard(data = {}) {
  const clone = educationTemplate.content.cloneNode(true);
  const card = clone.querySelector(".card");
  const titleEl = card.querySelector(".card-title");
  const deleteBtn = card.querySelector(".card-delete-btn");

  // Добавляем объект в state
  wizardState.education.push({
    institution: data.institution || "",
    degree: data.degree || "",
    city: data.city || "",
    start_date: data.start_date || "",
    end_date: data.end_date || "",
    certificate_url: data.certificate_url || "",
    description: data.description || ""
  });

  const index = wizardState.education.length - 1;
  card.dataset.index = index;

  titleEl.textContent = data.institution || "Новая запись";

  /* -------------------------------------------------------
     Привязка полей
  ------------------------------------------------------- */
 const fields = card.querySelectorAll("input[data-field], textarea[data-field], select[data-field]");

    fields.forEach((field) => {
    const key = field.dataset.field;

    if (key === "start_date" || key === "end_date") {
        field.type = "text";
        field.placeholder = "ДД.ММ.ГГГГ";

        if (data[key]) {
        const [yyyy, mm, dd] = data[key].split("-");
        field.value = `${dd}.${mm}.${yyyy}`;
        }

        attachGlassDatepicker(field, (isoDate) => {
        const idx = Number(card.dataset.index);

        const [yyyy, mm, dd] = isoDate.split("-");
        field.value = `${dd}.${mm}.${yyyy}`;

        wizardState.education[idx][key] = isoDate;
        clearFieldError(field);
        });

        field.addEventListener("blur", () => {
        setTimeout(() => dp.classList.add("hidden"), 150);
        });

        return;
    }

    // текстовые поля
    field.value = data[key] || "";
    field.oninput = () => {
        const idx = Number(card.dataset.index);
        const value = capitalizeFirst(field.value);
        field.value = value;
        wizardState.education[idx][key] = value;
    };
    });

  /* -------------------------------------------------------
     Автокомплит университетов
  ------------------------------------------------------- */
  const institutionInput = card.querySelector('[data-field="institution"]');

  if (institutionInput) {
    attachUniversityAutocomplete(institutionInput);

    if (data.institution) institutionInput.value = data.institution;

    institutionInput.oninput = () => {
      const idx = Number(card.dataset.index);
      const value = capitalizeFirst(institutionInput.value);
      institutionInput.value = value;
      wizardState.education[idx].institution = value;
      clearFieldError(institutionInput);
    };

    institutionInput.addEventListener("change", () => {
      const idx = Number(card.dataset.index);
      const value = capitalizeFirst(institutionInput.value);
      institutionInput.value = value;
      wizardState.education[idx].institution = value;
    });
  }

  /* -------------------------------------------------------
     Автокомплит города
  ------------------------------------------------------- */
  const cityInput = card.querySelector(".edu-city");

  if (cityInput) {
    attachCityAutocomplete(cityInput);

    if (data.city) cityInput.value = data.city;

    cityInput.oninput = () => {
      const idx = Number(card.dataset.index);
      const value = capitalizeFirst(cityInput.value);
      cityInput.value = value;
      wizardState.education[idx].city = value;
      clearFieldError(cityInput);
    };

    cityInput.addEventListener("change", () => {
      const idx = Number(card.dataset.index);
      const value = capitalizeFirst(cityInput.value);
      cityInput.value = value;
      wizardState.education[idx].city = value;
    });
  }

  /* -------------------------------------------------------
     Удаление карточки
  ------------------------------------------------------- */
  deleteBtn.onclick = () => {
    const idx = Number(card.dataset.index);
    wizardState.education.splice(idx, 1);
    renderEducationList();
  };

  educationListEl.appendChild(clone);
}

/* -------------------------------------------------------
   Перерисовка списка образования
------------------------------------------------------- */
function renderEducationList() {
  educationListEl.innerHTML = "";

  wizardState.education.forEach((item) => {
    addEducationCard(item);
  });
}

/* -------------------------------------------------------
   Добавление новой карточки
------------------------------------------------------- */
addEducationBtn.onclick = () => {
  addEducationCard();
};

// ---------- Validation per step ----------

function validateStep(step) {
  setStatus("");
  if (step === 1) {
    const title = cvTitleInput.value.trim();
    const fullName = fullNameInput.value.trim();
    const position = positionInput.value.trim();
    if (!title || !fullName || !position) {
      setStatus("Заполни название резюме, имя и позицию.", true);
      return false;
    }
    wizardState.profile = {
      title,
      full_name: fullName,
      position,
      location: locationInput.value.trim(),
      email: emailInput.value.trim(),
      phone: phoneInput.value.trim(),
      summary: summaryInput.value.trim()
    };
    return true;
  }

  if (step === 2) {
    if (wizardState.experience.length === 0) {
      setStatus(
        "Ты можешь продолжить без опыта, но лучше добавить хотя бы одно место работы."
      );
    }
    return true;
  }

  if (step === 3) {
    if (wizardState.skills.length === 0) {
      setStatus("Добавь хотя бы 3–5 ключевых навыков.", true);
      return false;
    }
    return true;
  }

  if (step === 4) {
    return true;
  }

  return true;
}

// ---------- Save to Supabase ----------

async function saveCV() {
  try {
    console.group("=== SAVE CV START ===");

    setStatus("Сохраняем резюме...");
    nextBtn.disabled = true;
    prevBtn.disabled = true;
    finishBtn.disabled = true;

    /* -------------------------------------------------------
       USER
    ------------------------------------------------------- */
    console.log("[1] Получаем пользователя…");

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    console.log("[1] user =", user);
    console.log("[1] userError =", userError);

    if (userError || !user) {
      console.error("[1] Ошибка получения пользователя:", userError);
      setStatus("Не удалось определить пользователя. Перезайди в систему.", true);
      console.groupEnd();
      return;
    }

    /* -------------------------------------------------------
       1. Создаём запись CV
    ------------------------------------------------------- */
    console.log("[2] Создаём CV…", {
      title: wizardState.profile.title,
      user_id: user.id
    });

    const { data: cvInsert, error: cvError } = await supabase
      .from("cv")
      .insert({
        user_id: user.id,
        title: wizardState.profile.title,
        language: "ru",
        theme: "default",
        is_public: false
      })
      .select("id")
      .single();

    console.log("[2] cvInsert =", cvInsert);
    console.log("[2] cvError =", cvError);

    if (cvError || !cvInsert) {
      console.error("[2] Ошибка создания CV:", cvError);
      setStatus("Ошибка создания резюме.", true);
      console.groupEnd();
      return;
    }

    const cvId = cvInsert.id;
    createdCvId = cvId;

    /* -------------------------------------------------------
       2. ДОЗАПОЛНЯЕМ cv_profiles
    ------------------------------------------------------- */
    console.log("[3] Обновляем cv_profiles…");

    const profileUpdate = {
      full_name: wizardState.profile.full_name || null,
      position: wizardState.profile.position || null,
      summary: wizardState.profile.summary || null,
      email: wizardState.profile.email || null,
      phone: wizardState.profile.phone || null,
      location: wizardState.profile.location || null,
      avatar_url: wizardState.profile.avatar_url || null,
      telegram: wizardState.profile.telegram || null,
      github: wizardState.profile.github || null,
      website: wizardState.profile.website || null,
      twitter: wizardState.profile.twitter || null,
      instagram: wizardState.profile.instagram || null,
      facebook: wizardState.profile.facebook || null,
      behance: wizardState.profile.behance || null,
      dribbble: wizardState.profile.dribbble || null
    };

    console.log("[3] profileUpdate =", profileUpdate);

    const { error: cvProfileError } = await supabase
      .from("cv_profiles")
      .update(profileUpdate)
      .eq("cv_id", cvId);

    console.log("[3] cvProfileError =", cvProfileError);

    /* -------------------------------------------------------
       3. Преимущества
    ------------------------------------------------------- */
    console.log("[4] Добавляем advantages…", wizardState.advantages);

    if (wizardState.advantages.length > 0) {
      const advRows = wizardState.advantages.map(tag => ({
        cv_id: cvId,
        tag
      }));

      console.log("[4] advRows =", advRows);

      const { error: advError } = await supabase
        .from("advantages")
        .insert(advRows);

      console.log("[4] advError =", advError);
    }

    /* -------------------------------------------------------
       4. Опыт
    ------------------------------------------------------- */
    console.log("[5] Добавляем experience…", wizardState.experience);

    if (wizardState.experience.length > 0) {
      const expRows = wizardState.experience.map((e, idx) => ({
        cv_id: cvId,
        company: e.company || null,
        position: e.position || null,
        city: e.city || null,
        start_date: e.start_date || null,
        end_date: e.current ? null : (e.end_date || null),
        current: !!e.current,
        description: e.description || null,
        order_index: idx
      }));

      console.log("[5] expRows =", expRows);

      const { error: expError } = await supabase
        .from("experience")
        .insert(expRows);

      console.log("[5] expError =", expError);
    }

    /* -------------------------------------------------------
       5. Навыки
    ------------------------------------------------------- */
    console.log("[6] Добавляем skills…", wizardState.skills);

    const skillRows = [];

    Object.entries(wizardState.skills).forEach(([level, list]) => {
      list.forEach(name => {
        skillRows.push({
          cv_id: cvId,
          name,
          level
        });
      });
    });

    console.log("[6] skillRows =", skillRows);

    if (skillRows.length > 0) {
      const { error: skillError } = await supabase
        .from("skills")
        .insert(skillRows);

      console.log("[6] skillError =", skillError);
    }

    /* -------------------------------------------------------
       6. Образование
    ------------------------------------------------------- */
    console.log("[7] Добавляем education…", wizardState.education);

    if (wizardState.education.length > 0) {
      const eduRows = wizardState.education.map(e => ({
        cv_id: cvId,
        institution: e.institution || null,
        degree: e.degree || null,
        city: e.city || null,
        start_date: e.start_date || null,
        end_date: e.end_date || null,
        certificate_url: e.certificate_url || null,
        description: e.description || null
      }));

      console.log("[7] eduRows =", eduRows);

      const { error: eduError } = await supabase
        .from("education")
        .insert(eduRows);

      console.log("[7] eduError =", eduError);
    }

    /* -------------------------------------------------------
       SUCCESS
    ------------------------------------------------------- */
    console.log("[8] Успех! CV создан:", cvId);

    setStatus("Резюме сохранено.");

    const successViewBtn = document.getElementById("successViewBtn");
    if (successViewBtn && cvId) {
      successViewBtn.setAttribute("href", `/cv/cv-view.html?id=${cvId}`);
    }

    showStep("success");

  } catch (err) {
    console.error("=== SAVE CV ERROR ===", err);
    setStatus("Непредвиденная ошибка при сохранении резюме.", true);
  } finally {
    nextBtn.disabled = false;
    prevBtn.disabled = false;
    finishBtn.disabled = false;

    console.groupEnd();
  }
}

/* -------------------------------------------------------
   Navigation
------------------------------------------------------- */

prevBtn.onclick = () => {
  if (currentStep > 1) {
    currentStep -= 1;
    showStep(currentStep);
  }
};

nextBtn.onclick = () => {
  if (currentStep === 1 && !validateProfileStep()) return;
  if (currentStep === 2 && !validateExperienceStep()) return;

  if (currentStep < 4) {
    showStep(currentStep + 1);
  }
};

finishBtn.onclick = async () => {
  if (!validateStep(4)) return;
  await saveCV();
};

/* -------------------------------------------------------
   Init
------------------------------------------------------- */

function init() {
  // --- STEP 1: PROFILE ---
  resetAvatarToPlaceholder();      // заглушка аватара
  renderAdvantages();              // тэги
  renderAdvSuggestions();          // подсказки тэгов
  hideCityDropdown();              // очистка автокомплита
  attachAutoCapitalize();          // авто-капитализация

  saveProfileToState();
  updateProgressUI();

  // --- STEP 2: EXPERIENCE ---
  renderExperienceList();

  // --- STEP 3: SKILLS ---
  renderSkills();
  renderSkillSuggestions();

  // --- STEP 4: EDUCATION ---
  renderEducationList();

  // --- SHOW FIRST STEP ---
  showStep(1);
}

init();
