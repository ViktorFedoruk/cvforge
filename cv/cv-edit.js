import { supabase } from "../js/supabase.js";
import { generateCVEditorHTML } from "../editor/generate-cv-editor-html.js";

let cvId = null;
let cvData = null;

/* -------------------------------------------------------
   TABLE / COLLECTION MAPS
------------------------------------------------------- */
const TABLES = {
  advantage: "advantages",
  skill: "skills",
  experience: "experience",
  education: "education"
};

const COLLECTIONS = {
  advantage: "advantages",
  skill: "skills",
  experience: "experience",
  education: "education"
};

/* -------------------------------------------------------
   BASIC HELPERS — UNIFIED & CLEAN
------------------------------------------------------- */

/* Нормализация дат (dd.mm.yyyy → yyyy-mm-dd) */
function normalizeDate(value) {
  if (!value) return null;
  if (!/^\d{2}\.\d{2}\.\d{4}$/.test(value)) return null;

  const [dd, mm, yyyy] = value.split(".");
  const iso = `${yyyy}-${mm}-${dd}`;

  const d = new Date(iso);
  return isNaN(d) ? null : iso;
}

/* Универсальный getter для input/textarea по data-field */
function getValue(field) {
  const el = document.querySelector(`[data-field="${field}"]`);
  return el ? el.value.trim() : "";
}

/* Старый механизм для опыт/образование (data-exp-company="ID") */
function getInput(selector) {
  return document.querySelector(`[${selector}]`)?.value || "";
}

/* ------------------------------------------------------------
   VALIDATION UTILITIES (EDITOR)
------------------------------------------------------------ */

function limitLength(input, max) {
  input.addEventListener("input", () => {
    if (input.value.length > max) {
      input.value = input.value.slice(0, max);
    }
  });
}

function sanitizePhone(input) {
  input.addEventListener("input", () => {
    input.value = input.value.replace(/[^\d+()\-\s]/g, "");
  });
}

function sanitizeContact(input) {
  input.addEventListener("input", () => {
    input.value = input.value.replace(/[^\w\-./:@]/g, "");
  });
}

function showFieldError(input, msg) {
  const field = getEditorFieldContainer(input);
  const err = field.querySelector(".error-msg");

  if (err) err.textContent = msg;
  field.classList.add("has-error");
}

function clearFieldError(input) {
  const field = getEditorFieldContainer(input);
  const err = field.querySelector(".error-msg");

  if (err) err.textContent = "";
  field.classList.remove("has-error");
}

/* ------------------------------------------------------------
   DATA VALIDATION (EDITOR)
------------------------------------------------------------ */

function validateProfileData(profile) {
  const errors = [];

  if (!profile.full_name || !profile.full_name.trim()) {
    errors.push({ field: "full_name", msg: "Введите имя и фамилию" });
  }

  if (!profile.position || !profile.position.trim()) {
    errors.push({ field: "position", msg: "Введите желаемую должность" });
  }

  if (profile.email) {
    if (profile.email.length > 120) {
      errors.push({ field: "email", msg: "Email слишком длинный" });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
      errors.push({ field: "email", msg: "Некорректный email" });
    }
  }

  if (profile.phone) {
    const digits = profile.phone.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) {
      errors.push({ field: "phone", msg: "Некорректный номер телефона" });
    }
  }

  const contactFields = [
    "telegram", "github", "website",
    "twitter", "instagram", "facebook",
    "behance", "dribbble"
  ];

  contactFields.forEach(key => {
    if (profile[key] && profile[key].length > 100) {
      errors.push({ field: key, msg: `Поле ${key} слишком длинное` });
    }
  });

  if (profile.summary && profile.summary.length > 350) {
    errors.push({ field: "summary", msg: "Описание слишком длинное (максимум 350 символов)" });
  }

  return errors;
}

function validateExperienceData(experienceList) {
  const errors = [];

  experienceList.forEach((exp, i) => {
    const prefix = `exp_${i}`;

    if (!exp.company || !exp.company.trim()) {
      errors.push({ field: `${prefix}_company`, msg: `Опыт #${i + 1}: укажите компанию` });
    }

    if (!exp.position || !exp.position.trim()) {
      errors.push({ field: `${prefix}_position`, msg: `Опыт #${i + 1}: укажите должность` });
    }

    if (!exp.start_date || !exp.start_date.trim()) {
      errors.push({ field: `${prefix}_start`, msg: `Опыт #${i + 1}: укажите дату начала` });
    }

    const current = exp.current || !exp.end_date;

    if (!current) {
      if (!exp.end_date || !exp.end_date.trim()) {
        errors.push({ field: `${prefix}_end`, msg: `Опыт #${i + 1}: укажите дату окончания` });
      } else if (exp.start_date && exp.end_date < exp.start_date) {
        errors.push({ field: `${prefix}_end`, msg: `Опыт #${i + 1}: дата окончания раньше начала` });
      }
    }
  });

  return errors;
}

function validateSkillsData(skills) {
  const errors = [];

  const levels = ["expert", "used", "familiar"];

  levels.forEach(level => {
    if (skills[level].length > 15) {
      errors.push(`В секции "${level}" слишком много навыков (максимум 15)`);
    }

    skills[level].forEach(name => {
      if (name.length > 30) {
        errors.push(`Навык "${name}" слишком длинный (максимум 30 символов)`);
      }
    });
  });

  return errors;
}

function validateEducationData(educationList) {
  const errors = [];

  educationList.forEach((edu, i) => {
    const prefix = `edu_${i}`;

    if (edu.start_date && edu.end_date && edu.end_date < edu.start_date) {
      errors.push({ field: `${prefix}_end`, msg: `Образование #${i + 1}: дата окончания раньше начала` });
    }

    if (edu.institution && edu.institution.length > 120) {
      errors.push({ field: `${prefix}_inst`, msg: `Образование #${i + 1}: слишком длинное название` });
    }
  });

  return errors;
}

function validateFullCV(cv) {
  const errors = [];

  // === NEW: validate CV title ===
  if (!cv.title || !cv.title.trim()) {
    errors.push({ field: "title", msg: "Введите название резюме" });
  }

  errors.push(...validateProfileData(cv.cv_profile));
  errors.push(...validateExperienceData(cv.experience));

  const skillsByLevel = {
    expert: cv.skills.filter(s => s.level === "expert").map(s => s.name),
    used: cv.skills.filter(s => s.level === "used").map(s => s.name),
    familiar: cv.skills.filter(s => s.level === "familiar").map(s => s.name)
  };
  errors.push(...validateSkillsData(skillsByLevel));

  errors.push(...validateEducationData(cv.education));

  return errors;
}

function highlightEditorErrors(errors) {
  console.log("🔥 highlightEditorErrors — входящие ошибки:", errors);

  // Очистка
  document.querySelectorAll(".editor-section .has-error").forEach(el => {
    el.classList.remove("has-error");
  });
  document.querySelectorAll(".editor-section .error-msg").forEach(el => {
    el.textContent = "";
  });

  if (!errors || errors.length === 0) return;

  // === TITLE ===
  const titleInput = document.querySelector('[data-field="cv.title"]');
  if (titleInput) {
    const err = errors.find(e => e.field === "title");
    if (err) showFieldError(titleInput, err.msg);
  }

  // === PROFILE FIELDS ===
  document.querySelectorAll("[data-field]").forEach(input => {
    const key = input.dataset.field.replace("cv_profile.", "").replace("cv.", "");
    const err = errors.find(e => e.field === key);
    if (err) showFieldError(input, err.msg);
  });

  // === EXPERIENCE ===
  document.querySelectorAll("[data-exp-company]").forEach((input, i) => {
    const err = errors.find(e => e.field === `exp_${i}_company`);
    if (err) showFieldError(input, err.msg);
  });

  document.querySelectorAll("[data-exp-position]").forEach((input, i) => {
    const err = errors.find(e => e.field === `exp_${i}_position`);
    if (err) showFieldError(input, err.msg);
  });

  document.querySelectorAll("[data-exp-start]").forEach((input, i) => {
    const err = errors.find(e => e.field === `exp_${i}_start`);
    if (err) showFieldError(input, err.msg);
  });

  document.querySelectorAll("[data-exp-end]").forEach((input, i) => {
    const err = errors.find(e => e.field === `exp_${i}_end`);
    if (err) showFieldError(input, err.msg);
  });

  // === EDUCATION ===
  document.querySelectorAll("[data-edu-inst]").forEach((input, i) => {
    const err = errors.find(e => e.field === `edu_${i}_inst`);
    if (err) showFieldError(input, err.msg);
  });

  document.querySelectorAll("[data-edu-end]").forEach((input, i) => {
    const err = errors.find(e => e.field === `edu_${i}_end`);
    if (err) showFieldError(input, err.msg);
  });
}

