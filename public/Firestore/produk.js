// ============================================================
// ADMIN: PRODUK
// Tabel & form CRUD untuk produk menu (sinkron ke Firestore lewat
// state.saveMenu, supaya halaman customer ikut terupdate).
// ============================================================

import {
  getMenu,
  getToppings,
  getStok,
  setStok,
  saveMenu,
  localStok,
} from "../admin/state.js";
import { formatRp, showToast, openModal, closeModal } from "./utils.js";
import { adminSettings } from "../admin/state.js";

export function renderProduk() {
  const q = document.getElementById("searchProduk").value.toLowerCase();
  let menu = getMenu().filter((m) => m.id !== "tb-mix" && m.type !== "mix");
  if (q) menu = menu.filter((m) => m.nama.toLowerCase().includes(q));

  document.getElementById("produkTable").innerHTML = menu
    .map((m) => {
      const s = getStok(m.id);
      const minS = adminSettings.minStok || 10;
      const stockClass =
        s <= 0 ? "stock-empty" : s <= minS ? "stock-low" : "stock-ok";
      const stockLabel = s <= 0 ? "Habis" : s <= minS ? `${s} (Kritis)` : s;
      return `<tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="product-icon-cell"><i class='bx ${m.icon}'></i></div>
          <div>
            <div style="font-weight:700">${m.nama}</div>
            <div style="font-size:11px;color:var(--text-muted)">${m.deskripsi?.slice(0, 45)}…</div>
          </div>
        </div>
      </td>
      <td><span class="badge ${m.type === "mix" ? "badge-new" : "badge-selesai"}">${m.type}</span></td>
      <td style="font-weight:700">${formatRp(m.harga)}</td>
      <td><span class="stock-pill ${stockClass}">${stockLabel}</span></td>
      <td>${m.badge ? `<span class="badge badge-proses">${m.badge}</span>` : "—"}</td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-outline btn-sm" onclick="openProductModal('${m.id}')"><i class='bx bx-edit'></i></button>
          <button class="btn btn-danger btn-sm" onclick="deleteProduk('${m.id}')"><i class='bx bx-trash'></i></button>
        </div>
      </td>
    </tr>`;
    })
    .join("");
}

export function openProductModal(menuId) {
  const toppings = getToppings();
  document.getElementById("pTopping").innerHTML = toppings
    .map((t) => `<option value="${t.id}">${t.nama}</option>`)
    .join("");

  if (menuId) {
    const m = getMenu().find((x) => x.id === menuId);
    if (!m) return;
    document.getElementById("modalProdukTitle").textContent = "Edit Produk";
    document.getElementById("pNama").value = m.nama;
    document.getElementById("pDeskripsi").value = m.deskripsi || "";
    document.getElementById("pHarga").value = m.harga;
    document.getElementById("pIsi").value = m.isi;
    document.getElementById("pType").value = m.type;
    document.getElementById("pTopping").value = m.toppingId || "";
    document.getElementById("pIcon").value = m.icon;
    document.getElementById("pBadge").value = m.badge || "";
    document.getElementById("pStok").value = getStok(m.id);
    document.getElementById("pEditId").value = m.id;
    document.getElementById("pToppingRow").style.display =
      m.type === "single" ? "block" : "none";
  } else {
    document.getElementById("modalProdukTitle").textContent = "Tambah Produk";
    document.getElementById("pNama").value = "";
    document.getElementById("pDeskripsi").value = "";
    document.getElementById("pHarga").value = "13000";
    document.getElementById("pIsi").value = "4";
    document.getElementById("pType").value = "single";
    document.getElementById("pIcon").value = "bx-box";
    document.getElementById("pBadge").value = "";
    document.getElementById("pStok").value = "50";
    document.getElementById("pEditId").value = "";
    document.getElementById("pToppingRow").style.display = "block";
  }
  openModal("modalProduk");
}

export function saveProduk() {
  const nama = document.getElementById("pNama").value.trim();
  const harga = parseInt(document.getElementById("pHarga").value) || 0;
  if (!nama || !harga) {
    showToast("Nama dan harga wajib diisi", "bx-error-circle");
    return;
  }

  const editId = document.getElementById("pEditId").value;
  const menu = getMenu();
  const type = document.getElementById("pType").value;
  const stokBaru = parseInt(document.getElementById("pStok").value) || 0;

  const produk = {
    id:
      editId ||
      "tb-" +
        nama
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, ""),
    nama,
    deskripsi: document.getElementById("pDeskripsi").value.trim(),
    harga,
    isi: document.getElementById("pIsi").value.trim() || "4",
    type,
    toppingId:
      type === "single" ? document.getElementById("pTopping").value : undefined,
    maksTopping: type === "mix" ? 4 : undefined,
    icon: document.getElementById("pIcon").value.trim() || "bx-box",
    badge: document.getElementById("pBadge").value.trim() || undefined,
  };

  if (editId) {
    const idx = menu.findIndex((m) => m.id === editId);
    if (idx > -1) menu[idx] = { ...menu[idx], ...produk };
    
    const oldStok = getStok(editId);
    if (stokBaru !== oldStok) {
      setStok(editId, stokBaru, "Update produk", "Admin");
    }
  } else {
    menu.push(produk);
    setStok(produk.id, stokBaru, "Stok awal produk baru", "Admin");
  }

  saveMenu(menu);
  closeModal("modalProduk");
  renderProduk();
  showToast("Produk berhasil disimpan", "bx-check-circle");
}

export function deleteProduk(menuId) {
  if (!confirm("Hapus produk ini?")) return;
  const menu = getMenu().filter((m) => m.id !== menuId);
  saveMenu(menu);
  renderProduk();
  showToast("Produk dihapus", "bx-trash");
}

export function bindProdukEvents() {
  document.getElementById("searchProduk").addEventListener("input", () => {
    if (document.getElementById("page-produk").classList.contains("active"))
      renderProduk();
  });

  document.getElementById("pType").addEventListener("change", () => {
    document.getElementById("pToppingRow").style.display =
      document.getElementById("pType").value === "single" ? "block" : "none";
  });
}
