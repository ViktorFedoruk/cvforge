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

/* То же самое, но без trim (для textarea, если нужно сохранить переносы) */
function getTextarea(field) {
  const el = document.querySelector(`[data-field="${field}"]`);
  return el ? el.value : "";
}

/* Старый механизм для опыт/образование (data-exp-company="ID") */
function getInput(selector) {
  return document.querySelector(`[${selector}]`)?.value || "";
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
let dpDate = new Date();

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
}

function closeAllMenus() {
  document.querySelectorAll(".gdp-menu").forEach(m => m.classList.add("hidden"));
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".gdp-dropdown")) closeAllMenus();
});

function renderGlassDatepicker() {
  const daysEl = dp.querySelector(".gdp-days");
  const weekdaysEl = dp.querySelector(".gdp-weekdays");

  const monthBtn = dp.querySelector(".gdp-month-btn");
  const yearBtn = dp.querySelector(".gdp-year-btn");

  const monthMenu = dp.querySelector(".gdp-month-menu");
  const yearMenu = dp.querySelector(".gdp-year-menu");

  weekdaysEl.innerHTML = weekdaysRU.map(d => `<div>${d}</div>`).join("");

  monthBtn.textContent = monthsRU[dpDate.getMonth()];
  yearBtn.textContent = dpDate.getFullYear();

  monthMenu.innerHTML = monthsRU
    .map((m, i) => `
      <div class="gdp-menu-item ${i === dpDate.getMonth() ? "active" : ""}" data-month="${i}">
        ${m}
      </div>
    `)
    .join("");

  const currentYear = new Date().getFullYear();
  let yearsHTML = "";
  for (let y = currentYear - 50; y <= currentYear + 50; y++) {
    yearsHTML += `
      <div class="gdp-menu-item ${y === dpDate.getFullYear() ? "active" : ""}" data-year="${y}">
        ${y}
      </div>`;
  }
  yearMenu.innerHTML = yearsHTML;

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

    const rect = input.getBoundingClientRect();
    const dpRect = dp.getBoundingClientRect();

    // Базовая позиция — под инпутом
    let top = rect.bottom + window.scrollY + 8;
    let left = rect.left + window.scrollX;

    // Если календарь выходит за правый край — сдвигаем влево
    if (left + dpRect.width > window.scrollX + window.innerWidth - 10) {
      left = window.scrollX + window.innerWidth - dpRect.width - 10;
    }

    // Если выходит за нижний край — показываем над инпутом
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

  // очищаем кэш
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
      avatarErrorEl.textContent = "Можно загружать только JPG, PNG или WEBP.";
      avatarFileInput.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      avatarErrorEl.textContent = "Размер файла не должен превышать 5MB.";
      avatarFileInput.value = "";
      return;
    }

    avatarErrorEl.textContent = "";
    openAvatarCropperModalEditor(file);
  };
}

/* -------------------------------------------------------
   МОДАЛКА КРОППЕРА
------------------------------------------------------- */
function openAvatarCropperModalEditor(file) {
  const modal = document.getElementById("avatarCropModal");
  const cropArea = document.getElementById("avatarCropArea");
  const zoomInput = document.getElementById("avatarZoom");
  const cancelBtn = document.getElementById("avatarCancel");
  const applyBtn = document.getElementById("avatarApply");

  if (!modal || !cropArea) return;

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
  img.style.transformOrigin = "top left";
  cropArea.appendChild(img);

  let zoom = 1;
  let imgX = 0;
  let imgY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  img.onload = () => {
    const rect = cropArea.getBoundingClientRect();
    const scale = Math.min(rect.width / img.naturalWidth, rect.height / img.naturalHeight);

    zoom = scale;
    zoomInput.value = zoom.toFixed(2);

    imgX = (rect.width - img.naturalWidth * zoom) / 2;
    imgY = (rect.height - img.naturalHeight * zoom) / 2;

    updateTransform();
  };

  function updateTransform() {
    img.style.transform = `translate(${imgX}px, ${imgY}px) scale(${zoom})`;
  }

  cropArea.onwheel = e => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    const newZoom = Math.min(Math.max(zoom + delta, 0.2), 5);

    const rect = cropArea.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    const px = (cx - imgX) / zoom;
    const py = (cy - imgY) / zoom;

    zoom = newZoom;
    zoomInput.value = zoom.toFixed(2);

    imgX = cx - px * zoom;
    imgY = cy - py * zoom;

    updateTransform();
  };

  zoomInput.oninput = () => {
    const newZoom = parseFloat(zoomInput.value);
    const rect = cropArea.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    const px = (cx - imgX) / zoom;
    const py = (cy - imgY) / zoom;

    zoom = newZoom;

    imgX = cx - px * zoom;
    imgY = cy - py * zoom;

    updateTransform();
  };

  cropArea.onmousedown = e => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  };

  document.onmouseup = () => dragging = false;

  document.onmousemove = e => {
    if (!dragging) return;

    imgX += e.clientX - lastX;
    imgY += e.clientY - lastY;

    lastX = e.clientX;
    lastY = e.clientY;

    updateTransform();
  };

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
    ctx.clip();

    ctx.drawImage(img, srcX, srcY, size / zoom, size / zoom, 0, 0, size, size);

    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));

    modal.style.display = "none";
    await saveAvatarEditor(blob);
  };
}

