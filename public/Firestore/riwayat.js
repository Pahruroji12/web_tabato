// ============================================================
// ADMIN: RIWAYAT
// Tabel riwayat transaksi dengan pencarian, filter tanggal, dan
// filter status. Query langsung ke Firestore saat filter tanggal
// digunakan agar data lengkap (tidak terbatas 150 dari allOrders).
// ============================================================

import { allOrders } from "../admin/state.js";
import { db, collection, query, where, orderBy, getDocs, Timestamp } from "../firebase-config.js";
import { formatRp, formatDate, statusBadge } from "./utils.js";

export async function renderRiwayat() {
  const q = document.getElementById("searchRiwayat").value.toLowerCase();
  const filterDate = document.getElementById("filterTanggal").value;
  const filterStatus = document.getElementById("filterStatus").value;

  let orders;

  // Jika ada filter tanggal, query langsung dari Firestore agar lengkap
  if (filterDate) {
    const startOfDay = new Date(filterDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(filterDate);
    endOfDay.setHours(23, 59, 59, 999);

    const constraints = [
      where("waktu_pesan", ">=", Timestamp.fromDate(startOfDay)),
      where("waktu_pesan", "<=", Timestamp.fromDate(endOfDay)),
      orderBy("waktu_pesan", "desc"),
    ];

    try {
      const snap = await getDocs(query(collection(db, "pesanan"), ...constraints));
      orders = snap.docs.map((d) => ({ docId: d.id, ...d.data() }));
    } catch (err) {
      console.error("Gagal query riwayat dari Firestore:", err);
      // Fallback ke allOrders jika query gagal
      orders = [...allOrders];
      const d = new Date(filterDate); d.setHours(0, 0, 0, 0);
      const e = new Date(filterDate); e.setHours(23, 59, 59, 999);
      orders = orders.filter((o) => {
        const t = o.waktu_pesan?.toDate ? o.waktu_pesan.toDate() : new Date(o.waktu_pesan || 0);
        return t >= d && t <= e;
      });
    }
  } else {
    // Tanpa filter tanggal → gunakan allOrders (cache real-time, max 150)
    orders = [...allOrders];
  }

  if (q)
    orders = orders.filter(
      (o) =>
        (o.nama_pemesan || "").toLowerCase().includes(q) ||
        (o.id_pesanan || "").toLowerCase().includes(q),
    );
  if (filterStatus) orders = orders.filter((o) => o.status === filterStatus);

  const tbody = document.getElementById("riwayatTable");
  if (orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state" style="padding:24px"><i class='bx bx-search-alt'></i><p>Tidak ada transaksi ditemukan</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = orders
    .map(
      (o) => `
    <tr>
      <td style="font-weight:700;font-size:12px;color:var(--accent)">${o.id_pesanan || "—"}</td>
      <td>
        <div style="font-weight:600">${o.nama_pemesan}</div>
        <div style="font-size:11px;color:var(--text-muted)">${o.no_wa || "—"}</div>
      </td>
      <td style="font-size:12px;white-space:nowrap">${formatDate(o.waktu_pesan)}</td>
      <td style="font-weight:700">${formatRp(o.total_harga || 0)}</td>
      <td>${statusBadge(o.status)}</td>
      <td><button class="btn btn-outline btn-sm" onclick="showOrderDetail('${o.docId}')"><i class='bx bx-info-circle'></i></button></td>
    </tr>
  `,
    )
    .join("");
}

export function bindRiwayatEvents() {
  // Search: tetap pakai 'input' karena hanya filter lokal
  document.getElementById("searchRiwayat").addEventListener("input", () => {
    if (document.getElementById("page-riwayat").classList.contains("active"))
      renderRiwayat();
  });
  // Tanggal & status: pakai 'change' karena memicu query Firestore
  ["filterTanggal", "filterStatus"].forEach((id) => {
    document.getElementById(id).addEventListener("change", () => {
      if (document.getElementById("page-riwayat").classList.contains("active"))
        renderRiwayat();
    });
  });
}

export async function printRiwayat() {
  // Ambil filter yang aktif saat ini
  const q = document.getElementById("searchRiwayat").value.toLowerCase();
  const filterDate = document.getElementById("filterTanggal").value;
  const filterStatus = document.getElementById("filterStatus").value;

  let orders;

  if (filterDate) {
    const startOfDay = new Date(filterDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(filterDate);
    endOfDay.setHours(23, 59, 59, 999);
    try {
      const constraints = [
        where("waktu_pesan", ">=", Timestamp.fromDate(startOfDay)),
        where("waktu_pesan", "<=", Timestamp.fromDate(endOfDay)),
        orderBy("waktu_pesan", "desc"),
      ];
      const snap = await getDocs(query(collection(db, "pesanan"), ...constraints));
      orders = snap.docs.map((d) => ({ docId: d.id, ...d.data() }));
    } catch {
      orders = [...allOrders];
      const d = new Date(filterDate); d.setHours(0, 0, 0, 0);
      const e = new Date(filterDate); e.setHours(23, 59, 59, 999);
      orders = orders.filter((o) => {
        const t = o.waktu_pesan?.toDate ? o.waktu_pesan.toDate() : new Date(o.waktu_pesan || 0);
        return t >= d && t <= e;
      });
    }
  } else {
    orders = [...allOrders];
  }

  if (q)
    orders = orders.filter(
      (o) =>
        (o.nama_pemesan || "").toLowerCase().includes(q) ||
        (o.id_pesanan || "").toLowerCase().includes(q),
    );
  if (filterStatus) orders = orders.filter((o) => o.status === filterStatus);

  // Hitung statistik
  const selesai = orders.filter((o) => o.status === "selesai");
  const totalRev = selesai.reduce((s, o) => s + (o.total_harga || 0), 0);
  const totalTunai = selesai
    .filter((o) => o.metode_bayar === "tunai" || o.metode_bayar === "cash")
    .reduce((s, o) => s + (o.total_harga || 0), 0);
  const tunaiCount = selesai.filter(
    (o) => o.metode_bayar === "tunai" || o.metode_bayar === "cash"
  ).length;
  const totalQris = selesai
    .filter((o) => o.metode_bayar === "qris")
    .reduce((s, o) => s + (o.total_harga || 0), 0);
  const qrisCount = selesai.filter((o) => o.metode_bayar === "qris").length;

  // Label filter
  let filterLabel = "Semua Data";
  if (filterDate) {
    const p = filterDate.split("-");
    const dd = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    filterLabel = dd.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }
  if (filterStatus) {
    const statusMap = {
      menunggu_verifikasi: "Menunggu Verifikasi",
      baru: "Baru",
      proses: "Diproses",
      selesai: "Selesai",
      batal: "Dibatalkan",
    };
    filterLabel += ` — Status: ${statusMap[filterStatus] || filterStatus}`;
  }
  if (q) filterLabel += ` — Pencarian: "${q}"`;

  // Buat baris tabel transaksi
  const statusLabel = (s) => {
    const map = {
      menunggu_verifikasi: "Menunggu",
      baru: "Baru",
      proses: "Diproses",
      selesai: "Selesai",
      batal: "Batal",
    };
    return map[s] || s;
  };

  const tableRows = orders
    .map(
      (o) => `
    <tr>
      <td style="font-weight:700;color:#6366f1">${o.id_pesanan || "—"}</td>
      <td>${o.nama_pemesan || "—"}</td>
      <td style="white-space:nowrap">${formatDate(o.waktu_pesan)}</td>
      <td style="text-align:right;font-weight:700">${formatRp(o.total_harga || 0)}</td>
      <td>${o.metode_bayar === "qris" ? "QRIS" : "Tunai"}</td>
      <td>${o.sumber === "offline" ? "Offline" : "Online"}</td>
      <td>${statusLabel(o.status)}</td>
    </tr>
  `
    )
    .join("");

  const win = window.open("", "_blank");
  win.document.write(`<!DOCTYPE html><html><head>
    <title>Riwayat Transaksi Tabato</title>
    <style>
      body { font-family: 'Inter', sans-serif; padding: 30px; color: #111; font-size: 13px; }
      h1 { font-size: 22px; margin-bottom: 4px; }
      .stat-row { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; }
      .stat-box { border: 1px solid #eee; border-radius: 10px; padding: 14px 18px; min-width: 140px; }
      .stat-label { font-size: 11px; color: #888; }
      .stat-value { font-size: 18px; font-weight: 800; }
      .report-summary-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; font-size: 14px; }
      .label { color: #666; }
      .val { font-weight: 700; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th { text-align: left; padding: 8px 6px; border-bottom: 2px solid #ddd; font-size: 11px; color: #888; text-transform: uppercase; }
      td { padding: 8px 6px; border-bottom: 1px solid #eee; }
      @media print { button { display: none; } }
    </style>
  </head><body>
    <h1>Riwayat Transaksi Tabato</h1>
    <p style="color:#888;margin-bottom:20px">Filter: ${filterLabel} &mdash; Dicetak: ${new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
    
    <div class="stat-row">
      <div class="stat-box"><div class="stat-label">Total Pendapatan</div><div class="stat-value">${formatRp(totalRev)}</div></div>
      <div class="stat-box"><div class="stat-label">Pendapatan Tunai</div><div class="stat-value" style="color:#10b981">${formatRp(totalTunai)}</div></div>
      <div class="stat-box"><div class="stat-label">Pendapatan QRIS</div><div class="stat-value" style="color:#6366f1">${formatRp(totalQris)}</div></div>
    </div>

    <div class="report-summary-row"><span class="label">Transaksi Selesai</span><span class="val">${selesai.length} transaksi</span></div>
    <div class="report-summary-row"><span class="label">Tunai</span><span class="val">${tunaiCount} trx — ${formatRp(totalTunai)}</span></div>
    <div class="report-summary-row"><span class="label">QRIS</span><span class="val">${qrisCount} trx — ${formatRp(totalQris)}</span></div>
    <div class="report-summary-row"><span class="label">Total Pesanan Ditampilkan</span><span class="val">${orders.length} pesanan</span></div>
    <div class="report-summary-row"><span class="label">Pesanan Dibatalkan</span><span class="val">${orders.filter((o) => o.status === "batal").length} pesanan</span></div>

    <hr style="margin:20px 0">
    <h3 style="font-size:15px;margin-bottom:8px">Daftar Transaksi</h3>
    <table>
      <thead><tr><th>Resi</th><th>Nama</th><th>Waktu</th><th style="text-align:right">Total</th><th>Metode</th><th>Sumber</th><th>Status</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table>

    <script>window.print(); window.close();<\/script>
  </body></html>`);
  win.document.close();
}
