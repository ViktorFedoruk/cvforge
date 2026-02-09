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
   GLASS DATEPICKER — OPTIMIZED (morphdom + delegation)
========================================================= */

const dp = document.getElementById("glassDatepicker");
let dpTargetInput = null;

// dpDate — состояние навигации календаря (месяц/год)
// dpSelectedDate — реально выбранная дата (для хедера года)
let dpDate = new Date();
let dpSelectedDate = null;

const monthsRU = [
  "Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"
];

const weekdaysRU = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

// Кэшируем элементы
const dpDaysEl      = dp.querySelector(".gdp-days");
const dpWeekdaysEl  = dp.querySelector(".gdp-weekdays");
const dpMonthBtn    = dp.querySelector(".gdp-month-btn");
const dpYearBtn     = dp.querySelector(".gdp-year-btn");
const dpMonthMenu   = dp.querySelector(".gdp-month-menu");
const dpYearMenu    = dp.querySelector(".gdp-year-menu");
const dpPrevBtn     = dp.querySelector(".gdp-prev");
const dpNextBtn     = dp.querySelector(".gdp-next");

/* --------------------------------------------------------
   HELPERS
-------------------------------------------------------- */
function closeAllMenus() {
  document.querySelectorAll(".gdp-menu").forEach(m => m.classList.add("hidden"));
}

function hideDp() {
  dp.classList.add("hidden");
  dpTargetInput = null;
  closeAllMenus();
}

function openMenu(menu) {
  document.querySelectorAll(".gdp-menu").forEach(m => {
    if (m !== menu) m.classList.add("hidden");
  });
  menu.classList.toggle("hidden");

  // Если открываем меню годов — скроллим к активному/текущему году
  if (menu === dpYearMenu && !menu.classList.contains("hidden")) {
    scrollYearMenu();
  }
}

/* --------------------------------------------------------
   GLOBAL CLICK — закрываем только снаружи
-------------------------------------------------------- */
document.addEventListener("mousedown", (e) => {
  const insideDp       = !!e.target.closest("#glassDatepicker");
  const insideInput    = !!e.target.closest("input[data-field='start_date'], input[data-field='end_date']");
  const insideMenu     = !!e.target.closest(".gdp-menu");
  const insideDropdown = !!e.target.closest(".gdp-dropdown");
  const insideCard     = !!e.target.closest(".experience-card");

  // Если клик внутри календаря, меню, инпута даты или карточки опыта — не закрываем
  if (insideDp || insideInput || insideMenu || insideDropdown || insideCard) return;

  hideDp();
});

/* --------------------------------------------------------
   STATIC RENDER — ДНИ НЕДЕЛИ, МЕНЮ МЕСЯЦЕВ/ГОДОВ
-------------------------------------------------------- */

// Дни недели
dpWeekdaysEl.innerHTML = weekdaysRU.map(d => `<div>${d}</div>`).join("");

// Месяцы
dpMonthMenu.innerHTML = monthsRU
  .map((m, i) => `<div class="gdp-menu-item" data-month="${i}">${m}</div>`)
  .join("");

// Годы (диапазон -50 лет до текущего)
const YEARS = [];
const currentYear = new Date().getFullYear();
for (let y = currentYear - 50; y <= currentYear; y++) YEARS.push(y);

dpYearMenu.innerHTML = YEARS
  .map(y => `<div class="gdp-menu-item" data-year="${y}">${y}</div>`)
  .join("");

/* --------------------------------------------------------
   SCROLL TO ACTIVE / CURRENT YEAR
-------------------------------------------------------- */
function scrollYearMenu() {
  // Если есть выбранная дата — скроллим к её году, иначе к текущему
  const targetYear = dpSelectedDate
    ? dpSelectedDate.getFullYear()
    : new Date().getFullYear();

  const item = dpYearMenu.querySelector(`.gdp-menu-item[data-year="${targetYear}"]`);
  if (!item) return;

  requestAnimationFrame(() => {
    const offset = item.offsetTop - dpYearMenu.clientHeight / 2 + item.clientHeight / 2;
    dpYearMenu.scrollTop = Math.max(offset, 0);
  });
}

/* --------------------------------------------------------
   РЕНДЕР КАЛЕНДАРЯ
-------------------------------------------------------- */
function renderGlassDatepicker() {
  if (!dpDate || isNaN(dpDate.getTime())) {
    dpDate = new Date();
  }

  const year  = dpDate.getFullYear();
  const month = dpDate.getMonth();

  // ✔ Правильная логика хедера
  const headerYear = dpSelectedDate
    ? dpSelectedDate.getFullYear()
    : dpDate.getFullYear();

  dpMonthBtn.textContent = monthsRU[month];
  dpYearBtn.textContent  = headerYear;

  // Активный месяц
  dpMonthMenu.querySelectorAll(".gdp-menu-item").forEach(item => {
    item.classList.toggle("active", Number(item.dataset.month) === month);
  });

  // Активный год
  dpYearMenu.querySelectorAll(".gdp-menu-item").forEach(item => {
    item.classList.toggle("active", Number(item.dataset.year) === year);
  });

  // Дни месяца
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);

  const startOffset = (firstDay.getDay() + 6) % 7;

  let html = "";

  for (let i = 0; i < startOffset; i++) {
    html += `<div class="gdp-day-empty"></div>`;
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const yyyy = year;
    const mm   = String(month + 1).padStart(2, "0");
    const dd   = String(d).padStart(2, "0");

    const iso = `${yyyy}-${mm}-${dd}`;
    const ru  = `${dd}.${mm}.${yyyy}`;

    html += `<div class="gdp-day" data-iso="${iso}" data-ru="${ru}">${d}</div>`;
  }

  const temp = document.createElement("div");
  temp.innerHTML = html;

  morphdom(dpDaysEl, temp, { childrenOnly: true });
}