/* ========================================================
   AVATAR CACHE FOR EDITOR
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
  if (!url) {
    localStorage.removeItem("cv_avatar");
    return;
  }

  const cached = JSON.parse(localStorage.getItem("cv_avatar") || "{}");

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

    localStorage.setItem("cv_avatar", JSON.stringify({
      base64,
      eTag: newETag
    }));

    setEditorAvatarSrc(base64);
  } catch {}
}

/* -------------------------------------------------------
   СОХРАНЕНИЕ В SUPABASE
------------------------------------------------------- */
async function saveAvatarEditor(blob) {
  const fileName = `${cvId}/avatar_${Date.now()}.png`;

  const { error } = await supabase.storage
    .from("avatars")
    .upload(fileName, blob, { upsert: true });

  if (error) {
    console.error("Avatar upload error:", error);
    resetAvatarEditor();
    return;
  }

  const publicUrl = supabase.storage
    .from("avatars")
    .getPublicUrl(fileName).data.publicUrl;

  cvData.cv_profile.avatar_url = publicUrl;

  // 1. Конвертируем blob → base64
  const base64 = await blobToBase64Editor(blob);

  // 2. Обновляем кэш
  localStorage.setItem("cv_avatar", JSON.stringify({
    base64,
    eTag: null // заставим обновиться при следующем заходе
  }));

  // 3. Обновляем UI
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
      const id = Number(btn.dataset.deleteExp);

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
      const item = cvData.experience.find(e => e.id === id);
      item.company = input.value;
    };
  });

  root.querySelectorAll("[data-exp-position]").forEach(input => {
    input.oninput = () => {
      const id = input.dataset.expPosition;
      const item = cvData.experience.find(e => e.id === id);
      item.position = input.value;
    };
  });

  root.querySelectorAll("[data-exp-description]").forEach(input => {
    input.oninput = () => {
      const id = input.dataset.expDescription;
      const item = cvData.experience.find(e => e.id === id);
      item.description = input.value;
    };
  });

  /* -----------------------------
     Автокомплит города
  ------------------------------ */
  root.querySelectorAll("[data-exp-city]").forEach(input => {
    attachCityAutocomplete(input);

    input.oninput = () => {
      const id = input.dataset.expCity;
      const item = cvData.experience.find(e => e.id === id);
      item.city = input.value;
    };
  });

  /* -----------------------------
     Даты + datepicker
  ------------------------------ */
  root.querySelectorAll("[data-exp-start]").forEach(input => {
    attachGlassDatepicker(input, iso => {
      const id = Number(input.dataset.expStart);
      const item = cvData.experience.find(e => e.id === id);
      item.start_date = iso;
    });
  });

  root.querySelectorAll("[data-exp-end]").forEach(input => {
    attachGlassDatepicker(input, iso => {
      const id = Number(input.dataset.expEnd);
      const item = cvData.experience.find(e => e.id === id);
      item.end_date = iso;
    });
  });

  /* -----------------------------
     Чекбокс "Работаю здесь"
  ------------------------------ */
  root.querySelectorAll("[data-exp-current]").forEach(checkbox => {
    checkbox.onchange = () => {
      const id = Number(checkbox.dataset.expCurrent);
      const item = cvData.experience.find(e => e.id === id);

      item.current = checkbox.checked;

      const endInput = root.querySelector(`[data-exp-end="${id}"]`);

      if (checkbox.checked) {
        item.end_date = null;
        endInput.value = "";
        endInput.disabled = true;
      } else {
        endInput.disabled = false;
      }
    };
  });
}

/* ========================================================
   SKILLS — EDITOR VERSION
======================================================== */

