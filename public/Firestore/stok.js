// ============================================================
// ADMIN: STOK
// Tabel stok per produk + riwayat perubahan stok, dan modal untuk
// menambah/mengurangi/menetapkan stok.
// ============================================================

import {
  getMenu,
  getStok,
  setStok,
  stokHistory,
  adminSettings,
} from "../admin/state.js";
import { showToast, openModal, closeModal } from "./utils.js";

export function renderStok() {
  const menu = getMenu().filter((m) => m.id !== "tb-mix" && m.type !== "mix");
  const minS = adminSettings.minStok || 10;

  let total = 0,
    kritis = 0;
  menu.forEach((m) => {
    const s = getStok(m.id);
    total += s;
    if (s <= minS) kritis++;
  });
  document.getElementById("totalStok").textContent = total;
  document.getElementById("stokKritis").textContent = kritis;

  const maxStok = Math.max(...menu.map((m) => getStok(m.id)), 1);
  document.getElementById("stokTable").innerHTML = menu
    .map((m) => {
      const s = getStok(m.id);
      const pct = Math.round((s / Math.max(maxStok, 1)) * 100);
      const cls = s <= 0 ? "stock-empty" : s <= minS ? "stock-low" : "stock-ok";
      const fillColor =
        s <= 0
          ? "var(--danger)"
          : s <= minS
            ? "var(--warning)"
            : "var(--success)";
      return `<tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="product-icon-cell" style="width:32px;height:32px;border-radius:7px;"><i class='bx ${m.icon}'></i></div>
          <span style="font-weight:600">${m.nama}</span>
        </div>
      </td>
      <td>
        <div style="font-weight:700">${s} unit</div>
        <div class="stock-bar"><div class="stock-fill" style="width:${pct}%;background:${fillColor}"></div></div>
      </td>
      <td>${minS} unit</td>
      <td><span class="stock-pill ${cls}">${s <= 0 ? "Habis" : s <= minS ? "Kritis" : "Aman"}</span></td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="openStokModal('${m.id}')"><i class='bx bx-edit'></i> Update</button>
      </td>
    </tr>`;
    })
    .join("");

  document.getElementById("stokHistoryTable").innerHTML =
    stokHistory
      .slice(0, 30)
      .map(
        (h) => `
    <tr>
      <td style="font-size:12px;color:var(--text-muted)">${new Date(h.waktu).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })} ${new Date(h.waktu).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</td>
      <td style="font-weight:600">${h.namaProduk}</td>
      <td style="font-weight:700;color:${h.delta >= 0 ? "var(--success)" : "var(--danger)"}">${h.delta >= 0 ? "+" : ""}${h.delta} → ${h.stokBaru}</td>
      <td style="font-size:12px">${h.alasan}</td>
      <td style="font-size:12px">${h.petugas}</td>
    </tr>
  `,
      )
      .join("") ||
    `<tr><td colspan="5" class="empty-state" style="padding:20px;text-align:center;">Belum ada riwayat</td></tr>`;
}

export function openStokModal(menuId) {
  const menu = getMenu();
  document.getElementById("stokProduk").innerHTML = menu
    .map(
      (m) =>
        `<option value="${m.id}" ${m.id === menuId ? "selected" : ""}>${m.nama} (${getStok(m.id)} unit)</option>`,
    )
    .join("");
  document.getElementById("stokJumlah").value = "";
  document.getElementById("stokAlasan").value = "";
  openModal("modalStok");
}

export async function saveStok() {
  const menuId = document.getElementById("stokProduk").value;
  const jenis = document.getElementById("stokJenis").value;
  const jumlah = parseInt(document.getElementById("stokJumlah").value) || 0;
  const alasan =
    document.getElementById("stokAlasan").value.trim() || "Update manual";

  let newVal;
  const cur = getStok(menuId);
  if (jenis === "tambah") newVal = cur + jumlah;
  else if (jenis === "kurang") newVal = Math.max(0, cur - jumlah);
  else newVal = jumlah;

  await setStok(menuId, newVal, alasan, "Admin");
  closeModal("modalStok");
  renderStok();
  showToast("Stok berhasil diperbarui", "bx-check-circle");
}