/* --------------------------------------------------------
   DELEGATED EVENTS
-------------------------------------------------------- */

// Месяцы
dpMonthMenu.addEventListener("click", (e) => {
  const item = e.target.closest(".gdp-menu-item[data-month]");
  if (!item) return;

  dpDate.setMonth(Number(item.dataset.month));
  closeAllMenus();
  renderGlassDatepicker();
});

// Годы
dpYearMenu.addEventListener("click", (e) => {
  const item = e.target.closest(".gdp-menu-item[data-year]");
  if (!item) return;

  dpDate.setFullYear(Number(item.dataset.year));
  closeAllMenus();
  renderGlassDatepicker();
});

// Дни
dpDaysEl.addEventListener("click", (e) => {
  const day = e.target.closest(".gdp-day");
  if (!day || !dpTargetInput || dpTargetInput.disabled) return;

  const iso = day.dataset.iso;
  const ru  = day.dataset.ru;

  dpTargetInput.value = ru;

  const d = new Date(iso);
  if (!isNaN(d)) {
    dpSelectedDate = d;
    dpDate = d;
  }

  if (dpTargetInput._onSelect) dpTargetInput._onSelect(iso);

  hideDp();
});

/* --------------------------------------------------------
   ПЕРЕКЛЮЧЕНИЕ МЕСЯЦЕВ
-------------------------------------------------------- */
dpPrevBtn.onclick = (e) => {
  e.stopPropagation();
  dpDate.setMonth(dpDate.getMonth() - 1);
  renderGlassDatepicker();
};

dpNextBtn.onclick = (e) => {
  e.stopPropagation();
  dpDate.setMonth(dpDate.getMonth() + 1);
  renderGlassDatepicker();
};

/* --------------------------------------------------------
   ОТКРЫТИЕ МЕНЮ
-------------------------------------------------------- */
dpMonthBtn.onclick = (e) => {
  e.stopPropagation();
  openMenu(dpMonthMenu);
};

dpYearBtn.onclick = (e) => {
  e.stopPropagation();
  openMenu(dpYearMenu);
};

/* --------------------------------------------------------
   ATTACH FUNCTION — СНГ формат ДД.ММ.ГГГГ
   (идемпотентная, без дублирования слушателей)
-------------------------------------------------------- */
function attachGlassDatepicker(input, onSelect) {
  if (!input) return;

  // ВАЖНО: не вешаем календарь на контейнеры .form-field
  if (input.tagName !== "INPUT") return;

  // Уже привязан — только обновляем колбэк
  if (input._dpAttached) {
    input._onSelect = onSelect;
    return;
  }

  input._dpAttached = true;
  input.type = "text";
  input.placeholder = "ДД.ММ.ГГГГ";
  input._onSelect = onSelect;

  // Форматирование
  input.addEventListener("input", (e) => {
    const el = e.currentTarget;
    if (!el || typeof el.value !== "string") return;

    let v = (el.value || "").replace(/[^\d]/g, "");

    if (v.length >= 3) v = v.slice(0, 2) + "." + v.slice(2);
    if (v.length >= 6) v = v.slice(0, 5) + "." + v.slice(5);

    el.value = v.slice(0, 10);

    if (/^\d{2}\.\d{2}\.\d{4}$/.test(el.value)) {
      const [dd, mm, yyyy] = el.value.split(".");
      const iso = `${yyyy}-${mm}-${dd}`;

      const d = new Date(iso);
      if (!isNaN(d)) {
        dpDate = d;
        dpSelectedDate = d;
        if (el._onSelect) el._onSelect(iso);
      }
    }
  });

  // Открытие календаря
  input.addEventListener("click", (e) => {
    const el = e.currentTarget;
    if (!el || el.disabled) return;

    e.stopPropagation();
    dpTargetInput = el;

    const value = (el.value || "").trim();
    const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);

    if (match) {
      const [_, dd, mm, yyyy] = match;
      const iso = `${yyyy}-${mm}-${dd}`;
      const d = new Date(iso);
      if (!isNaN(d)) {
        dpDate = d;
        dpSelectedDate = d;
      } else {
        dpDate = new Date();
        dpSelectedDate = null;
      }
    } else {
      dpDate = new Date();
      dpSelectedDate = null;
    }

    const rect = el.getBoundingClientRect();
    dp.style.top  = rect.bottom + window.scrollY + 8 + "px";
    dp.style.left = rect.left   + window.scrollX + "px";

    dp.classList.remove("hidden");
    renderGlassDatepicker();
  });

  // Закрытие при потере фокуса инпута
  input.addEventListener("blur", () => {
    setTimeout(() => {
      const active = document.activeElement;
      const insideDp   = active && active.closest && active.closest("#glassDatepicker");
      const insideCard = active && active.closest && active.closest(".experience-card");

      // Если фокус ушёл не в календарь и не в карточку — закрываем
      if (!insideDp && !insideCard) {
        hideDp();
      }
    }, 150);
  });
}

