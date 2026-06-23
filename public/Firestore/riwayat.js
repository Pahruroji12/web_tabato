// ============================================================
// ADMIN: RIWAYAT
// Tabel riwayat transaksi dengan pencarian, filter tanggal, dan
// filter status.
// ============================================================

import { allOrders } from "../admin/state.js";
import { formatRp, formatDate, statusBadge } from "./utils.js";

export function renderRiwayat() {
  const q = document.getElementById("searchRiwayat").value.toLowerCase();
  const filterDate = document.getElementById("filterTanggal").value;
  const filterStatus = document.getElementById("filterStatus").value;

  let orders = [...allOrders];
  if (q)
    orders = orders.filter(
      (o) =>
        (o.nama_pemesan || "").toLowerCase().includes(q) ||
        (o.id_pesanan || "").toLowerCase().includes(q),
    );
  if (filterDate) {
    const d = new Date(filterDate);
    d.setHours(0, 0, 0, 0);
    const e = new Date(filterDate);
    e.setHours(23, 59, 59, 999);
    orders = orders.filter((o) => {
      const t = o.waktu_pesan?.toDate
        ? o.waktu_pesan.toDate()
        : new Date(o.waktu_pesan || 0);
      return t >= d && t <= e;
    });
  }
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
  ["searchRiwayat", "filterTanggal", "filterStatus"].forEach((id) => {
    document.getElementById(id).addEventListener("input", () => {
      if (document.getElementById("page-riwayat").classList.contains("active"))
        renderRiwayat();
    });
  });
}
