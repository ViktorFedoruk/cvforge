import { supabase } from "./supabase.js";

export async function initGlobalHeader() {
  const headerContainer = document.getElementById("globalHeaderMount");
  if (!headerContainer) return;

  // Загружаем HTML хедера
  const res = await fetch("/components/header.html");
  const html = await res.text();
  headerContainer.innerHTML = html;

  const headerRight = document.getElementById("headerRight");

    const { data } = await supabase.auth.getSession();
    const user = data?.session?.user;

        // Если пользователь НЕ авторизован
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

        return;
    }

    // Загружаем профиль
    let fullName = "Профиль";

    const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .single();

    // Если профиль существует — используем его
    if (profileData) {
        fullName = `${profileData.first_name ?? ""} ${profileData.last_name ?? ""}`.trim();
    }

  // ============================
  // Если пользователь авторизован
  // ============================
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

  // Открытие/закрытие меню
  profileBtn.onclick = () => {
    profileMenu.classList.toggle("active");
  };

  // Закрытие при клике вне меню
  document.addEventListener("click", (e) => {
    if (!profileMenu.contains(e.target) && !profileBtn.contains(e.target)) {
      profileMenu.classList.remove("active");
    }
  });

  // Переходы
  document.getElementById("menuDashboard").onclick = () => {
    window.location.href = "/dashboard.html";
  };

  document.getElementById("menuAccount").onclick = () => {
    window.location.href = "/auth/account.html"; // ← исправлено
  };

  // Логаут
  document.getElementById("menuLogout").onclick = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth/index.html";
  };
}
