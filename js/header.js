import { supabase } from "/js/supabase.js";

/* ========================================================
   GLOBAL HEADER — Premium Logic
======================================================== */
export async function initGlobalHeader() {
  const headerRight = document.getElementById("headerRight");
  if (!headerRight) return;

  /* ------------------ LOADING STATE ------------------ */
  headerRight.innerHTML = `
    <div class="header-avatar loading"></div>
  `;

  const { data } = await supabase.auth.getSession();
  const user = data?.session?.user;

  /* ====================================================
     ГОСТЬ
  ==================================================== */
  if (!user) {
    headerRight.innerHTML = `
      <button class="header-btn" id="loginBtn">Войти</button>
      <button class="header-btn primary" id="registerBtn">Начать бесплатно</button>
    `;

    document.getElementById("loginBtn").onclick = () =>
      navigateWithLoader("/auth/index.html");

    document.getElementById("registerBtn").onclick = () =>
      navigateWithLoader("/auth/register.html");

    return;
  }

  /* ====================================================
     АВТОРИЗОВАННЫЙ
  ==================================================== */
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .single();

  const first = profile?.first_name || user.user_metadata?.first_name || "";
  const last = profile?.last_name || user.user_metadata?.last_name || "";

  const fullName = `${first} ${last}`.trim() || "Профиль";
  const initials = (first[0] || "") + (last[0] || "");
  const safeInitials = initials ? initials.toUpperCase() : "•";

  headerRight.innerHTML = `
    <div class="header-avatar" id="profileBtn">${safeInitials}</div>

    <div class="profile-menu" id="profileMenu">
      <div class="profile-menu-item profile-name">${fullName}</div>
      <div class="profile-menu-item" id="menuDashboard">Дашборд</div>
      <div class="profile-menu-item" id="menuAccount">Настройки</div>
      <div class="profile-menu-item logout" id="menuLogout">Выйти</div>
    </div>
  `;

  const profileBtn = document.getElementById("profileBtn");
  const profileMenu = document.getElementById("profileMenu");

  /* ====================================================
     МЕНЮ ПРОФИЛЯ — ПРЕМИАЛЬНОЕ ПОВЕДЕНИЕ
  ==================================================== */

  let menuOpen = false;

  const toggleMenu = () => {
    menuOpen = !menuOpen;
    profileMenu.classList.toggle("active", menuOpen);
    profileBtn.classList.toggle("active", menuOpen);
  };

  profileBtn.onclick = (e) => {
    e.stopPropagation();
    toggleMenu();
  };

  /* Закрытие по клику вне */
  document.addEventListener("click", (e) => {
    if (!menuOpen) return;
    if (!profileMenu.contains(e.target) && !profileBtn.contains(e.target)) {
      toggleMenu();
    }
  });

  /* Закрытие по Escape */
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menuOpen) toggleMenu();
  });

  /* ====================================================
     ПУНКТЫ МЕНЮ
  ==================================================== */

  document.getElementById("menuDashboard").onclick = () =>
    navigateWithLoader("/dashboard.html");

  document.getElementById("menuAccount").onclick = () =>
    navigateWithLoader("/auth/account.html");

  document.getElementById("menuLogout").onclick = async () => {
    showPageLoader();
    await supabase.auth.signOut();
    navigateWithLoader("/auth/index.html");
  };
}

/* ========================================================
   SIMPLE PAGE LOADER
======================================================== */

const MIN_VISIBLE_TIME = 500;
let loaderAnimationFrame = null;
let loaderHideTimeout = null;

export function showPageLoader() {
  const loader = document.getElementById("pageLoader");
  if (!loader) return;
  
  // Отменяем предыдущие таймауты
  if (loaderHideTimeout) {
    clearTimeout(loaderHideTimeout);
    loaderHideTimeout = null;
  }
  
  // Сбрасываем анимацию для чистого старта
  loader.style.animation = 'none';
  
  // Используем requestAnimationFrame для синхронизации
  loaderAnimationFrame = requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      loader.style.animation = '';
      loader.classList.remove("hidden");
    });
  });
}

export function hidePageLoader() {
  const loader = document.getElementById("pageLoader");
  if (!loader) return;
  
  // Отменяем анимационный фрейм если есть
  if (loaderAnimationFrame) {
    cancelAnimationFrame(loaderAnimationFrame);
    loaderAnimationFrame = null;
  }
  
  const startTime = performance.now();
  const elapsed = performance.now() - startTime;
  const remaining = Math.max(0, MIN_VISIBLE_TIME - elapsed);
  
  loaderHideTimeout = setTimeout(() => {
    loader.classList.add("hidden");
    
    // Сбрасываем анимацию после скрытия
    setTimeout(() => {
      if (loader.classList.contains('hidden')) {
        loader.style.animation = 'none';
      }
    }, 350);
    
    loaderHideTimeout = null;
  }, remaining);
}

/* ========================================================
   AUTO INIT
======================================================== */

document.addEventListener("DOMContentLoaded", () => {
  const loader = document.getElementById("pageLoader");
  if (!loader) return;
  
  // Сразу показываем лоадер
  showPageLoader();
  
  // Прячем после полной загрузки
  window.addEventListener('load', () => {
    hidePageLoader();
  });
  
  // Fallback на случай если load не сработал
  setTimeout(() => {
    hidePageLoader();
  }, 3000);
});

/* ========================================================
   NAVIGATION WITH LOADER
======================================================== */
export function navigateWithLoader(url) {
  showPageLoader();
  setTimeout(() => (window.location.href = url), 10);
}

/* ========================================================
   AUTO INIT LOADER
======================================================== */
document.addEventListener("DOMContentLoaded", () => {
  showPageLoader();
  hidePageLoader();
});
