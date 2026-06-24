// ============================================================
// ADMIN: MAIN
// Entry point admin.html. Mendaftarkan page renderer ke router,
// mengekspos fungsi yang dipanggil lewat onclick="" di HTML ke
// window, dan menjalankan inisialisasi aplikasi.
// ============================================================

import { initTheme, bindThemeToggle } from "../Firestore/theme.js";
import { bindAuthEvents } from "../Firestore/auth.js";
import {
  navigate,
  registerPageRenderer,
  bindNavigationEvents,
} from "../Firestore/navigation.js";
import { closeModal, showToast } from "../Firestore/utils.js";
import {
  subscribeOrders,
  setOnOrdersChanged,
  updateOrderStatus,
  showOrderDetail,
  bindNotificationEvents,
} from "../Firestore/orders.js";
import { renderDashboard, bindDashboardEvents } from "../Firestore/dashboard.js";
import { renderKasir, bindKasirEvents } from "../Firestore/kasir.js";
import {
  renderProduk,
  openProductModal,
  saveProduk,
  deleteProduk,
  bindProdukEvents,
} from "../Firestore/produk.js";
import {
  renderTopping,
  openToppingModal,
  saveTopping,
  deleteTopping,
  bindToppingEvents,
} from "../Firestore/topping.js";
import { renderStok, openStokModal, saveStok } from "../Firestore/stok.js";
import { renderRiwayat, bindRiwayatEvents, printRiwayat } from "../Firestore/riwayat.js";
import {
  loadLaporan,
  bindLaporanEvents,
  printReport,
} from "../Firestore/laporan.js";
import {
  loadSettings,
  saveSettings,
  changePassword,
} from "../Firestore/settings.js";
import { initAdminState } from "../admin/state.js";

// ====== EXPOSE UNTUK onclick="" DI HTML ======
// Atribut onclick di markup admin.html memanggil fungsi-fungsi ini
// secara global, jadi mereka harus ditempel ke window.
window.navigate = navigate;
window.closeModal = closeModal;
window.updateOrderStatus = updateOrderStatus;
window.showOrderDetail = showOrderDetail;
window.openProductModal = openProductModal;
window.saveProduk = saveProduk;
window.deleteProduk = deleteProduk;
window.openToppingModal = openToppingModal;
window.saveTopping = saveTopping;
window.deleteTopping = deleteTopping;
window.openStokModal = openStokModal;
window.saveStok = saveStok;
window.loadLaporan = loadLaporan;
window.printReport = printReport;
window.printRiwayat = printRiwayat;
window.saveSettings = saveSettings;
window.changePassword = changePassword;

// ====== DAFTARKAN RENDERER HALAMAN KE ROUTER ======
registerPageRenderer("dashboard", renderDashboard);
registerPageRenderer("kasir", renderKasir);
registerPageRenderer("produk", renderProduk);
registerPageRenderer("topping", renderTopping);
registerPageRenderer("stok", renderStok);
registerPageRenderer("riwayat", renderRiwayat);
registerPageRenderer("laporan", loadLaporan);
registerPageRenderer("settings", loadSettings);

// Saat data pesanan berubah (real-time), re-render halaman yang sedang aktif
setOnOrdersChanged((activeId) => {
  if (activeId === "kasir") renderKasir();
  if (activeId === "dashboard") renderDashboard();
  if (activeId === "riwayat") renderRiwayat();
});

// ====== TOPBAR DATE ======
function updateDate() {
  const now = new Date();
  document.getElementById("topbarDate").textContent = now.toLocaleDateString(
    "id-ID",
    {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    },
  );
}

// ====== REFRESH BUTTON ======
function bindRefreshButton() {
  document.getElementById("refreshBtn").addEventListener("click", () => {
    const activePage = document.querySelector(".page.active");
    if (activePage) navigate(activePage.id.replace("page-", ""));
    showToast("Data diperbarui", "bx-refresh");
  });
}

// ====== CONNECTION STATUS INDICATOR ======
function initConnectionMonitor() {
  function updateStatus() {
    const el = document.getElementById("connectionStatus");
    const textEl = document.getElementById("connectionText");
    if (!el || !textEl) return;
    if (navigator.onLine) {
      el.style.background = "var(--success-bg, rgba(16,185,129,0.1))";
      el.style.color = "var(--success, #10b981)";
      textEl.textContent = "Online";
    } else {
      el.style.background = "var(--danger-bg, rgba(239,68,68,0.1))";
      el.style.color = "var(--danger, #ef4444)";
      textEl.textContent = "Offline";
    }
  }
  window.addEventListener("online", updateStatus);
  window.addEventListener("offline", updateStatus);
  updateStatus();
}

// ====== INIT APP (dipanggil setelah login sukses) ======
async function initApp() {
  initTheme();
  updateDate();
  setInterval(updateDate, 60000);
  
  // Memuat data awal dari Firestore setelah autentikasi admin berhasil
  try {
    await initAdminState();
  } catch (e) {
    console.error("Gagal memuat data awal admin setelah login:", e);
  }

  subscribeOrders();
  renderDashboard();
}


// ====== BOOTSTRAP ======
async function bootstrap() {
  const loginBtn = document.getElementById("loginBtn");
  const originalHtml = loginBtn.innerHTML;
  loginBtn.disabled = true;
  loginBtn.innerHTML = `<span class="spinner"></span> Loading...`;

  try {
    await initAdminState();
  } catch (e) {
    console.error("Gagal memuat data awal admin:", e);
  } finally {
    loginBtn.disabled = false;
    loginBtn.innerHTML = originalHtml;
  }

  bindAuthEvents(initApp);
  bindNavigationEvents();
  bindDashboardEvents();
  bindThemeToggle();
  bindKasirEvents();
  bindProdukEvents();
  bindToppingEvents();
  bindRiwayatEvents();
  bindLaporanEvents();
  bindRefreshButton();
  bindNotificationEvents();

  // Tema diterapkan dari awal walau belum login (supaya halaman login
  // juga ikut mode terang/gelap yang benar)
  initTheme();
  initConnectionMonitor();
}

document.addEventListener("DOMContentLoaded", bootstrap);
