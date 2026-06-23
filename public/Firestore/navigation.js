// ============================================================
// ADMIN: NAVIGATION
// Routing antar "halaman" (page) di dalam single-page admin,
// plus toggle sidebar mobile.
//
// Memakai pola registry (bukan import langsung) supaya modul ini
// tidak perlu tahu isi dashboard/kasir/produk/dst — masing-masing
// modul mendaftarkan render function-nya sendiri lewat
// registerPageRenderer(), dipanggil dari admin/main.js saat init.
// ============================================================

const PAGE_TITLES = {
  dashboard: "Dashboard",
  kasir: "Kasir / POS",
  produk: "Manajemen Produk",
  topping: "Manajemen Topping",
  stok: "Manajemen Stok",
  riwayat: "Riwayat Transaksi",
  laporan: "Laporan",
  settings: "Pengaturan",
};

const pageRenderers = {};

export function registerPageRenderer(pageId, renderFn) {
  pageRenderers[pageId] = renderFn;
}

export function navigate(pageId) {
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  document
    .querySelectorAll(".nav-item")
    .forEach((n) => n.classList.remove("active"));
  document.getElementById("page-" + pageId).classList.add("active");
  document
    .querySelector(`.nav-item[data-page="${pageId}"]`)
    .classList.add("active");
  document.getElementById("topbarTitle").textContent = PAGE_TITLES[pageId];
  closeSidebar();

  const render = pageRenderers[pageId];
  if (render) render();
}

export function getActivePageId() {
  const activePage = document.querySelector(".page.active");
  return activePage ? activePage.id.replace("page-", "") : null;
}

export function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebarOverlay").classList.remove("active");
}

export function bindNavigationEvents() {
  document.querySelectorAll(".nav-item[data-page]").forEach((item) => {
    item.addEventListener("click", () => navigate(item.dataset.page));
  });

  document.getElementById("menuToggle").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
    document.getElementById("sidebarOverlay").classList.toggle("active");
  });
  document
    .getElementById("sidebarOverlay")
    .addEventListener("click", closeSidebar);
}
