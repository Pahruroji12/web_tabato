// ============================================================
// ADMIN: DASHBOARD
// Kartu statistik per tanggal (Tunai/QRIS terpisah), widget
// pesanan aktif & stok rendah, dan grafik pendapatan 7 hari.
// ============================================================

import { allOrders, getMenu, getStok, adminSettings } from "../admin/state.js";
import { db, collection, query, where, orderBy, getDocs, getAggregateFromServer, sum } from "../firebase-config.js";
import { formatRp, statusBadge } from "./utils.js";

/** Helper: format Date ke string YYYY-MM-DD */
function toDateStr(d) {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

export async function renderDashboard() {
  // --- 1. Baca tanggal dari input, default ke hari ini ---
  const dateInput = document.getElementById("dashDate");
  let targetDateStr = dateInput ? dateInput.value : "";
  if (!targetDateStr) {
    targetDateStr = toDateStr(new Date());
    if (dateInput) dateInput.value = targetDateStr;
  }

  const parts = targetDateStr.split("-");
  const targetDate = new Date(
    Number(parts[0]),
    Number(parts[1]) - 1,
    Number(parts[2]),
    0, 0, 0, 0
  );
  const endDate = new Date(
    Number(parts[0]),
    Number(parts[1]) - 1,
    Number(parts[2]),
    23, 59, 59, 999
  );

  // Rentang 7 hari ke belakang untuk grafik
  const chartStartDate = new Date(targetDate);
  chartStartDate.setDate(chartStartDate.getDate() - 6);
  chartStartDate.setHours(0, 0, 0, 0);

  // --- 2. Loading placeholder ---
  document.getElementById("statGrid").innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--text-muted)"><span class="spinner"></span> Memuat statistik...</div>`;

  // --- 3. Query Firestore: pesanan di rentang 7 hari ---
  let allFetchedOrders = [];
  try {
    const q = query(
      collection(db, "pesanan"),
      where("waktu_pesan", ">=", chartStartDate),
      where("waktu_pesan", "<=", endDate),
      orderBy("waktu_pesan", "desc")
    );
    const snap = await getDocs(q);
    allFetchedOrders = snap.docs.map((d) => ({ docId: d.id, ...d.data() }));
  } catch (err) {
    console.warn("Gagal memuat dashboard dari Firestore, menggunakan data lokal fallback:", err);
    allFetchedOrders = allOrders.filter((o) => {
      const t = o.waktu_pesan?.toDate
        ? o.waktu_pesan.toDate()
        : new Date(o.waktu_pesan || 0);
      return t >= chartStartDate && t <= endDate;
    });
  }

  // --- 4. Filter pesanan HANYA untuk tanggal terpilih ---
  const ordersOnDate = allFetchedOrders.filter((o) => {
    const t = o.waktu_pesan?.toDate
      ? o.waktu_pesan.toDate()
      : new Date(o.waktu_pesan || 0);
    return t >= targetDate && t <= endDate;
  });

  const selesai = ordersOnDate.filter((o) => o.status === "selesai");
  const dateRevenue = selesai.reduce((s, o) => s + (o.total_harga || 0), 0);

  // --- 5. Pisahkan Tunai vs QRIS ---
  const selesaiTunai = selesai.filter(
    (o) => o.metode_bayar === "tunai" || o.metode_bayar === "cash"
  );
  const selesaiQris = selesai.filter((o) => o.metode_bayar === "qris");

  const totalTunai = selesaiTunai.reduce((s, o) => s + (o.total_harga || 0), 0);
  const totalQris = selesaiQris.reduce((s, o) => s + (o.total_harga || 0), 0);

  // --- 6. Total pendapatan sepanjang waktu (server-side aggregation) ---
  let totalRevenue = 0;
  try {
    const qSelesai = query(collection(db, "pesanan"), where("status", "==", "selesai"));
    const snapshot = await getAggregateFromServer(qSelesai, {
      totalRev: sum("total_harga"),
    });
    totalRevenue = snapshot.data().totalRev || 0;
  } catch (err) {
    console.warn("Gagal menghitung total pendapatan agregat:", err);
    totalRevenue = allOrders
      .filter((o) => o.status === "selesai")
      .reduce((s, o) => s + (o.total_harga || 0), 0);
  }

  // Pesanan aktif (real-time dari allOrders)
  const activeCount = allOrders.filter(
    (o) =>
      o.status === "baru" ||
      o.status === "proses" ||
      o.status === "menunggu_verifikasi"
  ).length;

  const dateTrx = ordersOnDate.length;

  // Label tanggal
  const tanggalLabel = targetDate.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // --- 7. Stat cards (6 kartu) ---
  document.getElementById("statGrid").innerHTML = `
    <div class="stat-card">
      <div class="stat-icon" style="background:var(--accent-soft)"><i class='bx bxs-dollar-circle' style="color:var(--accent)"></i></div>
      <div class="stat-body">
        <div class="stat-label">Pendapatan ${tanggalLabel.split(",")[0]}</div>
        <div class="stat-value">${formatRp(dateRevenue)}</div>
        <div class="stat-sub">dari ${selesai.length} pesanan selesai</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon" style="background:rgba(16,185,129,.12)"><i class='bx bxs-wallet' style="color:#10b981"></i></div>
      <div class="stat-body">
        <div class="stat-label">Pendapatan Tunai</div>
        <div class="stat-value">${formatRp(totalTunai)}</div>
        <div class="stat-sub">${selesaiTunai.length} transaksi tunai</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon" style="background:rgba(99,102,241,.12)"><i class='bx bxs-credit-card' style="color:#6366f1"></i></div>
      <div class="stat-body">
        <div class="stat-label">Pendapatan QRIS</div>
        <div class="stat-value">${formatRp(totalQris)}</div>
        <div class="stat-sub">${selesaiQris.length} transaksi QRIS</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon" style="background:var(--info-soft)"><i class='bx bxs-shopping-bags' style="color:var(--info)"></i></div>
      <div class="stat-body">
        <div class="stat-label">Transaksi Masuk</div>
        <div class="stat-value">${dateTrx}</div>
        <div class="stat-sub">pesanan pada tanggal ini</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon" style="background:var(--warning-soft)"><i class='bx bxs-time-five' style="color:var(--warning)"></i></div>
      <div class="stat-body">
        <div class="stat-label">Pesanan Aktif</div>
        <div class="stat-value">${activeCount}</div>
        <div class="stat-sub">perlu diproses</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon" style="background:var(--success-soft)"><i class='bx bxs-dollar-circle' style="color:var(--success)"></i></div>
      <div class="stat-body">
        <div class="stat-label">Total Pendapatan</div>
        <div class="stat-value">${formatRp(totalRevenue)}</div>
        <div class="stat-sub">sepanjang waktu</div>
      </div>
    </div>
  `;

  // --- 8. Active orders widget (real-time, tidak tergantung filter tanggal) ---
  const active = allOrders
    .filter(
      (o) =>
        o.status === "baru" ||
        o.status === "proses" ||
        o.status === "menunggu_verifikasi"
    )
    .slice(0, 5);
  const ao = document.getElementById("dashActiveOrders");
  if (active.length === 0) {
    ao.innerHTML = `<div class="empty-state" style="padding:24px 0"><i class='bx bx-check-circle'></i><p>Tidak ada pesanan aktif</p></div>`;
  } else {
    ao.innerHTML = active
      .map(
        (o) => `
      <div style="padding:10px 0;border-bottom:1px solid var(--card-border);display:flex;align-items:center;justify-content:space-between;gap:10px;">
        <div>
          <div style="font-size:13px;font-weight:700;">${o.nama_pemesan}</div>
          <div style="font-size:11px;color:var(--text-muted);">${o.id_pesanan} &middot; ${formatRp(o.total_harga)}</div>
        </div>
        ${statusBadge(o.status)}
      </div>
    `
      )
      .join("");
  }

  // --- 9. Low stock widget ---
  const menu = getMenu();
  const lowStock = menu
    .filter(
      (m) =>
        m.id !== "tb-mix" &&
        m.type !== "mix" &&
        getStok(m.id) <= (adminSettings.minStok || 10)
    )
    .slice(0, 6);
  const ls = document.getElementById("dashLowStock");
  if (lowStock.length === 0) {
    ls.innerHTML = `<div class="empty-state" style="padding:24px 0"><i class='bx bx-check-circle'></i><p>Semua stok aman</p></div>`;
  } else {
    ls.innerHTML = lowStock
      .map((m) => {
        const s = getStok(m.id);
        return `<div style="padding:8px 0;border-bottom:1px solid var(--card-border);display:flex;align-items:center;justify-content:space-between;gap:10px;">
        <div style="font-size:13px;font-weight:600;">${m.nama}</div>
        <span class="stock-pill ${s <= 0 ? "stock-empty" : "stock-low"}">${s <= 0 ? "Habis" : s + " unit"}</span>
      </div>`;
      })
      .join("");
  }

  // --- 10. Grafik 7 hari ke belakang dari tanggal terpilih ---
  renderWeekChart(allFetchedOrders, targetDate);
}

