export async function initGlobalHeader() {
  const headerRight = document.getElementById("headerRight");

  const { data } = await supabase.auth.getSession();
  const user = data?.session?.user;

  if (!user) {
    headerRight.innerHTML = `
      <button class="header-btn" id="loginBtn">Войти</button>
      <button class="header-btn" id="registerBtn">Регистрация</button>
    `;
    return;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .single();

  const fullName = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();

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

  // обработчики меню
  const profileBtn = document.getElementById("profileBtn");
  const profileMenu = document.getElementById("profileMenu");

  profileBtn.onclick = () => profileMenu.classList.toggle("active");

  document.addEventListener("click", (e) => {
    if (!profileMenu.contains(e.target) && !profileBtn.contains(e.target)) {
      profileMenu.classList.remove("active");
    }
  });

  document.getElementById("menuDashboard").onclick = () =>
    (window.location.href = "/dashboard.html");

  document.getElementById("menuAccount").onclick = () =>
    (window.location.href = "/auth/account.html");

  document.getElementById("menuLogout").onclick = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth/index.html";
  };
}

document.addEventListener("DOMContentLoaded", () => {
  const loader = document.getElementById("pageLoader");
  if (!loader) return;

  // небольшая задержка для стабилизации рендера
  const MIN_VISIBLE_TIME = 450;

  const start = performance.now();

  requestAnimationFrame(() => {
    const elapsed = performance.now() - start;
    const remaining = Math.max(0, MIN_VISIBLE_TIME - elapsed);

    setTimeout(() => {
      loader.classList.add("hidden");
    }, remaining);
  });
});
