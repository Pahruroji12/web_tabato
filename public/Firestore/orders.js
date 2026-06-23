// ============================================================
// ADMIN: ORDERS
// Listener real-time ke koleksi Firestore "pesanan", plus aksi
// update status pesanan, modal detail pesanan, pembuatan pesanan
// offline (walk-in), dan notifikasi saat ada pesanan baru masuk.
// ============================================================

import {
  db,
  collection,
  setDoc,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  limit,
} from "../firebase-config.js";
import {
  allOrders,
  setAllOrders,
  getMenu,
  getStok,
  setStok,
  deductStockForOrder,
  restoreStockForOrder,
} from "../admin/state.js";
import {
  formatRp,
  formatDate,
  statusBadge,
  showToast,
  openModal,
  escapeHTML,
} from "./utils.js";
import { getActivePageId } from "./navigation.js";

let orderUnsubscribe = null;
let isFirstSnapshot = true; // batch pertama saat load = bukan "pesanan baru", jangan dinotifikasi
const knownDocIds = new Set();

// Dipanggil oleh main.js setiap kali snapshot pesanan berubah,
// supaya halaman yang sedang aktif ikut me-render ulang.
let onOrdersChanged = () => {};
export function setOnOrdersChanged(fn) {
  onOrdersChanged = fn;
}

export function subscribeOrders() {
  if (orderUnsubscribe) orderUnsubscribe();
  isFirstSnapshot = true;
  knownDocIds.clear();

  const q = query(
    collection(db, "pesanan"),
    orderBy("waktu_pesan", "desc"),
    limit(150)
  );
  orderUnsubscribe = onSnapshot(
    q,
    (snap) => {
      const orders = snap.docs.map((d) => ({ docId: d.id, ...d.data() }));
      setAllOrders(orders);

      // ---- Deteksi pesanan baru yang sungguh-sungguh baru masuk ----
      // (bukan data lama yang baru kebaca saat halaman pertama kali dimuat)
      const newlyArrived = [];
      orders.forEach((o) => {
        if (!knownDocIds.has(o.docId)) {
          knownDocIds.add(o.docId);
          if (!isFirstSnapshot && o.sumber !== "offline") {
            newlyArrived.push(o);
          }
        }
      });
      isFirstSnapshot = false;

      if (newlyArrived.length > 0) {
        notifyNewOrders(newlyArrived);
      }

      const activeCount = allOrders.filter(
        (o) =>
          o.status === "baru" ||
          o.status === "proses" ||
          o.status === "menunggu_verifikasi",
      ).length;
      const badge = document.getElementById("orderBadge");
      if (activeCount > 0) {
        badge.textContent = activeCount;
        badge.style.display = "flex";
      } else {
        badge.style.display = "none";
      }

      const activeId = getActivePageId();
      onOrdersChanged(activeId);
    },
    (err) => {
      console.error("Firebase listen error:", err);
    },
  );
}

// ============================================================
// NOTIFIKASI PESANAN BARU (banner in-app + suara + Browser Notification)
// ============================================================
function notifyNewOrders(orders) {
  const first = orders[0];
  const desc =
    orders.length === 1
      ? `${first.nama_pemesan} &middot; ${formatRp(first.total_harga || 0)}`
      : `${orders.length} pesanan baru masuk`;

  // ---- Banner di dalam halaman ----
  const banner = document.getElementById("newOrderBanner");
  document.getElementById("newOrderBannerTitle").textContent =
    orders.length === 1
      ? "Pesanan baru masuk!"
      : `${orders.length} Pesanan Baru Masuk!`;
  document.getElementById("newOrderBannerDesc").innerHTML = desc;
  banner.classList.add("visible");
  clearTimeout(banner._hideTimer);
  banner._hideTimer = setTimeout(
    () => banner.classList.remove("visible"),
    6000,
  );

  // ---- Suara notifikasi ----
  const sound = document.getElementById("newOrderSound");
  if (sound) {
    sound.currentTime = 0;
    sound.play().catch(() => {
      /* Browser bisa menolak autoplay sebelum ada interaksi user pertama kali; abaikan diam-diam */
    });
  }

  // ---- Getaran Perangkat (Vibration API untuk Android Mobile) ----
  if ("vibrate" in navigator) {
    navigator.vibrate([300, 150, 300]); // bergetar 300ms, jeda 150ms, bergetar 300ms
  }

  // ---- Browser Notification (tetap muncul walau tab di background) ----
  sendBrowserNotification(
    orders.length === 1
      ? `Pesanan Baru: ${first.nama_pemesan}`
      : `${orders.length} Pesanan Baru Masuk`,
    orders.length === 1
      ? `${first.id_pesanan} — ${formatRp(first.total_harga || 0)}`
      : "Buka dashboard untuk melihat detail",
  );

  // ---- Toast biasa juga, untuk konsistensi ----
  showToast(
    orders.length === 1
      ? `Pesanan baru dari ${first.nama_pemesan}`
      : `${orders.length} pesanan baru masuk`,
    "bx-bell-ring",
  );
}

function sendBrowserNotification(title, body) {
  if (typeof Notification === "undefined") return;

  if (Notification.permission === "granted") {
    new Notification(title, { body, icon: "/favicon.ico" });
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then((perm) => {
      if (perm === "granted") {
        new Notification(title, { body, icon: "/favicon.ico" });
      }
    });
  }
}

