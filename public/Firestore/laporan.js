// ============================================================
// ADMIN: LAPORAN
// Laporan penjualan per periode (hari/minggu/bulan): kartu stat,
// grafik harian, produk terlaris, ringkasan, dan cetak laporan.
// ============================================================

import { allOrders } from "../admin/state.js";
import { db, collection, query, where, orderBy, getDocs } from "../firebase-config.js";
import { formatRp } from "./utils.js";

export async function loadLaporan() {
  const period = document.getElementById("reportPeriod").value;
  const now = new Date();
  let startDate = new Date();
  if (period === "hari") {
    startDate.setHours(0, 0, 0, 0);
  } else if (period === "minggu") {
    startDate.setDate(now.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);
  } else {
    startDate.setDate(now.getDate() - 29);
    startDate.setHours(0, 0, 0, 0);
  }

  // Tampilkan loading placeholder untuk stats, chart, terlaris, dan summary
  document.getElementById("laporanStats").innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--text-muted)"><span class="spinner"></span> Memuat statistik...</div>`;
  document.getElementById("laporanChart").innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-muted);width:100%"><span class="spinner"></span> Memuat grafik...</div>`;
  document.getElementById("laporanTerlaris").innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-muted)"><span class="spinner"></span> Memuat produk terlaris...</div>`;
  document.getElementById("laporanSummary").innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-muted)"><span class="spinner"></span> Memuat ringkasan...</div>`;

  let orders = [];
  try {
    const q = query(
      collection(db, "pesanan"),
      where("waktu_pesan", ">=", startDate),
      orderBy("waktu_pesan", "desc")
    );
    const snap = await getDocs(q);
    orders = snap.docs.map((d) => ({ docId: d.id, ...d.data() }));
  } catch (err) {
    console.warn("Gagal memuat laporan dari Firestore, menggunakan data lokal fallback:", err);
    orders = allOrders.filter((o) => {
      const t = o.waktu_pesan?.toDate
        ? o.waktu_pesan.toDate()
        : new Date(o.waktu_pesan || 0);
      return t >= startDate;
    });
  }

  const selesai = orders.filter((o) => o.status === "selesai");
  const totalRev = selesai.reduce((s, o) => s + (o.total_harga || 0), 0);
  const avgOrder =
    selesai.length > 0 ? Math.round(totalRev / selesai.length) : 0;

  // Stat cards
  document.getElementById("laporanStats").innerHTML = `
    <div class="stat-card">
      <div class="stat-icon" style="background:var(--accent-soft)"><i class='bx bxs-dollar-circle' style="color:var(--accent)"></i></div>
      <div class="stat-body"><div class="stat-label">Total Pendapatan</div><div class="stat-value">${formatRp(totalRev)}</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icon" style="background:var(--success-soft)"><i class='bx bxs-check-circle' style="color:var(--success)"></i></div>
      <div class="stat-body"><div class="stat-label">Transaksi Selesai</div><div class="stat-value">${selesai.length}</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icon" style="background:var(--info-soft)"><i class='bx bxs-receipt' style="color:var(--info)"></i></div>
      <div class="stat-body"><div class="stat-label">Total Pesanan</div><div class="stat-value">${orders.length}</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icon" style="background:var(--warning-soft)"><i class='bx bxs-bar-chart-alt-2' style="color:var(--warning)"></i></div>
      <div class="stat-body"><div class="stat-label">Rata-rata Order</div><div class="stat-value">${formatRp(avgOrder)}</div></div>
    </div>
  `;

  // Chart by day
  const days = period === "hari" ? 1 : period === "minggu" ? 7 : 30;
  const dayData = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const e = new Date(d);
    e.setHours(23, 59, 59, 999);
    const rev = selesai
      .filter((o) => {
        const t = o.waktu_pesan?.toDate
          ? o.waktu_pesan.toDate()
          : new Date(o.waktu_pesan || 0);
        return t >= d && t <= e;
      })
      .reduce((s, o) => s + (o.total_harga || 0), 0);
    dayData.push({
      label: d.toLocaleDateString(
        "id-ID",
        days <= 7 ? { weekday: "short" } : { day: "2-digit", month: "short" },
      ),
      rev,
    });
  }
  const maxRev = Math.max(...dayData.map((d) => d.rev), 1);
  document.getElementById("laporanChart").innerHTML = dayData
    .map((d) => {
      const h = Math.max(4, Math.round((d.rev / maxRev) * 100));
      return `<div class="chart-bar-col">
      <div class="chart-bar-val" style="font-size:9px">${d.rev > 0 ? formatRp(d.rev).replace("Rp ", "") : ""}</div>
      <div class="chart-bar" style="height:${h}%"></div>
      <div class="chart-bar-label">${d.label}</div>
    </div>`;
    })
    .join("");

  // Terlaris
  const itemCount = {};
  selesai.forEach((o) => {
    (o.detail_item || []).forEach((it) => {
      itemCount[it.nama_item] = (itemCount[it.nama_item] || 0) + it.jumlah;
    });
  });
  const sorted = Object.entries(itemCount).sort((a, b) => b[1] - a[1]);
  const maxItem = sorted[0]?.[1] || 1;
  document.getElementById("laporanTerlaris").innerHTML =
    sorted.length === 0
      ? `<div class="empty-state" style="padding:20px"><i class='bx bx-bar-chart'></i><p>Belum ada data</p></div>`
      : sorted
          .slice(0, 7)
          .map(
            ([nama, qty], idx) => `
      <div style="padding:8px 0;border-bottom:1px solid var(--card-border)">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px">
          <span style="font-size:13px;font-weight:600">${idx + 1}. ${nama}</span>
          <span style="font-size:13px;font-weight:700;color:var(--accent)">${qty} box</span>
        </div>
        <div class="stock-bar"><div class="stock-fill" style="width:${Math.round((qty / maxItem) * 100)}%;background:var(--accent)"></div></div>
      </div>
    `,
          )
          .join("");

  // Summary
  document.getElementById("laporanSummary").innerHTML = `
    <div class="report-summary-row"><span class="label">Periode</span><span class="val">${period === "hari" ? "Hari Ini" : period === "minggu" ? "7 Hari Terakhir" : "30 Hari Terakhir"}</span></div>
    <div class="report-summary-row"><span class="label">Total Pendapatan (selesai)</span><span class="val" style="color:var(--accent)">${formatRp(totalRev)}</span></div>
    <div class="report-summary-row"><span class="label">Transaksi Selesai</span><span class="val">${selesai.length} transaksi</span></div>
    <div class="report-summary-row"><span class="label">Total Pesanan Masuk</span><span class="val">${orders.length} pesanan</span></div>
    <div class="report-summary-row"><span class="label">Rata-rata Nilai Order</span><span class="val">${formatRp(avgOrder)}</span></div>
    <div class="report-summary-row"><span class="label">Produk Terlaris</span><span class="val">${sorted[0]?.[0] || "—"}</span></div>
    <div class="report-summary-row"><span class="label">Pesanan Dibatalkan</span><span class="val">${orders.filter((o) => o.status === "batal").length} pesanan</span></div>
  `;
}