/* -------------------------------------------------------
   Кастомный SELECT — базовая логика
------------------------------------------------------- */
function initCustomSelect(selectEl, card, index) {
  const trigger = selectEl.querySelector(".custom-select-trigger");
  const valueEl = selectEl.querySelector(".custom-select-value");
  const dropdown = selectEl.querySelector(".custom-select-dropdown");
  const options = selectEl.querySelectorAll(".custom-option");

  // Открытие/закрытие
  trigger.onclick = (e) => {
    e.stopPropagation();
    closeAllCustomSelects();
    selectEl.classList.toggle("active");
  };

  // Выбор значения
  options.forEach((opt) => {
    opt.onclick = (e) => {
      e.stopPropagation();

      const val = opt.dataset.value;
      const text = opt.textContent.trim();

      // Обновляем UI
      valueEl.textContent = text;
      options.forEach((o) => o.classList.remove("active"));
      opt.classList.add("active");

      // Обновляем state
      wizardState.experience[index].employment_type = val;

      // Закрываем
      selectEl.classList.remove("active");
    };
  });
}

/* Закрытие всех селектов при клике вне */
function closeAllCustomSelects() {
  document.querySelectorAll(".custom-select.active")
    .forEach((el) => el.classList.remove("active"));
}

document.addEventListener("click", closeAllCustomSelects);

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
   ВАЛИДАЦИЯ + ЛИМИТЕРЫ
------------------------------------------------------- */

// Основные поля
limitLength(cvTitleInput, 80);
limitLength(fullNameInput, 80);
limitLength(positionInput, 80);
limitLength(summaryInput, 350);

sanitizePhone(phoneInput);
sanitizeContact(linkedinInput);

// Extra contacts (существующие)
document.querySelectorAll("[data-contact]").forEach(input => {
  limitLength(input, 100);
  sanitizeContact(input);
});

// Extra contacts (динамические)
document.addEventListener("input", (e) => {
  const el = e.target;
  if (!el.dataset.contact) return;

  if (el.value.length > 100) {
    el.value = el.value.slice(0, 100);
  }

  el.value = el.value.replace(/[^\w\-./:@]/g, "");
});

/* -------------------------------------------------------
   СИНХРОНИЗАЦИЯ ПОЛЕЙ С wizardState.profile
------------------------------------------------------- */
cvTitleInput.addEventListener("input", () => {
  wizardState.profile.title = cvTitleInput.value.trim();
  clearFieldError(cvTitleInput);
});

fullNameInput.addEventListener("input", () => {
  wizardState.profile.full_name = fullNameInput.value.trim();
  clearFieldError(fullNameInput);
});

positionInput.addEventListener("input", () => {
  wizardState.profile.position = positionInput.value.trim();
  clearFieldError(positionInput);
});

locationInput.addEventListener("input", () => {
  wizardState.profile.location = locationInput.value.trim();
  clearFieldError(locationInput);
});

locationInput.addEventListener("change", () => {
  clearFieldError(locationInput);
});

emailInput.addEventListener("input", () => {
  wizardState.profile.email = emailInput.value.trim();
  clearFieldError(emailInput);
});

phoneInput.addEventListener("input", () => {
  phoneInput.value = phoneInput.value.replace(/[^0-9+\-\s()]/g, "");
  wizardState.profile.phone = phoneInput.value.trim();
  clearFieldError(phoneInput);
});

linkedinInput.addEventListener("input", () => {
  wizardState.profile.linkedin = linkedinInput.value.trim();
  clearFieldError(linkedinInput);
});