/* -------------------------------------------------------
   Подключение событий для блока навыков
------------------------------------------------------- */
function attachSkillsEditorEvents(root) {

  /* -----------------------------
     Добавление навыка
  ------------------------------ */
  const addBtn = root.querySelector("[data-add='skill']");
  const input = root.querySelector("#skillNameInput");

  if (addBtn && input) {
    addBtn.onclick = async () => {
      const name = input.value.trim();
      if (!name) return;

      const { data, error } = await supabase
        .from("skills")
        .insert({
          cv_id: cvId,
          name,
          level: "used"
        })
        .select()
        .single();

      if (error) {
        console.error("Skill insert error:", error);
        return;
      }

      cvData.skills.push(data);
      renderEditor();
    };
  }

  /* -----------------------------
     Удаление навыка
  ------------------------------ */
  root.querySelectorAll("[data-delete-skill]").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.deleteSkill; // UUID как строка

      await supabase.from("skills").delete().eq("id", id);
      cvData.skills = cvData.skills.filter(s => s.id !== id);

      renderEditor();
    };
  });

  /* -----------------------------
     DRAG & DROP
  ------------------------------ */

  let draggedSkillId = null;

  /* начало перетаскивания */
  root.querySelectorAll(".skill-pill").forEach(pill => {
    pill.addEventListener("dragstart", e => {
      draggedSkillId = pill.dataset.skillId; // UUID (строка)
      e.dataTransfer.effectAllowed = "move";

      pill.classList.add("dragging");
    });

    pill.addEventListener("dragend", () => {
      pill.classList.remove("dragging");
      draggedSkillId = null;

      root.querySelectorAll(".skills-column").forEach(col =>
        col.classList.remove("active")
      );
    });
  });

  /* DROP на список навыков */
  root.querySelectorAll(".skills-list").forEach(list => {
    const column = list.closest(".skills-column");

    list.addEventListener("dragover", e => {
      e.preventDefault();
      column.classList.add("active");
    });

    list.addEventListener("dragleave", () => {
      column.classList.remove("active");
    });

    list.addEventListener("drop", async e => {
      e.preventDefault();
      column.classList.remove("active");

      if (!draggedSkillId) return;

      const newLevel = list.dataset.skillList; // expert / used / familiar
      const skill = cvData.skills.find(s => s.id === draggedSkillId);

      if (!skill) {
        console.warn("Skill not found in cvData:", draggedSkillId);
        return;
      }

      if (skill.level === newLevel) return;

      // обновляем в Supabase
      const { error } = await supabase
        .from("skills")
        .update({ level: newLevel })
        .eq("id", draggedSkillId);

      if (error) {
        console.error("Skill update error:", error);
        return;
      }

      // обновляем локально
      skill.level = newLevel;

      // перерендер
      renderEditor();
    });
  });
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

  topbar.innerHTML = `
    <div class="cv-topbar-left">
      <button id="backToView" class="topbar-btn">
        <i class="fas fa-arrow-left"></i> Назад
      </button>
    </div>

    <div class="cv-topbar-center">
      <h1 class="cv-title">Редактирование резюме</h1>
    </div>

    <div class="cv-topbar-right">
      <button id="saveCvBtn" class="topbar-btn primary">Сохранить</button>
    </div>
  `;

  const root = document.getElementById("cvEditorContent");
  root.innerHTML = generateCVEditorHTML(cvData);

  // --- подключаем события редактора аватара ---
  attachAvatarEditorEvents();

  // --- подгружаем аватар из кэша ---
  if (cvData.cv_profile.avatar_url) {
    loadAvatarWithCacheEditor(
      cvData.cv_profile.avatar_url + "?width=200&height=200&quality=70"
    );
  } else {
    localStorage.removeItem("cv_avatar");
  }

  // --- обновляем кнопки ---
  updateAvatarButtonsEditor(!!cvData.cv_profile.avatar_url);

  // --- остальная логика редактора ---
  dp = document.getElementById("glassDatepicker");
  hideCityDropdown();
  hideUniversityDropdown();
  enhanceEditorUI();

  // --- ВАЖНО: включаем wrapper после полной инициализации ---
  const wrapper = document.querySelector(".cv-editor-wrapper");
  if (wrapper) wrapper.classList.add("ready");
}

/* -------------------------------------------------------
   SAVE CHANGES (пока базовая версия)
------------------------------------------------------- */
async function saveChanges() {
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
      "location", "telegram", "github", "website",
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
        description: getInput(`data-exp-description="${exp.id}"`)
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

    alert("Изменения сохранены");

    await loadCV(cvId);
    renderEditor();

  } catch (err) {
    console.error(err);
    alert("Ошибка сохранения");
  }
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

  const table = {
    advantage: "advantages",
    skills: "skills",
    experience: "experience",
    education: "education"
  }[type];

  const { data } = await supabase
    .from(table)
    .insert(defaults[type])
    .select()
    .single();

  cvData[type === "advantage" ? "advantages" : type].push(data);

  renderEditor();
}

/* -------------------------------------------------------
   DELETE ELEMENTS
------------------------------------------------------- */
async function deleteItem(type, id) {
  const table = {
    advantage: "advantages",
    skills: "skills",
    experience: "experience",
    education: "education"
  }[type];

  await supabase.from(table).delete().eq("id", id);

  const key = type === "advantage" ? "advantages" : type;
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

    // --- FIX: не вызываем addItem для advantages ---
    if (e.target.dataset.add) {
      const type = e.target.dataset.add;
      if (type !== "advantage") {
        addItem(type);
      }
    }

    if (e.target.closest("[data-delete-adv]")) {
      const btn = e.target.closest("[data-delete-adv]");
      deleteItem("advantage", btn.dataset.deleteAdv);
    }

    if (e.target.dataset.deleteSkill) {
      deleteItem("skills", Number(e.target.dataset.deleteSkill));
    }

    if (e.target.dataset.deleteExp) {
      deleteItem("experience", Number(e.target.dataset.deleteExp));
    }

    if (e.target.dataset.deleteEdu) {
      deleteItem("education", Number(e.target.dataset.deleteEdu));
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