export function bindLaporanEvents() {
  document
    .getElementById("reportPeriod")
    .addEventListener("change", loadLaporan);
}

export function printReport() {
  const printArea = document.getElementById("laporanPrintArea").innerHTML;
  const statsArea = document.getElementById("laporanStats").innerHTML;
  const win = window.open("", "_blank");
  win.document.write(`<!DOCTYPE html><html><head>
    <title>Laporan Tabato</title>
    <style>
      body { font-family: 'Inter', sans-serif; padding: 30px; color: #111; }
      h1 { font-size: 22px; margin-bottom: 4px; }
      .report-summary-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; font-size: 14px; }
      .label { color: #666; }
      .val { font-weight: 700; }
      .stat-card { display: inline-block; border: 1px solid #eee; border-radius: 10px; padding: 14px 18px; margin: 6px; vertical-align: top; min-width: 160px; }
      .stat-label { font-size: 11px; color: #888; }
      .stat-value { font-size: 20px; font-weight: 800; }
      @media print { button { display: none; } }
    </style>
  </head><body>
    <h1>Laporan Penjualan Tabato</h1>
    <p style="color:#888;margin-bottom:20px">Dicetak: ${new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}</p>
    <div>${statsArea}</div>
    <hr style="margin:20px 0">
    ${printArea}
    <script>window.print(); window.close();<\/script>
  </body></html>`);
  win.document.close();
}