summaryInput.addEventListener("input", () => {
  wizardState.profile.summary = summaryInput.value.trim();
  clearFieldError(summaryInput);
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
      clearFieldError(positionInput); // ВАЖНО
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
  let minZoom = 1;
  let imgX = 0;
  let imgY = 0;

  function updateTransform() {
    img.style.transform = `translate(${imgX}px, ${imgY}px) scale(${zoom})`;
  }

  /* -------------------------------------------------------
     ОГРАНИЧЕНИЕ ПЕРЕМЕЩЕНИЯ
  ------------------------------------------------------- */
  function clampPosition() {
    const areaRect = cropArea.getBoundingClientRect();
    const imgW = img.naturalWidth * zoom;
    const imgH = img.naturalHeight * zoom;

    const circleSize = 240;
    const half = circleSize / 2;

    const centerX = areaRect.width / 2;
    const centerY = areaRect.height / 2;

    const leftLimit = centerX - half;
    const rightLimit = centerX + half;
    const topLimit = centerY - half;
    const bottomLimit = centerY + half;

    const imgLeft = imgX;
    const imgRight = imgX + imgW;
    const imgTop = imgY;
    const imgBottom = imgY + imgH;

    if (imgLeft > leftLimit) imgX = leftLimit;
    if (imgTop > topLimit) imgY = topLimit;
    if (imgRight < rightLimit) imgX = rightLimit - imgW;
    if (imgBottom < bottomLimit) imgY = bottomLimit - imgH;
  }

  /* -------------------------------------------------------
     ЗАГРУЗКА ИЗОБРАЖЕНИЯ
  ------------------------------------------------------- */
  img.onload = () => {
    const areaRect = cropArea.getBoundingClientRect();

    const minW = 240 / img.naturalWidth;
    const minH = 240 / img.naturalHeight;
    minZoom = Math.max(minW, minH);

    const scale = Math.min(
      areaRect.width / img.naturalWidth,
      areaRect.height / img.naturalHeight
    );

    zoom = Math.max(scale, minZoom);
    zoomInput.value = zoom.toFixed(2);
    zoomInput.min = minZoom;

    imgX = (areaRect.width - img.naturalWidth * zoom) / 2;
    imgY = (areaRect.height - img.naturalHeight * zoom) / 2;

    clampPosition();
    updateTransform();
  };

  /* -------------------------------------------------------
     ЗУМ КОЛЕСОМ
  ------------------------------------------------------- */
  cropArea.onwheel = e => {
    e.preventDefault();

    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    const newZoom = Math.min(Math.max(zoom + delta, minZoom), 5);

    const rect = cropArea.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    const imgPointX = (cx - imgX) / zoom;
    const imgPointY = (cy - imgY) / zoom;

    zoom = newZoom;
    zoomInput.value = zoom.toFixed(2);

    imgX = cx - imgPointX * zoom;
    imgY = cy - imgPointY * zoom;

    clampPosition();
    updateTransform();
  };

  /* -------------------------------------------------------
     ЗУМ ПОЛЗУНКОМ
  ------------------------------------------------------- */
  zoomInput.oninput = () => {
    let newZoom = parseFloat(zoomInput.value);

    if (newZoom < minZoom) {
      zoomInput.value = minZoom;
      return;
    }

    const rect = cropArea.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    const imgPointX = (cx - imgX) / zoom;
    const imgPointY = (cy - imgY) / zoom;

    zoom = newZoom;

    imgX = cx - imgPointX * zoom;
    imgY = cy - imgPointY * zoom;

    clampPosition();
    updateTransform();
  };

  /* -------------------------------------------------------
     ПЕРЕМЕЩЕНИЕ С ОГРАНИЧЕНИЯМИ
  ------------------------------------------------------- */
  let isMouseDown = false;
  let startX = 0;
  let startY = 0;

  cropArea.addEventListener("mousedown", e => {
    e.preventDefault();
    isMouseDown = true;
    startX = e.clientX;
    startY = e.clientY;
    cropArea.classList.add("dragging");
  });

  document.addEventListener("mousemove", e => {
    if (!isMouseDown) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    imgX += dx;
    imgY += dy;

    startX = e.clientX;
    startY = e.clientY;

    clampPosition();
    updateTransform();
  });

  document.addEventListener("mouseup", () => {
    isMouseDown = false;
    cropArea.classList.remove("dragging");
  });

  /* -------------------------------------------------------
     ОТМЕНА
  ------------------------------------------------------- */
  cancelBtn.onclick = () => {
    modal.style.display = "none";
    if (window.avatarObjectUrl) {
      URL.revokeObjectURL(window.avatarObjectUrl);
      window.avatarObjectUrl = null;
    }
    avatarFileInput.value = "";
  };

  /* -------------------------------------------------------
     СОХРАНЕНИЕ
  ------------------------------------------------------- */
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
  const cvId = createdCvId || wizardState.currentCvId;
  const fileName = `avatar_${Date.now()}.png`;
  const filePath = `${cvId}/${fileName}`;

  const { error } = await supabase.storage
    .from("avatars")
    .upload(filePath, blob, { upsert: true });

  if (!error) {
    const publicUrl = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath).data.publicUrl;

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
   ADVANTAGES — OPTIMIZED WITH MORPHDOM + DELEGATION
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

/* Лимитер + очистка ошибок */
limitLength(advantageInput, 30);
advantageInput.addEventListener("input", () => clearFieldError(advantageInput));

/* -----------------------------
   RENDER ADVANTAGES (PATCH)
------------------------------ */
function renderAdvantages() {
  const temp = document.createElement("div");

  temp.innerHTML = wizardState.advantages
    .map(
      (tag, index) => `
        <div class="tag-pill">
          <span>${tag}</span>
          <button type="button" data-index="${index}">✕</button>
        </div>
      `
    )
    .join("");

  morphdom(advantagesListEl, temp, { childrenOnly: true });
}

/* -----------------------------
   RENDER SUGGESTIONS (PATCH)
------------------------------ */
function renderAdvSuggestions() {
  const temp = document.createElement("div");

  temp.innerHTML = ADV_SUGGESTIONS
    .filter(s => !wizardState.advantages.includes(s))
    .map(
      s => `
        <div class="suggestion-pill" data-suggestion="${s}">
          ${s}
        </div>
      `
    )
    .join("");

  morphdom(advantagesSuggestionsEl, temp, { childrenOnly: true });
}

/* -----------------------------
   DELEGATED EVENTS
------------------------------ */

/* Удаление тега */
advantagesListEl.addEventListener("click", e => {
  const btn = e.target.closest("button[data-index]");
  if (!btn) return;

  const index = Number(btn.dataset.index);
  wizardState.advantages.splice(index, 1);

  renderAdvantages();
  renderAdvSuggestions();
});

/* Добавление тега из подсказок */
advantagesSuggestionsEl.addEventListener("click", e => {
  const pill = e.target.closest("[data-suggestion]");
  if (!pill) return;

  const value = pill.dataset.suggestion;

  if (value.length > 50) return;
  if (!wizardState.advantages.includes(value)) {
    wizardState.advantages.push(value);
  }

  renderAdvantages();
  renderAdvSuggestions();
});

/* Добавление тега вручную */
addAdvantageBtn.onclick = () => {
  const value = advantageInput.value.trim();
  if (!value) return;

  if (value.length > 50) {
    alert("Тег слишком длинный (максимум 50 символов)");
    return;
  }

  if (!wizardState.advantages.includes(value)) {
    wizardState.advantages.push(value);
  }

  advantageInput.value = "";
  clearFieldError(advantageInput);

  renderAdvantages();
  renderAdvSuggestions();
};

/* Enter → добавить */
advantageInput.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    e.preventDefault();
    addAdvantageBtn.click();
  }
});

/* Первичный рендер */
renderAdvantages();
renderAdvSuggestions();

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