function getEditorFieldContainer(input) {
  // 1) если есть .position-input-wrapper — используем его
  if (input.closest(".position-input-wrapper")) {
    return input.closest(".position-input-wrapper");
  }

  // 2) если есть .city-input-wrapper — используем его
  if (input.closest(".city-input-wrapper")) {
    return input.closest(".city-input-wrapper");
  }

  // 3) если есть .university-input-wrapper — используем его
  if (input.closest(".university-input-wrapper")) {
    return input.closest(".university-input-wrapper");
  }

  // 4) если поле внутри опыта
  if (input.closest(".editor-exp-block")) {
    return input.parentElement;
  }

  // 5) если поле внутри образования
  if (input.closest(".editor-edu-block")) {
    return input.parentElement;
  }

  // 6) fallback — обычный div
  return input.parentElement;
}

/* ========================================================
   AUTO CAPITALIZE
======================================================== */
function attachAutoCapitalize(root = document) {
  const inputs = root.querySelectorAll(
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

/* ========================================================
   CITY AUTOCOMPLETE
======================================================== */

let allCities = [];
let citiesLoaded = false;
let cityDropdown = null;
let activeCityInput = null;

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

function hideCityDropdown() {
  if (cityDropdown) cityDropdown.remove();
  cityDropdown = null;
  activeCityInput = null;
}

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

/* ========================================================
   UNIVERSITY AUTOCOMPLETE
======================================================== */

let allUniversities = [];
let universitiesLoaded = false;

let universityDropdown = null;
let activeUniversityInput = null;

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

function translitUni(str) {
  const map = {
    "а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ё":"yo","ж":"zh","з":"z",
    "и":"i","й":"y","к":"k","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r",
    "с":"s","т":"t","у":"u","ф":"f","х":"h","ц":"ts","ч":"ch","ш":"sh","щ":"sch",
    "ы":"y","э":"e","ю":"yu","я":"ya"
  };
  return str.toLowerCase().split("").map(ch => map[ch] || ch).join("");
}

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

async function searchUniversities(query) {
  let q = query.trim().toLowerCase();
  if (!q) return [];

  await loadUniversities();

  if (UNI_ABBR[q]) q = UNI_ABBR[q];
  if (/[а-я]/i.test(q)) q = translitUni(q);

  return allUniversities
    .filter(u => u.name.toLowerCase().includes(q))
    .slice(0, 20)
    .map(u => u.full);
}

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

/* ========================================================
   JOB TITLES AUTOCOMPLETE (адаптация для редактора)
======================================================== */

let JOB_TITLES = [];

/* Загружаем список должностей */
async function loadJobTitles() {
  const { data, error } = await supabase
    .from("job_titles")
    .select("*")
    .order("weight", { ascending: false });

  if (!error && data) JOB_TITLES = data;
}

loadJobTitles();

/* Поиск по должностям */
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

/* Рендер подсказок */
function renderPositionSuggestions(list, container, inputEl) {
  if (!list.length) {
    container.style.display = "none";
    return;
  }

  container.innerHTML = "";
  container.style.display = "block";

  list.forEach(item => {
    const div = document.createElement("div");
    div.className = "position-suggestion";
    div.textContent = `${item.ru} / ${item.en}`;

    div.onclick = () => {
      inputEl.value = item.ru;
      inputEl.dispatchEvent(new Event("input"));
      container.style.display = "none";
    };

    container.appendChild(div);
  });
}

/* Подключение автокомплита к конкретному input */
function attachJobTitleAutocomplete(inputEl) {
  if (!inputEl) return;

  const container = inputEl.closest(".position-input-wrapper")
    ?.querySelector(".position-suggestions");

  if (!container) return;

  inputEl.addEventListener("input", () => {
    const q = inputEl.value.trim();

    if (!q) {
      container.innerHTML = "";
      container.style.display = "none";
      return;
    }

    const results = searchJobTitles(q);
    renderPositionSuggestions(results, container, inputEl);
  });

  inputEl.addEventListener("blur", () => {
    setTimeout(() => {
      container.style.display = "none";
    }, 150);
  });
}

/* =========================================================
   GLASS DATEPICKER
========================================================= */

let dp = null;
let dpTargetInput = null;
let dpDate = null; // теперь null, чтобы понимать "нет выбранной даты"

const monthsRU = [
  "Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"
];

const weekdaysRU = ["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];

function openMenu(menu) {
  document.querySelectorAll(".gdp-menu").forEach(m => {
    if (m !== menu) m.classList.add("hidden");
  });
  menu.classList.toggle("hidden");

  // Если открываем меню годов — скроллим к нужному году
  if (menu.classList.contains("gdp-year-menu") && !menu.classList.contains("hidden")) {
    scrollYearMenu(menu);
  }
}

function closeAllMenus() {
  document.querySelectorAll(".gdp-menu").forEach(m => m.classList.add("hidden"));
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".gdp-dropdown")) closeAllMenus();
});

/* --------------------------------------------------------
   Скролл к текущему или выбранному году
-------------------------------------------------------- */
function scrollYearMenu(yearMenu) {
  const activeItem = yearMenu.querySelector(".gdp-menu-item.active");
  if (!activeItem) return;

  requestAnimationFrame(() => {
    const offset = activeItem.offsetTop - yearMenu.clientHeight / 2 + activeItem.clientHeight / 2;
    yearMenu.scrollTop = Math.max(offset, 0);
  });
}

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

  weekdaysEl.innerHTML = weekdaysRU.map(d => `<div>${d}</div>`).join("");

  /* -----------------------------
     Определяем dpDate
  ------------------------------ */
  if (!dpDate) {
    // если даты нет — используем текущую
    dpDate = new Date();
  }

  const selectedYear = dpDate.getFullYear();
  const selectedMonth = dpDate.getMonth();

  monthBtn.textContent = monthsRU[selectedMonth];
  yearBtn.textContent = selectedYear;

  /* -----------------------------
     Месяцы
  ------------------------------ */
  monthMenu.innerHTML = monthsRU
    .map((m, i) => `
      <div class="gdp-menu-item ${i === selectedMonth ? "active" : ""}" data-month="${i}">
        ${m}
      </div>
    `)
    .join("");

  /* -----------------------------
     Годы
  ------------------------------ */
  const currentYear = new Date().getFullYear();
  let yearsHTML = "";

  for (let y = currentYear - 50; y <= currentYear + 0; y++) {
    yearsHTML += `
      <div class="gdp-menu-item ${y === selectedYear ? "active" : ""}" data-year="${y}">
        ${y}
      </div>`;
  }

  yearMenu.innerHTML = yearsHTML;

  /* -----------------------------
     Обработчики выбора месяца/года
  ------------------------------ */
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

  /* -----------------------------
     Дни месяца
  ------------------------------ */
  const firstDay = new Date(selectedYear, selectedMonth, 1);
  const lastDay = new Date(selectedYear, selectedMonth + 1, 0);

  const startOffset = (firstDay.getDay() + 6) % 7;

  let html = "";

  for (let i = 0; i < startOffset; i++) html += `<div></div>`;

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const yyyy = selectedYear;
    const mm = String(selectedMonth + 1).padStart(2, "0");
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

  daysEl.querySelectorAll(".gdp-day").forEach(day => {
    day.onclick = () => {
      if (dpTargetInput.disabled) return;

      const ru = day.dataset.ru;
      dpTargetInput.value = ru;

      if (dpTargetInput._onSelect) {
        dpTargetInput._onSelect(day.dataset.iso);
      }

      dp.classList.add("hidden");
    };
  });
}

