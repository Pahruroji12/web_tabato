// ============================================================
// ADMIN: DASHBOARD
// Kartu statistik harian, widget pesanan aktif & stok rendah,
// dan grafik pendapatan 7 hari terakhir.
// ============================================================

import { allOrders, getMenu, getStok, adminSettings } from "../admin/state.js";
import { db, collection, query, where, getAggregateFromServer, sum } from "../firebase-config.js";
import { formatRp, statusBadge } from "./utils.js";

export async function renderDashboard() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayOrders = allOrders.filter((o) => {
    const d = o.waktu_pesan?.toDate
      ? o.waktu_pesan.toDate()
      : new Date(o.waktu_pesan || 0);
    return d >= today;
  });

  const todayRevenue = todayOrders
    .filter((o) => o.status === "selesai")
    .reduce((s, o) => s + (o.total_harga || 0), 0);

  // Hitung total pendapatan secara efisien menggunakan server-side aggregation (hemat memory & reads)
  let totalRevenue = 0;
  try {
    const qSelesai = query(collection(db, "pesanan"), where("status", "==", "selesai"));
    const snapshot = await getAggregateFromServer(qSelesai, {
      totalRev: sum("total_harga")
    });
    totalRevenue = snapshot.data().totalRev || 0;
  } catch (err) {
    console.warn("Gagal menghitung total pendapatan agregat:", err);
    totalRevenue = allOrders
      .filter((o) => o.status === "selesai")
      .reduce((s, o) => s + (o.total_harga || 0), 0);
  }

  const activeCount = allOrders.filter(
    (o) =>
      o.status === "baru" ||
      o.status === "proses" ||
      o.status === "menunggu_verifikasi",
  ).length;
  const todayTrx = todayOrders.length;

  document.getElementById("statGrid").innerHTML = `
    <div class="stat-card">
      <div class="stat-icon" style="background:var(--accent-soft)"><i class='bx bxs-dollar-circle' style="color:var(--accent)"></i></div>
      <div class="stat-body">
        <div class="stat-label">Pendapatan Hari Ini</div>
        <div class="stat-value">${formatRp(todayRevenue)}</div>
        <div class="stat-sub">dari pesanan selesai</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon" style="background:var(--info-soft)"><i class='bx bxs-shopping-bags' style="color:var(--info)"></i></div>
      <div class="stat-body">
        <div class="stat-label">Transaksi Hari Ini</div>
        <div class="stat-value">${todayTrx}</div>
        <div class="stat-sub">pesanan masuk</div>
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

  // Active orders widget
  const active = allOrders
    .filter(
      (o) =>
        o.status === "baru" ||
        o.status === "proses" ||
        o.status === "menunggu_verifikasi",
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
    `,
      )
      .join("");
  }

  // Low stock widget
  const menu = getMenu();
  const lowStock = menu
    .filter((m) => m.id !== "tb-mix" && m.type !== "mix" && getStok(m.id) <= (adminSettings.minStok || 10))
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

  // 7 Day chart
  renderWeekChart();
}

function renderWeekChart() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);
    const rev = allOrders
      .filter((o) => {
        const t = o.waktu_pesan?.toDate
          ? o.waktu_pesan.toDate()
          : new Date(o.waktu_pesan || 0);
        return o.status === "selesai" && t >= d && t <= end;
      })
      .reduce((s, o) => s + (o.total_harga || 0), 0);
    days.push({
      label: d.toLocaleDateString("id-ID", { weekday: "short" }),
      rev,
    });
  }

  const max = Math.max(...days.map((d) => d.rev), 1);
  document.getElementById("weekChart").innerHTML = days
    .map((d) => {
      const h = Math.max(4, Math.round((d.rev / max) * 100));
      return `<div class="chart-bar-col">
      <div class="chart-bar-val">${d.rev > 0 ? formatRp(d.rev).replace("Rp ", "") : ""}</div>
      <div class="chart-bar" style="height:${h}%" title="${formatRp(d.rev)}"></div>
      <div class="chart-bar-label">${d.label}</div>
    </div>`;
    })
    .join("");
}