/* Закрытие дропдауна при клике вне */
document.addEventListener("click", e => {
  const isDropdown = e.target.closest(".extra-contact-dropdown");
  const isButton = e.target.closest("#addExtraContactBtn");

  if (isButton) return;
  if (!isDropdown) extraContactDropdown.classList.remove("show");
});

/* Открытие дропдауна */
addExtraContactBtn.onclick = () => {
  extraContactDropdown.classList.toggle("show");
};

/* Добавление нового поля контакта */
extraContactDropdown.querySelectorAll("div").forEach(item => {
  item.onclick = () => {
    const type = item.dataset.type;
    addExtraContactField(type);
    extraContactDropdown.classList.remove("show");
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

  // Синхронизация
  input.addEventListener("input", () => {
    wizardState.profile[type] = input.value.trim();
    clearFieldError(input);
  });
}

/* Повторный рендер (страховка) */
renderAdvantages();
renderAdvSuggestions();

/* -------------------------------------------------------
   SAVE PROFILE STATE
------------------------------------------------------- */
function saveProfileToState() {
  wizardState.profile.title = cvTitleInput?.value.trim() || "";
  wizardState.profile.full_name = fullNameInput?.value.trim() || "";
  wizardState.profile.position = positionInput?.value.trim() || "";
  wizardState.profile.location = locationInput?.value.trim() || "";
  wizardState.profile.email = emailInput?.value.trim() || "";
  wizardState.profile.phone = phoneInput?.value.trim() || "";
  wizardState.profile.linkedin = linkedinInput?.value.trim() || "";
  wizardState.profile.summary = summaryInput?.value.trim() || "";

  document.querySelectorAll("[data-contact]").forEach(input => {
    wizardState.profile[input.dataset.contact] = input.value.trim();
  });
}

/* =======================================================
   STEP 2 — EXPERIENCE (OPTIMIZED: morphdom + delegation)
======================================================= */

const experienceListEl = document.getElementById("experienceList");
const experienceTemplate = document.getElementById("experienceTemplate");
const addExperienceBtn = document.getElementById("addExperienceBtn");

/* -------------------------------------------------------
   PATCH‑RENDER СПИСКА ОПЫТА
------------------------------------------------------- */
function renderExperienceList() {
  const temp = document.createElement("div");

  wizardState.experience.forEach((item, index) => {
    const clone = experienceTemplate.content.cloneNode(true);
    const card = clone.querySelector(".card");
    card.dataset.index = index;
    temp.appendChild(clone);
  });

  morphdom(experienceListEl, temp, { childrenOnly: true });

  // Гидратация карточек
  experienceListEl.querySelectorAll(".card").forEach((card, index) => {
    hydrateExperienceCard(card, wizardState.experience[index], index);
  });
}

document.addEventListener("input", (e) => {
  const el = e.target;
  if (!el.dataset.field) return;

  switch (el.dataset.field) {
    case "company":
    case "position":
      if (el.value.length > 80) el.value = el.value.slice(0, 80);
      break;

    case "city":
      if (el.value.length > 80) el.value = el.value.slice(0, 80);
      break;

    case "technologies":
      if (el.value.length > 120) el.value = el.value.slice(0, 120);
      break;

    case "projects":
      if (el.value.length > 300) el.value = el.value.slice(0, 300);
      break;

    case "description":
      if (el.value.length > 300) el.value = el.value.slice(0, 300);
      break;
  }
});

/* -------------------------------------------------------
   ГИДРАТАЦИЯ КАРТОЧКИ (привязка логики)
------------------------------------------------------- */
function hydrateExperienceCard(card, data, index) {
  const titleEl = card.querySelector(".card-title");
  const deleteBtn = card.querySelector(".card-delete-btn");

  titleEl.textContent = data.company || "Место работы";

  /* -----------------------------
     ПРИВЯЗКА ПОЛЕЙ
  ------------------------------ */
  const fields = card.querySelectorAll("[data-field]");

  fields.forEach((field) => {
    const key = field.dataset.field;

    /* --- ЧЕКБОКС "Работаю здесь сейчас" --- */
    if (field.type === "checkbox") {
      field.checked = !!data[key];

      field.onchange = () => {
        wizardState.experience[index][key] = field.checked;

        const endDateInput = card.querySelector('input[data-field="end_date"]');

        if (field.checked) {
          endDateInput.value = "";
          endDateInput.readOnly = true;
          endDateInput.classList.add("input-disabled");
          wizardState.experience[index].end_date = "";
          clearFieldError(endDateInput);
        } else {
          endDateInput.readOnly = false;
          endDateInput.classList.remove("input-disabled");
        }
      };

      return;
    }

    /* --- ДАТЫ (кастомный календарь) --- */
    if (field.dataset.field === "start_date" || field.dataset.field === "end_date") {
      field.type = "text";
      field.placeholder = "ДД.ММ.ГГГГ";

      if (data[key]) {
        const [yyyy, mm, dd] = data[key].split("-");
        field.value = `${dd}.${mm}.${yyyy}`;
      }

      attachGlassDatepicker(field, (isoDate) => {
        wizardState.experience[index][key] = isoDate;

        const [yyyy, mm, dd] = isoDate.split("-");
        field.value = `${dd}.${mm}.${yyyy}`;

        clearFieldError(field);

        const endDateInput = card.querySelector('input[data-field="end_date"]');
        const currentCheckbox = card.querySelector('input[data-field="current"]');

        if (key === "end_date" && isoDate) {
          currentCheckbox.checked = false;
          wizardState.experience[index].current = false;

          endDateInput.readOnly = false;
          endDateInput.classList.remove("input-disabled");
        }

        if (key === "start_date" && endDateInput.value) {
          const [ed, em, ey] = endDateInput.value.split(".");
          const endIso = `${ey}-${em}-${ed}`;

          if (endIso < isoDate) {
            endDateInput.value = "";
            wizardState.experience[index].end_date = "";
            clearFieldError(endDateInput);

            currentCheckbox.checked = true;
            wizardState.experience[index].current = true;

            endDateInput.readOnly = true;
            endDateInput.classList.add("input-disabled");
          }
        }
      });

      return;
    }

    /* --- ТЕКСТОВЫЕ ПОЛЯ --- */
    field.value = data[key] || "";

    field.oninput = () => {
      const value = capitalizeFirst(field.value);
      field.value = value;
      wizardState.experience[index][key] = value;
      
      if (key === "company" && value.length > 80) {
        field.value = value.slice(0, 80);
        wizardState.experience[index][key] = field.value;
      }

      if (key === "company") {
        titleEl.textContent = value || "Место работы";
      }

      clearFieldError(field);
    };
  });

  /* -------------------------------------------------------
     КАСТОМНЫЙ SELECT
  ------------------------------------------------------- */
  const customSelect = card.querySelector(".custom-select");
  if (customSelect) {
    initCustomSelect(customSelect, card, index);

    if (data.employment_type) {
      const opt = customSelect.querySelector(
        `.custom-option[data-value="${data.employment_type}"]`
      );
      if (opt) {
        customSelect.querySelector(".custom-select-value").textContent =
          opt.textContent.trim();
        opt.classList.add("active");
      }
    }
  }

  /* -------------------------------------------------------
     АВТОКОМПЛИТ ГОРОДА
  ------------------------------------------------------- */
  const expCityInput = card.querySelector('[data-field="city"]');

  if (expCityInput) {
    attachCityAutocomplete(expCityInput);

    if (data.city) expCityInput.value = data.city;

    expCityInput.oninput = () => {
      wizardState.experience[index].city = capitalizeFirst(expCityInput.value);
      clearFieldError(expCityInput);
    };

    expCityInput.addEventListener("change", () => {
      wizardState.experience[index].city = capitalizeFirst(expCityInput.value);
    });
  }

  /* -------------------------------------------------------
     END_DATE ↔ CURRENT
  ------------------------------------------------------- */
  const endDateInput = card.querySelector('input[data-field="end_date"]');
  const currentCheckbox = card.querySelector('input[data-field="current"]');

  if (currentCheckbox.checked) {
    endDateInput.value = "";
    endDateInput.readOnly = true;
    endDateInput.classList.add("input-disabled");
  }

  endDateInput.addEventListener("input", () => {
    if (!endDateInput.value.trim()) {
      currentCheckbox.checked = true;
      wizardState.experience[index].current = true;

      endDateInput.readOnly = true;
      endDateInput.classList.add("input-disabled");
    }
  });

  /* -------------------------------------------------------
     УДАЛЕНИЕ КАРТОЧКИ
  ------------------------------------------------------- */
  deleteBtn.onclick = () => {
    wizardState.experience.splice(index, 1);
    renderExperienceList();
  };
}

/* -------------------------------------------------------
   ДОБАВЛЕНИЕ НОВОЙ КАРТОЧКИ
------------------------------------------------------- */
addExperienceBtn.onclick = () => {
  wizardState.experience.push({
    company: "",
    position: "",
    city: "",
    start_date: "",
    end_date: "",
    description: "",
    technologies: "",
    projects: "",
    employment_type: "",
    current: false
  });

  renderExperienceList();
};

/* -------------------------------------------------------
   ---------- Step 3: Skills (Optimized) ----------
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
limitLength(skillNameInput, 25);
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
   Добавление навыка
------------------------------------------------------- */
function addSkill(name) {
  name = capitalizeFirst(name.trim());
  if (!name) return;

  // Проверка длины названия
  if (name.length > 30) {
    alert("Навык слишком длинный (максимум 30 символов)");
    return;
  }

  // Проверка на дубликаты
  if (
    wizardState.skills.expert.includes(name) ||
    wizardState.skills.used.includes(name) ||
    wizardState.skills.familiar.includes(name)
  ) return;

  wizardState.skills[activeSkillLevel].push(name);

  skillNameInput.value = "";

  renderSkills();
  renderSkillSuggestions();
}

/* -------------------------------------------------------
   Рендер навыков (morphdom + childrenOnly)
------------------------------------------------------- */
function renderSkills() {
  ["expert", "used", "familiar"].forEach(level => {
    const container = getContainer(level);

    const html = wizardState.skills[level]
      .map((name, index) => `
        <div class="skill-pill" data-level="${level}" data-index="${index}">
          <span>${name}</span>
          <button class="skill-remove">✕</button>
        </div>
      `)
      .join("");

    const temp = document.createElement("div");
    temp.innerHTML = html;

    morphdom(container, temp, { childrenOnly: true });
  });
}

/* -------------------------------------------------------
   Делегирование событий — удаление навыков
------------------------------------------------------- */
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".skill-remove");
  if (!btn) return;

  const pill = btn.closest(".skill-pill");
  const level = pill.dataset.level;
  const index = Number(pill.dataset.index);

  wizardState.skills[level].splice(index, 1);

  renderSkills();
  renderSkillSuggestions();
});