/* --------------------------------------------------------
   ПОДКЛЮЧЕНИЕ К ИНПУТУ
-------------------------------------------------------- */
function attachGlassDatepicker(input, onSelect) {
  input.type = "text";
  input.placeholder = "ДД.ММ.ГГГГ";
  input._onSelect = onSelect;

  /* -----------------------------
     Форматирование ввода
  ------------------------------ */
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

  /* -----------------------------
     Открытие календаря
  ------------------------------ */
  input.addEventListener("click", () => {
    if (input.disabled) return;

    dpTargetInput = input;

    // Если в инпуте есть дата — используем её
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(input.value)) {
      const [dd, mm, yyyy] = input.value.split(".");
      dpDate = new Date(`${yyyy}-${mm}-${dd}`);
    } else {
      dpDate = null; // нет выбранной даты → используем текущую
    }

    const rect = input.getBoundingClientRect();
    const dpRect = dp.getBoundingClientRect();

    let top = rect.bottom + window.scrollY + 8;
    let left = rect.left + window.scrollX;

    if (left + dpRect.width > window.scrollX + window.innerWidth - 10) {
      left = window.scrollX + window.innerWidth - dpRect.width - 10;
    }

    if (top + dpRect.height > window.scrollY + window.innerHeight - 10) {
      top = rect.top + window.scrollY - dpRect.height - 8;
    }

    dp.style.top = top + "px";
    dp.style.left = left + "px";

    dp.classList.remove("hidden");
    renderGlassDatepicker();
  });

  /* -----------------------------
     Закрытие при потере фокуса
  ------------------------------ */
  input.addEventListener("blur", () => {
    setTimeout(() => {
      if (!dp.contains(document.activeElement)) {
        dp.classList.add("hidden");
      }
    }, 150);
  });
}

/* -----------------------------
   Глобальное закрытие при клике вне
------------------------------ */
document.addEventListener("mousedown", (e) => {
  if (!dp) return;

  if (
    !e.target.closest("#glassDatepicker") &&
    !e.target.closest("[data-date-input]")
  ) {
    dp.classList.add("hidden");
    dpTargetInput = null;
  }
});

/* -------------------------------------------------------
   CUSTOM SELECT — EDITOR VERSION
------------------------------------------------------- */
window.employmentTypeLabel = function(value) {
  const map = {
    "": "Не указано",
    full_time: "Полная занятость",
    part_time: "Частичная занятость",
    contract: "Контракт",
    internship: "Стажировка",
    freelance: "Фриланс"
  };
  return map[value] || "Не указано";
};

/* ========================================================
   AVATAR UPLOAD + CROP (EDITOR VERSION)
======================================================== */

let avatarObjectUrl = null;

/* Обновление кнопок */
function updateAvatarButtonsEditor(hasAvatar) {
  const uploadBtn = document.getElementById("avatar_upload_btn");
  const changeBtn = document.getElementById("avatar_change_btn");
  const deleteBtn = document.getElementById("avatar_delete_btn");

  if (!uploadBtn || !changeBtn || !deleteBtn) return;

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

/* Сброс аватара */
function resetAvatarEditor() {
  const preview = document.getElementById("avatar_preview");
  if (preview) {
    preview.innerHTML = `<i class="fa-solid fa-user"></i>`;
    preview.classList.remove("has-image");
  }

  cvData.cv_profile.avatar_url = null;
  localStorage.removeItem("cv_avatar");

  updateAvatarButtonsEditor(false);
}

/* -------------------------------------------------------
   ПОДКЛЮЧЕНИЕ КНОПОК
------------------------------------------------------- */
function attachAvatarEditorEvents() {
  const uploadBtn = document.getElementById("avatar_upload_btn");
  const changeBtn = document.getElementById("avatar_change_btn");
  const deleteBtn = document.getElementById("avatar_delete_btn");
  const avatarFileInput = document.getElementById("avatar_file");
  const avatarErrorEl = document.getElementById("avatar_error");

  if (!uploadBtn || !changeBtn || !deleteBtn || !avatarFileInput) return;

  uploadBtn.onclick = () => avatarFileInput.click();
  changeBtn.onclick = () => avatarFileInput.click();

  deleteBtn.onclick = () => {
    resetAvatarEditor();
    avatarFileInput.value = "";
    if (avatarErrorEl) avatarErrorEl.textContent = "";
  };

  avatarFileInput.onchange = async () => {
    const file = avatarFileInput.files[0];
    if (!file) return;

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      if (avatarErrorEl) {
        avatarErrorEl.textContent = "Можно загружать только JPG, PNG или WEBP.";
      }
      avatarFileInput.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      if (avatarErrorEl) {
        avatarErrorEl.textContent = "Размер файла не должен превышать 5MB.";
      }
      avatarFileInput.value = "";
      return;
    }

    if (avatarErrorEl) avatarErrorEl.textContent = "";
    openAvatarCropperModalEditor(file);
  };
}

/* -------------------------------------------------------
   МОДАЛКА КРОППЕРА (EDITOR)
------------------------------------------------------- */
function openAvatarCropperModalEditor(file) {
  const modal = document.getElementById("avatarCropModal");
  const cropArea = document.getElementById("avatarCropArea");
  const zoomInput = document.getElementById("avatarZoom");
  const cancelBtn = document.getElementById("avatarCancel");
  const applyBtn = document.getElementById("avatarApply");

  if (!modal || !cropArea || !zoomInput || !cancelBtn || !applyBtn) return;

  modal.style.display = "flex";
  cropArea.innerHTML = "";

  if (avatarObjectUrl) URL.revokeObjectURL(avatarObjectUrl);
  avatarObjectUrl = URL.createObjectURL(file);

  const overlay = document.createElement("div");
  overlay.className = "avatar-crop-overlay";
  cropArea.appendChild(overlay);

  const img = document.createElement("img");
  img.src = avatarObjectUrl;
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

  img.onload = () => {
    const rect = cropArea.getBoundingClientRect();

    const minW = 240 / img.naturalWidth;
    const minH = 240 / img.naturalHeight;
    minZoom = Math.max(minW, minH);

    const scale = Math.min(rect.width / img.naturalWidth, rect.height / img.naturalHeight);

    zoom = Math.max(scale, minZoom);
    zoomInput.value = zoom.toFixed(2);
    zoomInput.min = minZoom;

    imgX = (rect.width - img.naturalWidth * zoom) / 2;
    imgY = (rect.height - img.naturalHeight * zoom) / 2;

    clampPosition();
    updateTransform();
  };

  cropArea.onwheel = e => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    const newZoom = Math.min(Math.max(zoom + delta, minZoom), 5);

    const rect = cropArea.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    const px = (cx - imgX) / zoom;
    const py = (cy - imgY) / zoom;

    zoom = newZoom;
    zoomInput.value = zoom.toFixed(2);

    imgX = cx - px * zoom;
    imgY = cy - py * zoom;

    clampPosition();
    updateTransform();
  };

  zoomInput.oninput = () => {
    let newZoom = parseFloat(zoomInput.value);
    if (newZoom < minZoom) {
      zoomInput.value = minZoom;
      return;
    }

    const rect = cropArea.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    const px = (cx - imgX) / zoom;
    const py = (cy - imgY) / zoom;

    zoom = newZoom;

    imgX = cx - px * zoom;
    imgY = cy - py * zoom;

    clampPosition();
    updateTransform();
  };

  let isMouseDown = false;
  let lastX = 0;
  let lastY = 0;

  cropArea.addEventListener("mousedown", e => {
    e.preventDefault();
    isMouseDown = true;
    lastX = e.clientX;
    lastY = e.clientY;
    cropArea.classList.add("dragging");
  });

  document.addEventListener("mousemove", e => {
    if (!isMouseDown) return;

    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;

    imgX += dx;
    imgY += dy;

    lastX = e.clientX;
    lastY = e.clientY;

    clampPosition();
    updateTransform();
  });

  document.addEventListener("mouseup", () => {
    isMouseDown = false;
    cropArea.classList.remove("dragging");
  });

  cancelBtn.onclick = () => {
    modal.style.display = "none";
    if (avatarObjectUrl) URL.revokeObjectURL(avatarObjectUrl);
    avatarObjectUrl = null;
  };

  applyBtn.onclick = async () => {
    const canvas = document.createElement("canvas");
    const size = 240;
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");

    const rect = cropArea.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    const srcX = (cx - imgX - size / 2) / zoom;
    const srcY = (cy - imgY - size / 2) / zoom;

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

    modal.style.display = "none";
    await saveAvatarEditor(blob);
  };
}

