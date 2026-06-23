// ============================================================
// ADMIN: THEME
// Dark/light mode untuk dashboard admin. Default: light mode
// (tidak ikut preferensi OS), kecuali user pernah memilih dark
// sebelumnya (tersimpan di localStorage).
// ============================================================

const THEME_KEY = "tabato-admin-theme";

export function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const isDark = saved === "dark"; // default: light mode
  document.documentElement.classList.toggle("dark", isDark);
  updateThemeBtn(isDark);
}

export function toggleTheme() {
  const isDark = document.documentElement.classList.toggle("dark");
  localStorage.setItem(THEME_KEY, isDark ? "dark" : "light");
  updateThemeBtn(isDark);
}

function updateThemeBtn(isDark) {
  const btn = document.getElementById("themeToggle");
  btn.innerHTML = isDark
    ? `<i class='bx bx-sun'></i>`
    : `<i class='bx bx-moon'></i>`;
}

export function bindThemeToggle() {
  document.getElementById("themeToggle").addEventListener("click", toggleTheme);
}