export function bindNotificationEvents() {
  document
    .getElementById("newOrderBannerClose")
    .addEventListener("click", () => {
      document.getElementById("newOrderBanner").classList.remove("visible");
    });

  // Minta izin notifikasi browser lebih awal (saat admin pertama klik di halaman),
  // supaya saat pesanan masuk nanti, browser tidak perlu minta izin mendadak.
  if (
    typeof Notification !== "undefined" &&
    Notification.permission === "default"
  ) {
    document.addEventListener(
      "click",
      () => {
        Notification.requestPermission();
      },
      { once: true },
    );
  }
}

// ============================================================
// UPDATE STATUS PESANAN (proses/selesai/batal)
// ============================================================
export async function updateOrderStatus(docId, newStatus, detailItems) {
  try {
    const order = allOrders.find((o) => o.docId === docId);
    const oldStatus = order ? order.status : null;
    const items = detailItems || (order ? order.detail_item : null);

    await updateDoc(doc(db, "pesanan", docId), { status: newStatus });

    // Kurangi stok saat proses (baru/menunggu_verifikasi -> proses)
    if (newStatus === "proses" && items) {
      if (oldStatus !== "proses") {
        await deductStockForOrder(items, docId, "Sistem");
      }
    }

    // Kembalikan stok jika pesanan dibatalkan setelah sebelumnya diproses (proses -> batal)
    if (newStatus === "batal" && items) {
      if (oldStatus === "proses") {
        await restoreStockForOrder(items, docId, "Sistem");
      }
    }

    showToast(`Status diperbarui: ${newStatus}`, "bx-check-circle");
  } catch (e) {
    console.error("Gagal memperbarui status:", e);
    showToast("Gagal memperbarui status", "bx-error-circle");
  }
}

// ============================================================
// PESANAN OFFLINE (walk-in, input manual oleh kasir)
// Disimpan ke koleksi Firestore yang sama ("pesanan") supaya ikut
// muncul di riwayat & laporan, dengan status langsung "selesai"
// karena pembayaran sudah diterima saat itu juga di kasir.
// ============================================================
function generateResiOffline() {
  const date = new Date();
  const ymd = date.toISOString().slice(2, 10).replace(/-/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `TBT-OFF-${ymd}-${rand}`;
}

export async function createOfflineOrder({
  nama_pemesan,
  detail_item,
  total_harga,
  metode_bayar,
  uang_diterima,
  kembalian,
}) {
  const resi = generateResiOffline();
  const pesananDoc = {
    id_pesanan: resi,
    nama_pemesan,
    no_wa: "-",
    lokasi_antar: "Diambil langsung di kasir",
    detail_item,
    total_harga,
    status: "selesai",
    sumber: "offline",
    metode_bayar,
    uang_diterima,
    kembalian,
    waktu_pesan: serverTimestamp(),
  };
  await setDoc(doc(db, "pesanan", resi), pesananDoc);
  return resi;
}

// ============================================================
// MODAL DETAIL PESANAN
// ============================================================
export function showOrderDetail(docId) {
  const o = allOrders.find((x) => x.docId === docId);
  if (!o) return;
  const sumberLabel = o.sumber === "offline" ? "Offline (Walk-in)" : "Online";
  const metodeBayarLabel = o.metode_bayar === "qris" ? "QRIS" : "Tunai";
  const bayarInfo =
    o.metode_bayar === "tunai" && o.uang_diterima
      ? `<div style="font-size:12px;color:var(--text-muted);margin-top:2px;">Diterima: ${formatRp(o.uang_diterima)} &middot; Kembalian: ${formatRp(o.kembalian || 0)}</div>`
      : "";

  document.getElementById("orderDetailContent").innerHTML = `
    <div style="margin-bottom:16px;">
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">Nomor Resi</div>
      <div style="font-size:18px;font-weight:800;color:var(--accent)">${escapeHTML(o.id_pesanan)}</div>
    </div>
    <div class="two-col" style="margin-bottom:14px;">
      <div><div class="form-label">Nama</div><strong>${escapeHTML(o.nama_pemesan)}</strong></div>
      <div><div class="form-label">WhatsApp</div><strong>${escapeHTML(o.no_wa || "—")}</strong></div>
    </div>
    <div class="two-col" style="margin-bottom:14px;">
      <div><div class="form-label">Sumber Pesanan</div><strong>${sumberLabel}</strong></div>
      <div>
        <div class="form-label">Metode Bayar</div>
        <strong>${metodeBayarLabel}</strong>
        ${bayarInfo}
      </div>
    </div>
    <div style="margin-bottom:14px;"><div class="form-label">Lokasi Antar</div><strong>${escapeHTML(o.lokasi_antar)}</strong></div>
    <div style="margin-bottom:14px;">
      <div class="form-label">Item Pesanan</div>
      <table style="width:100%;font-size:13px;">
        <thead><tr><th style="text-align:left;padding:6px 0;color:var(--text-muted);font-size:11px;">Produk</th><th style="text-align:center">Qty</th><th style="text-align:right">Subtotal</th></tr></thead>
        <tbody>
          ${(o.detail_item || [])
            .map(
              (it) => `
            <tr>
              <td style="padding:6px 0">${escapeHTML(it.nama_item)}<br><small style="color:var(--text-muted)">${escapeHTML(it.varian_toping)}</small></td>
              <td style="text-align:center">×${it.jumlah}</td>
              <td style="text-align:right;font-weight:700">${formatRp(it.subtotal)}</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
    <div class="divider"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <span style="font-weight:700">Total</span>
      <span style="font-size:18px;font-weight:800;color:var(--accent)">${formatRp(o.total_harga)}</span>
    </div>
    <div style="margin-top:12px;">Status: ${statusBadge(o.status)}</div>
    <div style="color:var(--text-muted);font-size:12px;margin-top:4px;">${formatDate(o.waktu_pesan)}</div>
  `;
  openModal("modalOrder");
}