/* ========================================================
   AVATAR CACHE FOR EDITOR — FIXED (URL‑scoped)
======================================================== */

async function blobToBase64Editor(blob) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

function setEditorAvatarSrc(base64) {
  const img = document.querySelector(".editor-avatar-img");
  if (img) img.src = base64;
}

async function loadAvatarWithCacheEditor(url) {
  if (!url) return;

  // 🔑 Привязываем кэш к конкретному URL (а значит — к конкретному резюме)
  const cacheKey = `cv_avatar_${url}`;
  const cached = JSON.parse(localStorage.getItem(cacheKey) || "{}");

  // 1. Показываем кэш мгновенно
  if (cached.base64) {
    setEditorAvatarSrc(cached.base64);
  }

  // 2. Проверяем ETag
  let newETag = null;
  try {
    const head = await fetch(url, { method: "HEAD" });
    newETag = head.headers.get("ETag");
  } catch {}

  if (cached.eTag === newETag && cached.base64) {
    return; // кэш актуален
  }

  // 3. Загружаем новый аватар
  try {
    const blob = await fetch(url).then(r => r.blob());
    const base64 = await blobToBase64Editor(blob);

    // 4. Обновляем кэш (теперь уникальный для каждого URL)
    localStorage.setItem(
      cacheKey,
      JSON.stringify({
        base64,
        eTag: newETag
      })
    );

    // 5. Обновляем UI
    setEditorAvatarSrc(base64);
  } catch {}
}

/* -------------------------------------------------------
   СОХРАНЕНИЕ В SUPABASE
------------------------------------------------------- */
async function saveAvatarEditor(blob) {
  // 1. Получаем cvId из редактора
  const cvId = cvData?.cv?.id;
  if (!cvId) {
    console.error("saveAvatarEditor: cvId not found");
    return;
  }

  // 2. Формируем путь
  const fileName = `avatar_${Date.now()}.png`;
  const filePath = `${cvId}/${fileName}`;

  // 3. Загружаем файл
  const { error } = await supabase.storage
    .from("avatars")
    .upload(filePath, blob, { upsert: true });

  if (error) {
    console.error("Avatar upload error:", error);
    resetAvatarEditor();
    return;
  }

  // 4. Получаем публичный URL
  const publicUrl = supabase.storage
    .from("avatars")
    .getPublicUrl(filePath).data.publicUrl;

  // 5. Обновляем данные резюме
  cvData.cv_profile.avatar_url = publicUrl;

  // 6. Конвертируем blob → base64 для локального кэша
  const base64 = await blobToBase64Editor(blob);

  localStorage.setItem("cv_avatar", JSON.stringify({
    base64,
    eTag: null
  }));

  // 7. Обновляем UI
  const preview = document.getElementById("avatar_preview");
  if (preview) {
    preview.innerHTML = `<img class="editor-avatar-img" src="${base64}" alt="avatar">`;
    preview.classList.add("has-image");
  }

  updateAvatarButtonsEditor(true);
}

/* ========================================================
   ADVANTAGES — EDITOR VERSION
======================================================== */

/* Подключение событий для advantages */
function attachAdvantagesEditorEvents(root) {
  const addBtn = root.querySelector("[data-add='advantage']");
  const input = root.querySelector("#advantageInput");

  if (addBtn && input) {
    addBtn.onclick = async () => {
      const value = input.value.trim();
      if (!value) return;

      const { data } = await supabase
        .from("advantages")
        .insert({ cv_id: cvId, tag: value })
        .select()
        .single();

      cvData.advantages.push(data);
      input.value = "";
      renderEditor();
    };

    input.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        addBtn.click();
      }
    });
  }
}

/* ========================================================
   EXPERIENCE — EDITOR VERSION
======================================================== */

/* -------------------------------------------------------
   Подключение событий для блока опыта
------------------------------------------------------- */
function attachExperienceEditorEvents(root) {
  /* -----------------------------
     Добавление нового опыта
  ------------------------------ */
  const addBtn = root.querySelector("[data-add='experience']");
  if (addBtn) {
    addBtn.onclick = async () => {
      const { data } = await supabase
        .from("experience")
        .insert({
          cv_id: cvId,
          company: "",
          position: "",
          city: "",
          start_date: null,
          end_date: null,
          description: "",
          technologies: "",
          projects: "",
          employment_type: "",
          current: false,
          order_index: cvData.experience.length
        })
        .select()
        .single();

      cvData.experience.push(data);
      renderEditor();
    };
  }

  /* -----------------------------
     Удаление опыта
  ------------------------------ */
  root.querySelectorAll("[data-delete-exp]").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.deleteExp;

      await supabase.from("experience").delete().eq("id", id);
      cvData.experience = cvData.experience.filter(e => e.id !== id);

      renderEditor();
    };
  });

  /* -----------------------------
     Редактирование текстовых полей
  ------------------------------ */
  root.querySelectorAll("[data-exp-company]").forEach(input => {
    input.oninput = () => {
      const id = input.dataset.expCompany;
      cvData.experience.find(e => e.id === id).company = input.value;
    };
  });

  root.querySelectorAll("[data-exp-position]").forEach(input => {
    input.oninput = () => {
      const id = input.dataset.expPosition;
      cvData.experience.find(e => e.id === id).position = input.value;
    };
  });

  root.querySelectorAll("[data-exp-description]").forEach(input => {
    input.oninput = () => {
      const id = input.dataset.expDescription;
      cvData.experience.find(e => e.id === id).description = input.value;
    };
  });

  /* -----------------------------
     Новые поля: technologies
  ------------------------------ */
  root.querySelectorAll("[data-exp-tech]").forEach(input => {
    input.oninput = () => {
      const id = input.dataset.expTech;
      cvData.experience.find(e => e.id === id).technologies = input.value;
    };
  });

  /* -----------------------------
     Новые поля: projects
  ------------------------------ */
  root.querySelectorAll("[data-exp-projects]").forEach(input => {
    input.oninput = () => {
      const id = input.dataset.expProjects;
      cvData.experience.find(e => e.id === id).projects = input.value;
    };
  });

  /* -----------------------------
    Тип занятости — новый селект
  ------------------------------ */
  root.querySelectorAll("[data-exp-type]").forEach(wrapper => {
    const id = wrapper.dataset.expType;
    const item = cvData.experience.find(e => e.id === id);

    const input = wrapper.querySelector(".select-input");
    const dropdown = wrapper.querySelector(".select-input-dropdown");
    const options = wrapper.querySelectorAll(".select-option");

    function toggle() {
      document.querySelectorAll(".select-input-wrapper.active")
        .forEach(el => el.classList.remove("active"));
      wrapper.classList.toggle("active");
    }

    input.addEventListener("click", e => {
      e.stopPropagation();
      toggle();
    });

    options.forEach(opt => {
      opt.addEventListener("click", e => {
        e.stopPropagation();

        const val = opt.dataset.value;
        item.employment_type = val;

        input.value = employmentTypeLabel(val);

        wrapper.classList.remove("active");
      });
    });
  });

  /* Закрытие всех селектов при клике вне */
  document.addEventListener("click", () => {
    document.querySelectorAll(".select-input-wrapper.active")
      .forEach(el => el.classList.remove("active"));
  });

  /* -----------------------------
     Автокомплит города
  ------------------------------ */
  root.querySelectorAll("[data-exp-city]").forEach(input => {
    attachCityAutocomplete(input);

    input.oninput = () => {
      const id = input.dataset.expCity;
      cvData.experience.find(e => e.id === id).city = input.value;
    };
  });

  /* -----------------------------
     Даты + datepicker
  ------------------------------ */
  root.querySelectorAll("[data-exp-start]").forEach(input => {
    attachGlassDatepicker(input, iso => {
      const id = input.dataset.expStart;
      cvData.experience.find(e => e.id === id).start_date = iso;
    });
  });

  root.querySelectorAll("[data-exp-end]").forEach(input => {
    attachGlassDatepicker(input, iso => {
      const id = input.dataset.expEnd;
      const item = cvData.experience.find(e => e.id === id);

      item.end_date = iso;

      // Если выбрана дата окончания → снимаем чекбокс
      const checkbox = root.querySelector(`[data-exp-current="${id}"]`);
      if (checkbox) {
        checkbox.checked = false;
        item.current = false;

        input.readOnly = false;
        input.classList.remove("input-disabled");
      }
    });
  });

  /* -----------------------------
     Чекбокс "Работаю здесь"
     (фикс: readOnly вместо disabled)
  ------------------------------ */
  root.querySelectorAll("[data-exp-current]").forEach(checkbox => {
    checkbox.onchange = () => {
      const id = checkbox.dataset.expCurrent;
      const item = cvData.experience.find(e => e.id === id);
      const endInput = root.querySelector(`[data-exp-end="${id}"]`);

      item.current = checkbox.checked;

      if (checkbox.checked) {
        item.end_date = null;
        endInput.value = "";
        endInput.readOnly = true;
        endInput.classList.add("input-disabled");
      } else {
        endInput.readOnly = false;
        endInput.classList.remove("input-disabled");
      }
    };
  });

  /* -----------------------------
     Авто‑синхронизация:
     если стерли дату окончания → current = true
  ------------------------------ */
  root.querySelectorAll("[data-exp-end]").forEach(input => {
    input.addEventListener("input", () => {
      const id = input.dataset.expEnd;
      const item = cvData.experience.find(e => e.id === id);
      const checkbox = root.querySelector(`[data-exp-current="${id}"]`);

      if (!input.value.trim()) {
        checkbox.checked = true;
        item.current = true;

        input.readOnly = true;
        input.classList.add("input-disabled");
      }
    });
  });
}