function renderWeekChart(allFetchedOrders, targetDate) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(targetDate);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);
    const rev = allFetchedOrders
      .filter((o) => {
        if (o.status !== "selesai") return false;
        const t = o.waktu_pesan?.toDate
          ? o.waktu_pesan.toDate()
          : new Date(o.waktu_pesan || 0);
        return t >= d && t <= end;
      })
      .reduce((s, o) => s + (o.total_harga || 0), 0);
    days.push({
      label: d.toLocaleDateString("id-ID", { weekday: "short" }),
      dateLabel: d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
      rev,
      isTarget: i === 0,
    });
  }

  const max = Math.max(...days.map((d) => d.rev), 1);
  document.getElementById("weekChart").innerHTML = days
    .map((d) => {
      const h = Math.max(4, Math.round((d.rev / max) * 100));
      const barColor = d.isTarget ? "var(--accent)" : "";
      const barStyle = barColor
        ? `height:${h}%;background:${barColor}`
        : `height:${h}%`;
      return `<div class="chart-bar-col">
      <div class="chart-bar-val">${d.rev > 0 ? formatRp(d.rev).replace("Rp ", "") : ""}</div>
      <div class="chart-bar" style="${barStyle}" title="${formatRp(d.rev)}"></div>
      <div class="chart-bar-label">${d.label}<br><span style="font-size:9px;opacity:.7">${d.dateLabel}</span></div>
    </div>`;
    })
    .join("");
}

export function bindDashboardEvents() {
  const dateInput = document.getElementById("dashDate");
  if (dateInput) {
    dateInput.value = toDateStr(new Date());
    dateInput.addEventListener("change", renderDashboard);
  }
}