/* -------------------------------------------------------
   Рендер рекомендаций (morphdom + childrenOnly)
------------------------------------------------------- */
function renderSkillSuggestions() {
  const html = SKILL_SUGGESTIONS
    .filter(s =>
      !wizardState.skills.expert.includes(s) &&
      !wizardState.skills.used.includes(s) &&
      !wizardState.skills.familiar.includes(s)
    )
    .map(s => `
      <div class="suggestion-pill" data-skill="${s}">
        ${s}
      </div>
    `)
    .join("");

  const temp = document.createElement("div");
  temp.innerHTML = html;

  morphdom(skillsSuggestionsEl, temp, { childrenOnly: true });
}

/* -------------------------------------------------------
   Делегирование кликов по рекомендациям
------------------------------------------------------- */
skillsSuggestionsEl.addEventListener("click", (e) => {
  const pill = e.target.closest("[data-skill]");
  if (!pill) return;

  addSkill(pill.dataset.skill);
});

/* -------------------------------------------------------
   Добавление навыка кнопкой
------------------------------------------------------- */
addSkillBtn.onclick = () => addSkill(skillNameInput.value);

/* -------------------------------------------------------
   Enter → добавить
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
  col.addEventListener("click", () => {
    setActiveSection(col.dataset.level);
  });
});

/* -------------------------------------------------------
   Инициализация
------------------------------------------------------- */
setActiveSection("used");
renderSkills();
renderSkillSuggestions();