/* ========================================================
   SKILLS — EDITOR VERSION
======================================================== */

let activeSkillLevel = "used"; // активная колонка по умолчанию

function attachSkillsEditorEvents(root) {

  /* -----------------------------
     Добавление навыка
  ------------------------------ */
  const addBtn = root.querySelector("[data-add='skill']");
  const input = root.querySelector("#skillNameInput");

  if (addBtn && input) {
    addBtn.onclick = async () => {
      const raw = input.value || "";
      const name = raw.trim();
      const placeholder = (input.placeholder || "").trim();

      // защита от пустых значений и placeholder
      if (!name || name === placeholder) {
        input.value = "";
        return;
      }

      const { data, error } = await supabase
        .from("skills")
        .insert({
          cv_id: cvId,
          name,
          level: activeSkillLevel   // ← добавляем в активную колонку
        })
        .select()
        .single();

      if (error) {
        console.error("Skill insert error:", error);
        return;
      }

      cvData.skills.push(data);

      input.value = "";

      renderEditor();
    };

    // Enter → добавить
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        addBtn.click();
      }
    });
  }

  /* -----------------------------
     Удаление навыка
  ------------------------------ */
  root.querySelectorAll("[data-delete-skill]").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.deleteSkill;

      await supabase.from("skills").delete().eq("id", id);
      cvData.skills = cvData.skills.filter(s => s.id !== id);

      renderEditor();
    };
  });

  /* -----------------------------
     DRAG & DROP
  ------------------------------ */

  let draggedSkillId = null;

  root.querySelectorAll(".skill-pill").forEach(pill => {
    pill.addEventListener("dragstart", e => {
      draggedSkillId = pill.dataset.skillId;
      e.dataTransfer.effectAllowed = "move";
      pill.classList.add("dragging");
    });

    pill.addEventListener("dragend", () => {
      pill.classList.remove("dragging");
      draggedSkillId = null;

      root.querySelectorAll(".skills-column").forEach(col =>
        col.classList.remove("active-drop")
      );
    });
  });

  root.querySelectorAll(".skills-list").forEach(list => {
    const column = list.closest(".skills-column");

    list.addEventListener("dragover", e => {
      e.preventDefault();
      column.classList.add("active-drop");
    });

    list.addEventListener("dragleave", () => {
      column.classList.remove("active-drop");
    });

    list.addEventListener("drop", async e => {
      e.preventDefault();
      column.classList.remove("active-drop");

      if (!draggedSkillId) return;

      const newLevel = list.dataset.skillList;
      const skill = cvData.skills.find(s => s.id === draggedSkillId);

      if (!skill) return;
      if (skill.level === newLevel) return;

      const { error } = await supabase
        .from("skills")
        .update({ level: newLevel })
        .eq("id", draggedSkillId);

      if (error) {
        console.error("Skill update error:", error);
        return;
      }

      skill.level = newLevel;
      renderEditor();
    });
  });

  /* -----------------------------
     Клик по колонке → активная
  ------------------------------ */
  root.querySelectorAll(".skills-column").forEach(col => {
    col.addEventListener("click", () => {
      activeSkillLevel = col.dataset.level;

      root.querySelectorAll(".skills-column").forEach(c =>
        c.classList.remove("active")
      );

      col.classList.add("active");
    });
  });

  /* -----------------------------
     Восстановление активной колонки после renderEditor()
  ------------------------------ */
  const activeCol = root.querySelector(`.skills-column[data-level="${activeSkillLevel}"]`);
  if (activeCol) activeCol.classList.add("active");
}

/* ========================================================
   EDUCATION — EDITOR VERSION
======================================================== */
/* -------------------------------------------------------
   Подключение событий для блока образования
------------------------------------------------------- */
function attachEducationEditorEvents(root) {
  /* -----------------------------
     Добавление новой записи
  ------------------------------ */
  const addBtn = root.querySelector("[data-add='education']");
  if (addBtn) {
    addBtn.onclick = async () => {
      const { data } = await supabase
        .from("education")
        .insert({
          cv_id: cvId,
          institution: "",
          degree: "",
          city: "",
          start_date: null,
          end_date: null,
          description: ""
        })
        .select()
        .single();

      cvData.education.push(data);
      renderEditor();
    };
  }

  /* -----------------------------
     Удаление записи
  ------------------------------ */
  root.querySelectorAll("[data-delete-edu]").forEach(btn => {
    btn.onclick = async () => {
      const id = Number(btn.dataset.deleteEdu);

      await supabase.from("education").delete().eq("id", id);
      cvData.education = cvData.education.filter(ed => ed.id !== id);

      renderEditor();
    };
  });

  /* -----------------------------
     Редактирование institution
  ------------------------------ */
  root.querySelectorAll("[data-edu-inst]").forEach(input => {
    attachUniversityAutocomplete(input);

    input.oninput = () => {
      const id = input.dataset.eduInst;
      const item = cvData.education.find(ed => ed.id === id);
      item.institution = input.value;
    };
  });

  /* -----------------------------
     Редактирование degree
  ------------------------------ */
  root.querySelectorAll("[data-edu-degree]").forEach(input => {
    input.oninput = () => {
      const id = input.dataset.eduDegree;
      const item = cvData.education.find(ed => ed.id === id);
      item.degree = input.value;
    };
  });

  /* -----------------------------
     Редактирование города
  ------------------------------ */
  root.querySelectorAll("[data-edu-city]").forEach(input => {
    attachCityAutocomplete(input);

    input.oninput = () => {
      const id = input.dataset.eduCity;
      const item = cvData.education.find(ed => ed.id === id);
      item.city = input.value;
    };
  });

  /* -----------------------------
     Даты + datepicker
  ------------------------------ */
  root.querySelectorAll("[data-edu-start]").forEach(input => {
    attachGlassDatepicker(input, iso => {
      const id = Number(input.dataset.eduStart);
      const item = cvData.education.find(ed => ed.id === id);
      item.start_date = iso;
    });
  });

  root.querySelectorAll("[data-edu-end]").forEach(input => {
    attachGlassDatepicker(input, iso => {
      const id = Number(input.dataset.eduEnd);
      const item = cvData.education.find(ed => ed.id === id);
      item.end_date = iso;
    });
  });

  /* -----------------------------
     Редактирование описания
  ------------------------------ */
  root.querySelectorAll("[data-edu-description]").forEach(textarea => {
    textarea.oninput = () => {
      const id = Number(textarea.dataset.eduDescription);
      const item = cvData.education.find(ed => ed.id === id);
      item.description = textarea.value;
    };
  });
}

