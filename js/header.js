import { supabase } from "./supabase.js";

// Минимальное время показа лоадера (мс)
const LOADER_MIN_TIME = 400;

let loaderStart = performance.now();
let headerReady = false;
let pageReady = false;

export async function initGlobalHeader() {
  const mount = document.getElementById("globalHeaderMount");
  if (!mount) return;

  // Загружаем header.html
  const res = await fetch("/components/header.html");
  const html = await res.text();

  // Вставляем template в DOM
  const temp = document.createElement("div");
  temp.innerHTML = html;

  const tpl = temp.querySelector("#globalHeaderTemplate");
  const clone = tpl.content.cloneNode(true);

  mount.appendChild(clone);

  const headerRight = document.getElementById("headerRight");

  // Авторизация
  const { data } = await supabase.auth.getSession();
  const user = data?.session?.user;

  if (!user) {
    headerRight.innerHTML = `
      <button class="header-btn" id="loginBtn">Войти</button>
      <button class="header-btn" id="registerBtn">Регистрация</button>
    `;

    document.getElementById("loginBtn").onclick = () => {
      window.location.href = "/auth/index.html#login";
    };

    document.getElementById("registerBtn").onclick = () => {
      window.location.href = "/auth/register.html#register";
    };

    headerReady = true;
    tryFinishLoading();
    return;
  }

  // Загружаем профиль
  let fullName = "Профиль";

  const { data: profileData } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .single();

  if (profileData) {
    fullName = `${profileData.first_name ?? ""} ${profileData.last_name ?? ""}`.trim();
  }

  // Рендер меню
  headerRight.innerHTML = `
    <div class="header-avatar" id="profileBtn">
      <i class="fas fa-user"></i>
    </div>

    <div class="profile-menu" id="profileMenu">
      <div class="profile-menu-item">${fullName}</div>
      <div class="profile-menu-item" id="menuDashboard">Дашборд</div>
      <div class="profile-menu-item" id="menuAccount">Аккаунт</div>
      <div class="profile-menu-item logout" id="menuLogout">Выйти</div>
    </div>
  `;

  const profileBtn = document.getElementById("profileBtn");
  const profileMenu = document.getElementById("profileMenu");

  profileBtn.onclick = () => {
    profileMenu.classList.toggle("active");
  };

  document.addEventListener("click", (e) => {
    if (!profileMenu.contains(e.target) && !profileBtn.contains(e.target)) {
      profileMenu.classList.remove("active");
    }
  });

  document.getElementById("menuDashboard").onclick = () => {
    window.location.href = "/dashboard.html";
  };

  document.getElementById("menuAccount").onclick = () => {
    window.location.href = "/auth/account.html";
  };

  document.getElementById("menuLogout").onclick = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth/index.html";
  };

  headerReady = true;
  tryFinishLoading();
}

// Когда страница полностью загружена (CSS, JS, картинки)
window.addEventListener("load", () => {
  pageReady = true;
  tryFinishLoading();
});

// Проверяем, можно ли скрывать лоадер
function tryFinishLoading() {
  if (!headerReady || !pageReady) return;

  const loader = document.getElementById("pageLoader");
  if (!loader) return;

  const elapsed = performance.now() - loaderStart;
  const remaining = Math.max(0, LOADER_MIN_TIME - elapsed);

  setTimeout(() => {
    loader.classList.add("hidden");
  }, remaining);
}