/* -------------------------------------------------------
   ---------- Step 4: Education (Optimized) ----------
------------------------------------------------------- */

const educationListEl = document.getElementById("educationList");
const educationTemplate = document.getElementById("educationTemplate");
const addEducationBtn = document.getElementById("addEducationBtn");

/* -------------------------------------------------------
   PATCH‑RENDER СПИСКА ОБРАЗОВАНИЯ
------------------------------------------------------- */
function renderEducationList() {
  const temp = document.createElement("div");

  wizardState.education.forEach((item, index) => {
    const clone = educationTemplate.content.cloneNode(true);
    const card = clone.querySelector(".card");
    card.dataset.index = index;
    temp.appendChild(clone);
  });

  morphdom(educationListEl, temp, { childrenOnly: true });

  // Гидратация карточек
  educationListEl.querySelectorAll(".card").forEach((card, index) => {
    hydrateEducationCard(card, wizardState.education[index], index);
  });
}

// Ограничения длины для всех текстовых полей образования
document.addEventListener("input", (e) => {
  const el = e.target;
  if (!el.dataset.field) return;

  switch (el.dataset.field) {
    case "institution":
    case "degree":
      if (el.value.length > 120) el.value = el.value.slice(0, 120);
      break;

    case "city":
      if (el.value.length > 80) el.value = el.value.slice(0, 80);
      break;

    case "certificate_url":
      if (el.value.length > 200) el.value = el.value.slice(0, 200);
      break;

    case "description":
      if (el.value.length > 350) el.value = el.value.slice(0, 350);
      break;
  }
});

/* -------------------------------------------------------
   ГИДРАТАЦИЯ КАРТОЧКИ (привязка логики)
------------------------------------------------------- */
function hydrateEducationCard(card, data, index) {
  const titleEl = card.querySelector(".card-title");

  titleEl.textContent = data.institution || "Новая запись";

  /* -----------------------------
     ПРИВЯЗКА ПОЛЕЙ
  ------------------------------ */
  const fields = card.querySelectorAll("[data-field]");

  fields.forEach((field) => {
    const key = field.dataset.field;

    /* --- ДАТЫ --- */
    if (key === "start_date" || key === "end_date") {
      field.type = "text";
      field.placeholder = "ДД.ММ.ГГГГ";

      if (data[key]) {
        const [yyyy, mm, dd] = data[key].split("-");
        field.value = `${dd}.${mm}.${yyyy}`;
      }

      attachGlassDatepicker(field, (isoDate) => {
        wizardState.education[index][key] = isoDate;

        const [yyyy, mm, dd] = isoDate.split("-");
        field.value = `${dd}.${mm}.${yyyy}`;

        clearFieldError(field);
      });

      return;
    }

    /* --- ТЕКСТОВЫЕ ПОЛЯ --- */
    field.value = data[key] || "";

    field.oninput = () => {
      const value = capitalizeFirst(field.value);
      field.value = value;
      wizardState.education[index][key] = value;

      if (key === "institution") {
        titleEl.textContent = value || "Новая запись";
      }

      clearFieldError(field);
    };
  });

  /* -------------------------------------------------------
     АВТОКОМПЛИТ УНИВЕРСИТЕТОВ
  ------------------------------------------------------- */
  const institutionInput = card.querySelector('[data-field="institution"]');

  if (institutionInput && !institutionInput._autocompleteAttached) {
    institutionInput._autocompleteAttached = true;

    attachUniversityAutocomplete(institutionInput);

    institutionInput.addEventListener("input", () => {
      const value = capitalizeFirst(institutionInput.value);
      institutionInput.value = value;
      wizardState.education[index].institution = value;
      clearFieldError(institutionInput);
    });

    institutionInput.addEventListener("change", () => {
      const value = capitalizeFirst(institutionInput.value);
      institutionInput.value = value;
      wizardState.education[index].institution = value;
    });
  }

  /* -------------------------------------------------------
     АВТОКОМПЛИТ ГОРОДА
  ------------------------------------------------------- */
  const cityInput = card.querySelector('[data-field="city"]');

  if (cityInput && !cityInput._autocompleteAttached) {
    cityInput._autocompleteAttached = true;

    attachCityAutocomplete(cityInput);

    cityInput.addEventListener("input", () => {
      const value = capitalizeFirst(cityInput.value);
      cityInput.value = value;
      wizardState.education[index].city = value;
      clearFieldError(cityInput);
    });

    cityInput.addEventListener("change", () => {
      const value = capitalizeFirst(cityInput.value);
      cityInput.value = value;
      wizardState.education[index].city = value;
    });
  }

  /* -------------------------------------------------------
     УДАЛЕНИЕ КАРТОЧКИ (делегирование)
  ------------------------------------------------------- */
  const deleteBtn = card.querySelector(".card-delete-btn");

  deleteBtn.onclick = () => {
    wizardState.education.splice(index, 1);
    renderEducationList();
  };
}