/* -------------------------------------------------------
   LOAD DATA
------------------------------------------------------- */
async function loadCV(id) {
  const { data: cv } = await supabase.from("cv").select("*").eq("id", id).single();
  const { data: cv_profile } = await supabase.from("cv_profiles").select("*").eq("cv_id", id).single();
  const { data: experience } = await supabase.from("experience").select("*").eq("cv_id", id).order("order_index");
  const { data: skills } = await supabase.from("skills").select("*").eq("cv_id", id);
  const { data: advantages } = await supabase.from("advantages").select("*").eq("cv_id", id);
  const { data: education } = await supabase.from("education").select("*").eq("cv_id", id);

  cvData = {
    cv,
    cv_profile,
    experience: experience || [],
    skills: skills || [],
    advantages: advantages || [],
    education: education || []
  };
}

/* -------------------------------------------------------
   RENDER EDITOR
------------------------------------------------------- */
function enhanceEditorUI() {
  const root = document.getElementById("cvEditorContent");
  if (!root) return;

  /* -------------------------------------------------------
     AUTO CAPITALIZE
  ------------------------------------------------------- */
  attachAutoCapitalize(root);

  /* -------------------------------------------------------
     CITY AUTOCOMPLETE
  ------------------------------------------------------- */
  root.querySelectorAll("[data-city-input]").forEach(input => {
    attachCityAutocomplete(input);
  });

  /* -------------------------------------------------------
     UNIVERSITY AUTOCOMPLETE
  ------------------------------------------------------- */
  root.querySelectorAll("[data-university-input]").forEach(input => {
    attachUniversityAutocomplete(input);
  });

  /* -------------------------------------------------------
     DATEPICKER — attach to inputs
  ------------------------------------------------------- */
  root.querySelectorAll("[data-date-input]").forEach(input => {
    attachGlassDatepicker(input);
  });

  /* -------------------------------------------------------
     DATEPICKER — attach navigation buttons (prev/next)
     IMPORTANT: now safe because HTML is already in DOM
  ------------------------------------------------------- */
  const dp = document.getElementById("glassDatepicker");
  if (dp) {
    const prev = dp.querySelector(".gdp-prev");
    const next = dp.querySelector(".gdp-next");

    if (prev) {
      prev.onclick = () => {
        dpDate.setMonth(dpDate.getMonth() - 1);
        renderGlassDatepicker();
      };
    }

    if (next) {
      next.onclick = () => {
        dpDate.setMonth(dpDate.getMonth() + 1);
        renderGlassDatepicker();
      };
    }
  }

  /* -------------------------------------------------------
     JOB TITLE AUTOCOMPLETE
  ------------------------------------------------------- */
  root.querySelectorAll("[data-job-title-input]").forEach(input => {
    attachJobTitleAutocomplete(input);
  });

  /* -------------------------------------------------------
     AVATAR
  ------------------------------------------------------- */
  attachAvatarEditorEvents();
  updateAvatarButtonsEditor(!!cvData.cv_profile.avatar_url);

  /* -------------------------------------------------------
     ADVANTAGES / EXPERIENCE / SKILLS / EDUCATION
  ------------------------------------------------------- */
  attachAdvantagesEditorEvents(root);
  attachExperienceEditorEvents(root);
  attachSkillsEditorEvents(root);
  attachEducationEditorEvents(root);
}

function renderEditor() {
  const topbar = document.getElementById("cvEditorTopbar");

  /* -------------------------------------------------------
     PATCH TOPBAR (childrenOnly → сохраняем .cv-topbar)
  ------------------------------------------------------- */
  const newTopbar = document.createElement("div");
  newTopbar.innerHTML = `
    <div class="cv-topbar-left">
      <button id="backToView" class="topbar-btn">
        <i class="fas fa-arrow-left"></i> Назад
      </button>
    </div>

    <div class="cv-topbar-center">
      <h1 class="cv-title">Редактирование резюме</h1>
    </div>

    <div class="cv-topbar-right">
      <button id="saveCvBtn" class="topbar-btn primary">
        <span>Сохранить</span>
      </button>
    </div>
  `;

  morphdom(topbar, newTopbar, { childrenOnly: true });


  /* -------------------------------------------------------
     PATCH EDITOR CONTENT
  ------------------------------------------------------- */
  const root = document.getElementById("cvEditorContent");

  const newRoot = document.createElement("div");
  cvData.skills = (cvData.skills || []).filter(s => {
    if (!s) return false;
    const name = (s.name || "").trim();
    if (!name) return false;
    if (name === "Новый навык") return false; // выкидываем плейсхолдер
    return true;
  });

  newRoot.innerHTML = generateCVEditorHTML(cvData);

  morphdom(root, newRoot, { childrenOnly: true });


  /* -------------------------------------------------------
     REATTACH EDITOR LOGIC
  ------------------------------------------------------- */
  attachAvatarEditorEvents();

  if (cvData.cv_profile.avatar_url) {
    loadAvatarWithCacheEditor(
      cvData.cv_profile.avatar_url + "?width=200&height=200&quality=70"
    );
  } else {
    localStorage.removeItem("cv_avatar");
  }

  updateAvatarButtonsEditor(!!cvData.cv_profile.avatar_url);

  dp = document.getElementById("glassDatepicker");

  hideCityDropdown();
  hideUniversityDropdown();
  enhanceEditorUI();
  attachEditorValidation();


  /* -------------------------------------------------------
     READY STATE
  ------------------------------------------------------- */
  const wrapper = document.querySelector(".cv-editor-wrapper");
  if (wrapper) wrapper.classList.add("ready");
}

