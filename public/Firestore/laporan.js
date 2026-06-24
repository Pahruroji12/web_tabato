// ============================================================
// ADMIN: LAPORAN
// Laporan penjualan per tanggal: kartu stat (Total, Tunai, QRIS),
// grafik tren 7 hari, produk terlaris, ringkasan, dan cetak laporan.
// ============================================================

import { allOrders, getMenu } from "../admin/state.js";
import { db, collection, query, where, orderBy, getDocs } from "../firebase-config.js";
import { formatRp } from "./utils.js";

export async function loadLaporan() {
  // --- 1. Baca tanggal dari input, default ke hari ini ---
  const dateInput = document.getElementById("reportDate");
  let targetDateStr = dateInput ? dateInput.value : "";
  if (!targetDateStr) {
    const today = new Date();
    targetDateStr =
      today.getFullYear() +
      "-" +
      String(today.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(today.getDate()).padStart(2, "0");
    if (dateInput) dateInput.value = targetDateStr;
  }

  // --- 2. Hitung rentang tanggal: 7 hari ke belakang dari tanggal terpilih ---
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

  // Awal rentang 7 hari = targetDate - 6 hari
  const chartStartDate = new Date(targetDate);
  chartStartDate.setDate(chartStartDate.getDate() - 6);
  chartStartDate.setHours(0, 0, 0, 0);

  // --- 3. Tampilkan loading ---
  document.getElementById("laporanStats").innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--text-muted)"><span class="spinner"></span> Memuat statistik...</div>`;
  document.getElementById("laporanChart").innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-muted);width:100%"><span class="spinner"></span> Memuat grafik...</div>`;
  document.getElementById("laporanTerlaris").innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-muted)"><span class="spinner"></span> Memuat produk terlaris...</div>`;
  document.getElementById("laporanSummary").innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-muted)"><span class="spinner"></span> Memuat ringkasan...</div>`;

  // --- 4. Query Firestore: ambil semua pesanan dari chartStartDate s/d endDate ---
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
    console.warn("Gagal memuat laporan dari Firestore, menggunakan data lokal fallback:", err);
    allFetchedOrders = allOrders.filter((o) => {
      const t = o.waktu_pesan?.toDate
        ? o.waktu_pesan.toDate()
        : new Date(o.waktu_pesan || 0);
      return t >= chartStartDate && t <= endDate;
    });
  }

  // --- 5. Filter pesanan HANYA untuk tanggal terpilih (stat cards & summary) ---
  const ordersOnDate = allFetchedOrders.filter((o) => {
    const t = o.waktu_pesan?.toDate
      ? o.waktu_pesan.toDate()
      : new Date(o.waktu_pesan || 0);
    return t >= targetDate && t <= endDate;
  });

  const selesai = ordersOnDate.filter((o) => o.status === "selesai");
  const totalRev = selesai.reduce((s, o) => s + (o.total_harga || 0), 0);
  const avgOrder = selesai.length > 0 ? Math.round(totalRev / selesai.length) : 0;

  // --- 6. Pisahkan pendapatan Tunai vs QRIS ---
  const selesaiTunai = selesai.filter(
    (o) => o.metode_bayar === "tunai" || o.metode_bayar === "cash"
  );
  const selesaiQris = selesai.filter((o) => o.metode_bayar === "qris");

  const totalTunai = selesaiTunai.reduce((s, o) => s + (o.total_harga || 0), 0);
  const totalQris = selesaiQris.reduce((s, o) => s + (o.total_harga || 0), 0);

  // Label tanggal terpilih untuk tampilan
  const tanggalLabel = targetDate.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // --- 7. Stat cards (6 kartu) ---
  document.getElementById("laporanStats").innerHTML = `
    <div class="stat-card">
      <div class="stat-icon" style="background:var(--accent-soft)"><i class='bx bxs-dollar-circle' style="color:var(--accent)"></i></div>
      <div class="stat-body"><div class="stat-label">Total Pendapatan</div><div class="stat-value">${formatRp(totalRev)}</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icon" style="background:rgba(16,185,129,.12)"><i class='bx bxs-wallet' style="color:#10b981"></i></div>
      <div class="stat-body"><div class="stat-label">Pendapatan Tunai</div><div class="stat-value">${formatRp(totalTunai)}</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icon" style="background:rgba(99,102,241,.12)"><i class='bx bxs-credit-card' style="color:#6366f1"></i></div>
      <div class="stat-body"><div class="stat-label">Pendapatan QRIS</div><div class="stat-value">${formatRp(totalQris)}</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icon" style="background:var(--success-soft)"><i class='bx bxs-check-circle' style="color:var(--success)"></i></div>
      <div class="stat-body"><div class="stat-label">Transaksi Selesai</div><div class="stat-value">${selesai.length}</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icon" style="background:var(--info-soft)"><i class='bx bxs-receipt' style="color:var(--info)"></i></div>
      <div class="stat-body"><div class="stat-label">Total Pesanan</div><div class="stat-value">${ordersOnDate.length}</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icon" style="background:var(--warning-soft)"><i class='bx bxs-bar-chart-alt-2' style="color:var(--warning)"></i></div>
      <div class="stat-body"><div class="stat-label">Rata-rata Order</div><div class="stat-value">${formatRp(avgOrder)}</div></div>
    </div>
  `;

  // --- 8. Chart tren 7 hari ke belakang dari tanggal terpilih ---
  const dayData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(targetDate);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const e = new Date(d);
    e.setHours(23, 59, 59, 999);
    const rev = allFetchedOrders
      .filter((o) => {
        if (o.status !== "selesai") return false;
        const t = o.waktu_pesan?.toDate
          ? o.waktu_pesan.toDate()
          : new Date(o.waktu_pesan || 0);
        return t >= d && t <= e;
      })
      .reduce((s, o) => s + (o.total_harga || 0), 0);
    dayData.push({
      label: d.toLocaleDateString("id-ID", { weekday: "short" }),
      dateLabel: d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
      rev,
      isTarget: i === 0, // hari yang dipilih
    });
  }
  const maxRev = Math.max(...dayData.map((d) => d.rev), 1);
  document.getElementById("laporanChart").innerHTML = dayData
    .map((d) => {
      const h = Math.max(4, Math.round((d.rev / maxRev) * 100));
      const barColor = d.isTarget ? "var(--accent)" : "";
      const barStyle = barColor ? `height:${h}%;background:${barColor}` : `height:${h}%`;
      return `<div class="chart-bar-col">
      <div class="chart-bar-val" style="font-size:9px">${d.rev > 0 ? formatRp(d.rev).replace("Rp ", "") : ""}</div>
      <div class="chart-bar" style="${barStyle}"></div>
      <div class="chart-bar-label">${d.label}<br><span style="font-size:9px;opacity:.7">${d.dateLabel}</span></div>
    </div>`;
    })
    .join("");

  // --- 9. Terlaris (berdasarkan tanggal terpilih) ---
  const itemCount = {};
  selesai.forEach((o) => {
    (o.detail_item || []).forEach((it) => {
      itemCount[it.nama_item] = (itemCount[it.nama_item] || 0) + it.jumlah;
    });
  });
  const sorted = Object.entries(itemCount).sort((a, b) => b[1] - a[1]);
  const maxItem = sorted[0]?.[1] || 1;

  // Bangun map nama menu -> tipe untuk menentukan satuan (box vs cup)
  const menuList = getMenu();
  const menuTypeMap = {};
  menuList.forEach((m) => { menuTypeMap[m.nama] = m.type; });
  const getUnit = (nama) => menuTypeMap[nama] === "drink" ? "cup" : "box";

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
          <span style="font-size:13px;font-weight:700;color:var(--accent)">${qty} ${getUnit(nama)}</span>
        </div>
        <div class="stock-bar"><div class="stock-fill" style="width:${Math.round((qty / maxItem) * 100)}%;background:var(--accent)"></div></div>
      </div>
    `,
          )
          .join("");

  // --- 10. Summary (ringkasan laporan) ---
  document.getElementById("laporanSummary").innerHTML = `
    <div class="report-summary-row"><span class="label">Tanggal Laporan</span><span class="val">${tanggalLabel}</span></div>
    <div class="report-summary-row"><span class="label">Total Pendapatan (selesai)</span><span class="val" style="color:var(--accent)">${formatRp(totalRev)}</span></div>
    <div class="report-summary-row"><span class="label">Pendapatan Tunai (Cash)</span><span class="val" style="color:#10b981">${formatRp(totalTunai)} <small style="opacity:.6">(${selesaiTunai.length} trx)</small></span></div>
    <div class="report-summary-row"><span class="label">Pendapatan QRIS</span><span class="val" style="color:#6366f1">${formatRp(totalQris)} <small style="opacity:.6">(${selesaiQris.length} trx)</small></span></div>
    <div class="report-summary-row"><span class="label">Transaksi Selesai</span><span class="val">${selesai.length} transaksi</span></div>
    <div class="report-summary-row"><span class="label">Total Pesanan Masuk</span><span class="val">${ordersOnDate.length} pesanan</span></div>
    <div class="report-summary-row"><span class="label">Rata-rata Nilai Order</span><span class="val">${formatRp(avgOrder)}</span></div>
    <div class="report-summary-row"><span class="label">Produk Terlaris</span><span class="val">${sorted[0]?.[0] || "—"}</span></div>
    <div class="report-summary-row"><span class="label">Pesanan Dibatalkan</span><span class="val">${ordersOnDate.filter((o) => o.status === "batal").length} pesanan</span></div>
  `;
}

export function bindLaporanEvents() {
  // Set default tanggal ke hari ini
  const dateInput = document.getElementById("reportDate");
  if (dateInput) {
    const today = new Date();
    dateInput.value =
      today.getFullYear() +
      "-" +
      String(today.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(today.getDate()).padStart(2, "0");
    dateInput.addEventListener("change", loadLaporan);
  }
}

export function printReport() {
  const printArea = document.getElementById("laporanPrintArea").innerHTML;
  const statsArea = document.getElementById("laporanStats").innerHTML;

  // Baca tanggal yang sedang dipilih untuk judul cetak
  const dateInput = document.getElementById("reportDate");
  let printDateLabel = new Date().toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  if (dateInput && dateInput.value) {
    const p = dateInput.value.split("-");
    const d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    printDateLabel = d.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }

  const win = window.open("", "_blank");
  win.document.write(`<!DOCTYPE html><html><head>
    <title>Laporan Tabato</title>
    <style>
      body { font-family: 'Inter', sans-serif; padding: 30px; color: #111; }
      h1 { font-size: 22px; margin-bottom: 4px; }
      .report-summary-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; font-size: 14px; }
      .label { color: #666; }
      .val { font-weight: 700; }
      .stat-card { display: inline-block; border: 1px solid #eee; border-radius: 10px; padding: 14px 18px; margin: 6px; vertical-align: top; min-width: 140px; }
      .stat-label { font-size: 11px; color: #888; }
      .stat-value { font-size: 18px; font-weight: 800; }
      .stat-icon { display: none; }
      @media print { button { display: none; } }
    </style>
  </head><body>
    <h1>Laporan Penjualan Tabato</h1>
    <p style="color:#888;margin-bottom:20px">Tanggal: ${printDateLabel} &mdash; Dicetak: ${new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
    <div>${statsArea}</div>
    <hr style="margin:20px 0">
    ${printArea}
    <script>window.print(); window.close();<\/script>
  </body></html>`);
  win.document.close();
}