/* -------------------------------------------------------
   ДОБАВЛЕНИЕ НОВОЙ КАРТОЧКИ
------------------------------------------------------- */
addEducationBtn.onclick = () => {
  wizardState.education.push({
    institution: "",
    degree: "",
    city: "",
    start_date: "",
    end_date: "",
    certificate_url: "",
    description: ""
  });

  renderEducationList();
};

/* -------------------------------------------------------
   ПЕРВИЧНЫЙ РЕНДЕР
------------------------------------------------------- */
renderEducationList();

// ---------- Save to Supabase ----------

async function saveCV() {
  try {
    setStatus("Сохраняем резюме...");
    nextBtn.disabled = true;
    prevBtn.disabled = true;
    finishBtn.disabled = true;

    // Получаем пользователя
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error(userError);
      setStatus("Не удалось определить пользователя. Перезайди в систему.", true);
      return;
    }

    /* -------------------------------------------------------
       1. Создаём запись CV
    ------------------------------------------------------- */
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

    if (cvError || !cvInsert) {
      console.error(cvError);
      setStatus("Ошибка создания резюме.", true);
      return;
    }

    const cvId = cvInsert.id;
    createdCvId = cvId;

    /* -------------------------------------------------------
       2. ДОЗАПОЛНЯЕМ cv_profiles
    ------------------------------------------------------- */
    const profileUpdate = {
      full_name: wizardState.profile.full_name || null,
      position: wizardState.profile.position || null,
      summary: wizardState.profile.summary || null,
      email: wizardState.profile.email || null,
      phone: wizardState.profile.phone || null,
      linkedin: wizardState.profile.linkedin || null,
      location: wizardState.profile.location || null,
      avatar_url: wizardState.profile.avatar_url || null,

      // дополнительные контакты
      telegram: wizardState.profile.telegram || null,
      github: wizardState.profile.github || null,
      website: wizardState.profile.website || null,
      twitter: wizardState.profile.twitter || null,
      instagram: wizardState.profile.instagram || null,
      facebook: wizardState.profile.facebook || null,
      behance: wizardState.profile.behance || null,
      dribbble: wizardState.profile.dribbble || null
    };

    const { error: cvProfileError } = await supabase
      .from("cv_profiles")
      .update(profileUpdate)
      .eq("cv_id", cvId);

    if (cvProfileError) {
      console.error("cv_profiles update error:", cvProfileError);
    }

    /* -------------------------------------------------------
       3. Преимущества (advantages)
    ------------------------------------------------------- */
    if (wizardState.advantages.length > 0) {
      const advRows = wizardState.advantages.map((tag) => ({
        cv_id: cvId,
        tag
      }));

      const { error: advError } = await supabase
        .from("advantages")
        .insert(advRows);

      if (advError) console.error("advantages error", advError);
    }

    /* -------------------------------------------------------
       4. Опыт (experience)
    ------------------------------------------------------- */
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
        technologies: e.technologies || null,
        projects: e.projects || null,
        employment_type: e.employment_type || null,
        order_index: idx
      }));

      const { error: expError } = await supabase
        .from("experience")
        .insert(expRows);

      if (expError) console.error("experience error", expError);
    }

    /* -------------------------------------------------------
       5. Навыки (skills)
    ------------------------------------------------------- */
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

    if (skillRows.length > 0) {
      const { error: skillError } = await supabase
        .from("skills")
        .insert(skillRows);

      if (skillError) console.error("skills error", skillError);
    }

    /* -------------------------------------------------------
       6. Образование (education)
    ------------------------------------------------------- */
    if (wizardState.education.length > 0) {
      const eduRows = wizardState.education.map((e) => ({
        cv_id: cvId,
        institution: e.institution || null,
        degree: e.degree || null,
        city: e.city || null,
        start_date: e.start_date || null,
        end_date: e.end_date || null,
        certificate_url: e.certificate_url || null,
        description: e.description || null
      }));

      const { error: eduError } = await supabase
        .from("education")
        .insert(eduRows);

      if (eduError) console.error("education error", eduError);
    }

    /* -------------------------------------------------------
       Успех
    ------------------------------------------------------- */
    setStatus("Резюме сохранено.");

    const successViewBtn = document.getElementById("successViewBtn");
    if (successViewBtn && cvId) {
      successViewBtn.setAttribute("href", `/cv/cv-view.html?id=${cvId}`);
    }

    showStep("success");

  } catch (err) {
    console.error(err);
    setStatus("Непредвиденная ошибка при сохранении резюме.", true);
  } finally {
    nextBtn.disabled = false;
    prevBtn.disabled = false;
    finishBtn.disabled = false;
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
  // Универсальная валидация текущего шага
  if (!validateStep(currentStep)) return;

  if (currentStep < 4) {
    currentStep += 1;
    showStep(currentStep);
  }
};

finishBtn.onclick = async () => {
  // Проверяем только шаг 4
  if (!validateStep(4)) return;

  // Сохраняем
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