function attachEditorValidation() {
  /* -------------------------------------------------------
     0) Добавляем error-msg, если его нет
  ------------------------------------------------------- */
  document.querySelectorAll(".editor-section input, .editor-section textarea").forEach(input => {
    const parent = input.parentElement;
    if (!parent.querySelector(".error-msg")) {
      const err = document.createElement("div");
      err.className = "error-msg";
      parent.appendChild(err);
    }
  });

  /* -------------------------------------------------------
     1) PROFILE — лимиты + live validation
  ------------------------------------------------------- */
  document.querySelectorAll("[data-field]").forEach(input => {
    const key = input.dataset.field;

    // Лимиты
    if (key === "cv_profile.full_name") limitLength(input, 120);
    if (key === "cv_profile.position") limitLength(input, 120);
    if (key === "cv_profile.email") limitLength(input, 120);
    if (key === "cv_profile.linkedin") limitLength(input, 100);
    if (key === "cv_profile.summary") limitLength(input, 350);

    const contactFields = [
      "telegram", "github", "website",
      "twitter", "instagram", "facebook",
      "behance", "dribbble"
    ];
    contactFields.forEach(c => {
      if (key === `cv_profile.${c}`) limitLength(input, 100);
    });

    if (key === "cv_profile.phone") sanitizePhone(input);

    // === NEW LIVE VALIDATION ===
    input.addEventListener("input", () => {
      syncEditorData();

      const profileErrors = validateProfileData(cvData.cv_profile);

      const titleValue = cvData.title ?? cvData.cv?.title ?? "";
      const titleErrors = (!cvData.title || !cvData.title.trim())
        ? [{ field: "title", msg: "Введите название резюме" }]
        : [];

      const errors = [...profileErrors, ...titleErrors];

      clearFieldError(input);

      const fieldName = key.replace("cv_profile.", "").replace("cv.", "");
      const err = errors.find(e => e.field === fieldName);

      if (err) showFieldError(input, err.msg);
    });
  });

  /* -------------------------------------------------------
     2) ADVANTAGES — лимит 40 символов
  ------------------------------------------------------- */
  const advInput = document.getElementById("advantageInput");
  if (advInput) {
    limitLength(advInput, 40);
  }

  /* -------------------------------------------------------
     3) SKILLS — лимит 25 символов на навык
  ------------------------------------------------------- */
  const skillInput = document.getElementById("skillNameInput");
  if (skillInput) {
    limitLength(skillInput, 25);
  }

  // Live validation навыков (при добавлении)
  if (skillInput) {
    skillInput.addEventListener("input", () => {
      const val = skillInput.value.trim();
      if (val.length > 25) {
        showFieldError(skillInput, "Максимум 25 символов");
      } else {
        clearFieldError(skillInput);
      }
    });
  }

  /* -------------------------------------------------------
     4) EXPERIENCE — лимиты + live validation
  ------------------------------------------------------- */
  document.querySelectorAll("[data-exp-company]").forEach(input => {
    limitLength(input, 120);
    input.addEventListener("input", liveValidateExperience);
  });

  document.querySelectorAll("[data-exp-position]").forEach(input => {
    limitLength(input, 120);
    input.addEventListener("input", liveValidateExperience);
  });

  document.querySelectorAll("[data-exp-city]").forEach(input => {
    limitLength(input, 80);
    input.addEventListener("input", liveValidateExperience);
  });

  document.querySelectorAll("[data-exp-tech]").forEach(input => {
    limitLength(input, 350);
    input.addEventListener("input", liveValidateExperience);
  });

  document.querySelectorAll("[data-exp-projects]").forEach(input => {
    limitLength(input, 350);
    input.addEventListener("input", liveValidateExperience);
  });

  document.querySelectorAll("[data-exp-description]").forEach(input => {
    limitLength(input, 350);
    input.addEventListener("input", liveValidateExperience);
  });

  /* -------------------------------------------------------
     5) EDUCATION — лимиты + live validation
  ------------------------------------------------------- */
  document.querySelectorAll("[data-edu-inst]").forEach(input => {
    limitLength(input, 120);
    input.addEventListener("input", liveValidateEducation);
  });

  document.querySelectorAll("[data-edu-degree]").forEach(input => {
    limitLength(input, 120);
    input.addEventListener("input", liveValidateEducation);
  });

  document.querySelectorAll("[data-edu-city]").forEach(input => {
    limitLength(input, 80);
    input.addEventListener("input", liveValidateEducation);
  });

  document.querySelectorAll("[data-edu-description]").forEach(input => {
    limitLength(input, 350);
    input.addEventListener("input", liveValidateEducation);
  });
}

function liveValidateExperience() {
  syncEditorData();
  const errors = validateExperienceData(cvData.experience);

  // очищаем все ошибки
  document.querySelectorAll(
    "[data-exp-company], [data-exp-position], [data-exp-city], [data-exp-description], [data-exp-tech], [data-exp-projects]"
  ).forEach(input => clearFieldError(input));

  errors.forEach(err => {
    const match = err.match(/#(\d+)/);
    if (!match) return;
    const index = Number(match[1]) - 1;
    const exp = cvData.experience[index];

    if (err.includes("компанию")) {
      const input = document.querySelector(`[data-exp-company="${exp.id}"]`);
      if (input) showFieldError(input, err);
    }
    if (err.includes("должность")) {
      const input = document.querySelector(`[data-exp-position="${exp.id}"]`);
      if (input) showFieldError(input, err);
    }
    if (err.includes("город")) {
      const input = document.querySelector(`[data-exp-city="${exp.id}"]`);
      if (input) showFieldError(input, err);
    }
    if (err.includes("технолог")) {
      const input = document.querySelector(`[data-exp-tech="${exp.id}"]`);
      if (input) showFieldError(input, err);
    }
    if (err.includes("проект")) {
      const input = document.querySelector(`[data-exp-projects="${exp.id}"]`);
      if (input) showFieldError(input, err);
    }
    if (err.includes("описание")) {
      const input = document.querySelector(`[data-exp-description="${exp.id}"]`);
      if (input) showFieldError(input, err);
    }
  });
}

function liveValidateEducation() {
  syncEditorData();
  const errors = validateEducationData(cvData.education);

  document.querySelectorAll(
    "[data-edu-inst], [data-edu-degree], [data-edu-city], [data-edu-description]"
  ).forEach(input => clearFieldError(input));

  errors.forEach(err => {
    const match = err.match(/#(\d+)/);
    if (!match) return;
    const index = Number(match[1]) - 1;
    const ed = cvData.education[index];

    if (err.includes("название")) {
      const input = document.querySelector(`[data-edu-inst="${ed.id}"]`);
      if (input) showFieldError(input, err);
    }
    if (err.includes("значение")) {
      const input = document.querySelector(`[data-edu-degree="${ed.id}"]`);
      if (input) showFieldError(input, err);
    }
    if (err.includes("город")) {
      const input = document.querySelector(`[data-edu-city="${ed.id}"]`);
      if (input) showFieldError(input, err);
    }
    if (err.includes("описание")) {
      const input = document.querySelector(`[data-edu-description="${ed.id}"]`);
      if (input) showFieldError(input, err);
    }
  });
}

function syncEditorData() {
  // -------------------------
  // TITLE (NEW)
  // -------------------------
  const titleInput = document.querySelector('[data-field="cv.title"]');
  if (titleInput) {
    cvData.title = titleInput.value.trim();
  }

  // -------------------------
  // PROFILE
  // -------------------------
  const profile = cvData.cv_profile;

  document.querySelectorAll("[data-field]").forEach(input => {
    const key = input.dataset.field.replace("cv_profile.", "");
    if (key in profile) {
      profile[key] = input.value.trim();
    }
  });

  // -------------------------
  // ADVANTAGES
  // -------------------------
  cvData.advantages = cvData.advantages.map(a => ({
    ...a,
    tag: a.tag.trim()
  }));

  // -------------------------
  // EXPERIENCE
  // -------------------------
  cvData.experience.forEach(exp => {
    exp.company = getInput(`data-exp-company="${exp.id}"`);
    exp.position = getInput(`data-exp-position="${exp.id}"`);
    exp.city = getInput(`data-exp-city="${exp.id}"`);
    exp.start_date = normalizeDate(getInput(`data-exp-start="${exp.id}"`));
    exp.end_date = exp.current ? null : normalizeDate(getInput(`data-exp-end="${exp.id}"`));
    exp.description = getInput(`data-exp-description="${exp.id}"`);
    exp.technologies = getInput(`data-exp-tech="${exp.id}"`);
    exp.projects = getInput(`data-exp-projects="${exp.id}"`);
  });

  // -------------------------
  // EDUCATION
  // -------------------------
  cvData.education.forEach(ed => {
    ed.institution = getInput(`data-edu-inst="${ed.id}"`);
    ed.degree = getInput(`data-edu-degree="${ed.id}"`);
    ed.city = getInput(`data-edu-city="${ed.id}"`);
    ed.start_date = normalizeDate(getInput(`data-edu-start="${ed.id}"`));
    ed.end_date = normalizeDate(getInput(`data-edu-end="${ed.id}"`));
    ed.description = getInput(`data-edu-description="${ed.id}"`);
  });

  // -------------------------
  // SKILLS
  // -------------------------
  const skillLevels = ["expert", "used", "familiar"];
  cvData.skills = [];

  skillLevels.forEach(level => {
    const list = document.querySelector(`[data-skill-list="${level}"]`);
    if (!list) return;

    list.querySelectorAll(".skill-pill").forEach(pill => {
      cvData.skills.push({
        id: pill.dataset.skillId,
        name: pill.querySelector("span").textContent.trim(),
        level
      });
    });
  });
}

/* -------------------------------------------------------
   SAVE CHANGES (пока базовая версия)
------------------------------------------------------- */
async function saveChanges() {
  const btn = document.getElementById("saveCvBtn");
  const btnText = btn?.querySelector("span");

  // -----------------------------------------
  // 1) Синхронизируем cvData с DOM
  // -----------------------------------------
  syncEditorData();

  // -----------------------------------------
  // 2) Валидируем
  // -----------------------------------------
  const errors = validateFullCV(cvData);
  if (errors.length > 0) {
    showToast(errors[0].msg, "error");
    highlightEditorErrors(errors);
    return;
  }

  // -----------------------------------------
  // 3) Только теперь сохраняем
  // -----------------------------------------

  if (btn) {
    btn.classList.add("saving");

    if (btnText) {
      btnText.style.opacity = "0";
      setTimeout(() => {
        btnText.textContent = "Сохранение...";
        btnText.style.opacity = "1";
      }, 250);
    }
  }

  try {
    /* -----------------------------
       CV
    ------------------------------ */
    await supabase.from("cv")
      .update({ title: getValue("cv.title") })
      .eq("id", cvId);

    /* -----------------------------
       PROFILE
    ------------------------------ */
    const profileFields = [
      "full_name", "position", "summary", "email", "phone",
      "linkedin", "location", "telegram", "github", "website",
      "twitter", "instagram", "facebook", "behance", "dribbble"
    ];

    const updatedProfile = {};
    profileFields.forEach(f => {
      updatedProfile[f] = getValue(`cv_profile.${f}`);
    });

    updatedProfile.avatar_url = cvData.cv_profile.avatar_url || null;

    await supabase.from("cv_profiles")
      .update(updatedProfile)
      .eq("cv_id", cvId);

    /* -----------------------------
       ADVANTAGES
    ------------------------------ */
    for (const adv of cvData.advantages) {
      await supabase
        .from("advantages")
        .update({ tag: adv.tag })
        .eq("id", adv.id);
    }

    /* -----------------------------
       EXPERIENCE
    ------------------------------ */
    for (const exp of cvData.experience) {
      await supabase.from("experience").update({
        company: getInput(`data-exp-company="${exp.id}"`),
        position: getInput(`data-exp-position="${exp.id}"`),
        city: getInput(`data-exp-city="${exp.id}"`),
        start_date: normalizeDate(getInput(`data-exp-start="${exp.id}"`)),
        end_date: exp.current ? null : normalizeDate(getInput(`data-exp-end="${exp.id}"`)),
        current: exp.current || false,
        description: getInput(`data-exp-description="${exp.id}"`),
        technologies: getInput(`data-exp-tech="${exp.id}"`), 
        projects: getInput(`data-exp-projects="${exp.id}"`), 
        employment_type: exp.employment_type || ""
      }).eq("id", exp.id);
    }

    /* -----------------------------
       EDUCATION
    ------------------------------ */
    for (const ed of cvData.education) {
      await supabase.from("education").update({
        institution: getInput(`data-edu-inst="${ed.id}"`),
        degree: getInput(`data-edu-degree="${ed.id}"`),
        city: getInput(`data-edu-city="${ed.id}"`),
        start_date: normalizeDate(getInput(`data-edu-start="${ed.id}"`)),
        end_date: normalizeDate(getInput(`data-edu-end="${ed.id}"`)),
        description: getInput(`data-edu-description="${ed.id}"`)
      }).eq("id", ed.id);
    }

    /* -----------------------------------------
       Сначала выключаем анимацию кнопки
    ------------------------------------------ */
    const newBtn = document.getElementById("saveCvBtn");
    const newText = newBtn?.querySelector("span");

    if (newBtn) newBtn.classList.remove("saving");

    if (newText) {
      newText.style.opacity = "0";
      setTimeout(() => {
        newText.textContent = "Сохранить";
        newText.style.opacity = "1";
      }, 150);
    }

    /* -----------------------------------------
       Делаем небольшую паузу перед тостом
    ------------------------------------------ */
    setTimeout(() => {
      showToast("Изменения сохранены", "success");
    }, 200);

    /* -----------------------------------------
       И только после тоста — перерендер
    ------------------------------------------ */
    await loadCV(cvId);
    renderEditor();

  } catch (err) {
    console.error(err);

    const newBtn = document.getElementById("saveCvBtn");
    const newText = newBtn?.querySelector("span");

    if (newBtn) newBtn.classList.remove("saving");

    if (newText) {
      newText.style.opacity = "0";
      setTimeout(() => {
        newText.textContent = "Сохранить";
        newText.style.opacity = "1";
      }, 100);
    }

    setTimeout(() => {
      showToast("Ошибка сохранения", "error");
    }, 200);
  }
}

function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");

  toast.className = `toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  // Делаем небольшую паузу, чтобы браузер применил стартовые стили
  setTimeout(() => {
    toast.classList.add("show");
  }, 30); // 20–30 мс — идеальное значение

  // Через 3 секунды — плавное исчезновение
  setTimeout(() => {
    toast.classList.remove("show");
    toast.classList.add("hide");

    // Удаляем после завершения анимации
    setTimeout(() => toast.remove(), 450);
  }, 3000);
}

/* -------------------------------------------------------
   ADD NEW ELEMENTS
------------------------------------------------------- */
async function addItem(type) {
  const defaults = {
    advantage: { cv_id: cvId, tag: "Новое преимущество" },
    skill: { cv_id: cvId, name: "Новый навык", level: "familiar" },
    experience: {
      cv_id: cvId,
      company: "",
      position: "",
      city: "",
      start_date: null,
      end_date: null,
      current: false,
      description: "",
      technologies: "",
      projects: "",
      employment_type: "",
      order_index: cvData.experience.length
    },
    education: {
      cv_id: cvId,
      institution: "",
      degree: "",
      city: "",
      start_date: null,
      end_date: null,
      description: ""
    }
  };

  // исправленный маппинг
  const table = {
    advantage: "advantages",
    skill: "skills",
    experience: "experience",
    education: "education"
  }[type];

  if (!table) {
    console.error("addItem(): unknown type:", type);
    return;
  }

  const { data, error } = await supabase
    .from(table)
    .insert(defaults[type])
    .select()
    .single();

  if (error) {
    console.error("Supabase insert error:", error);
    return;
  }

  // корректный ключ для cvData
  const key =
    type === "advantage"
      ? "advantages"
      : type === "skill"
      ? "skills"
      : type;

  cvData[key].push(data);

  renderEditor();
}

/* -------------------------------------------------------
   DELETE ELEMENTS
------------------------------------------------------- */
async function deleteItem(type, id) {
  const table = {
    advantage: "advantages",
    skill: "skills",
    experience: "experience",
    education: "education"
  }[type];

  if (!table) {
    console.error("deleteItem(): unknown type:", type);
    return;
  }

  await supabase.from(table).delete().eq("id", id);

  const key =
    type === "advantage"
      ? "advantages"
      : type === "skill"
      ? "skills"
      : type;

  cvData[key] = cvData[key].filter(item => item.id !== id);

  renderEditor();
}

/* -------------------------------------------------------
   EVENTS
------------------------------------------------------- */
function setupEvents() {
  document.addEventListener("click", e => {
    if (e.target.closest("#backToView")) {
      window.location.href = `/cv/cv-view.html?id=${cvId}`;
    }

    if (e.target.closest("#saveCvBtn")) {
      saveChanges();
    }

    // добавление элементов
    if (e.target.dataset.add) {
      const type = e.target.dataset.add;

      // преимущества добавляются через другой механизм
      if (type !== "advantage") {
        addItem(type); // теперь type="skill" → работает
      }
    }

    // удаление преимуществ
    if (e.target.closest("[data-delete-adv]")) {
      const btn = e.target.closest("[data-delete-adv]");
      deleteItem("advantage", btn.dataset.deleteAdv);
    }

    // удаление навыков
    if (e.target.dataset.deleteSkill) {
      deleteItem("skill", e.target.dataset.deleteSkill); // исправлено
    }

    // удаление опыта
    if (e.target.dataset.deleteExp) {
      deleteItem("experience", e.target.dataset.deleteExp);
    }

    // удаление образования
    if (e.target.dataset.deleteEdu) {
      deleteItem("education", e.target.dataset.deleteEdu);
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
  renderEditor();
  setupEvents();
}

init();
