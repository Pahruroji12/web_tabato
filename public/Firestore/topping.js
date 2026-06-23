// ============================================================
// ADMIN: TOPPING
// Tabel & form CRUD untuk daftar topping yang tersedia.
// ============================================================

import { getToppings, saveToppings } from "../admin/state.js";
import { showToast, openModal, closeModal } from "./utils.js";

export function renderTopping() {
  const toppings = getToppings();
  document.getElementById("toppingTable").innerHTML = toppings
    .map(
      (t) => `
    <tr>
      <td><div class="product-icon-cell" style="width:32px;height:32px;border-radius:7px;"><i class='bx ${t.icon}'></i></div></td>
      <td style="font-weight:700">${t.nama}</td>
      <td><code style="font-size:12px;background:var(--bg-main);padding:2px 7px;border-radius:5px;">${t.id}</code></td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-outline btn-sm" onclick="openToppingModal('${t.id}')"><i class='bx bx-edit'></i></button>
          <button class="btn btn-danger btn-sm" onclick="deleteTopping('${t.id}')"><i class='bx bx-trash'></i></button>
        </div>
      </td>
    </tr>
  `,
    )
    .join("");
}

export function openToppingModal(tId) {
  if (tId) {
    const t = getToppings().find((x) => x.id === tId);
    if (!t) return;
    document.getElementById("modalToppingTitle").textContent = "Edit Topping";
    document.getElementById("tNama").value = t.nama;
    document.getElementById("tId").value = t.id;
    document.getElementById("tId").readOnly = true;
    document.getElementById("tIcon").value = t.icon;
    document.getElementById("tEditId").value = t.id;
  } else {
    document.getElementById("modalToppingTitle").textContent = "Tambah Topping";
    document.getElementById("tNama").value = "";
    document.getElementById("tId").value = "";
    document.getElementById("tId").readOnly = false;
    document.getElementById("tIcon").value = "";
    document.getElementById("tEditId").value = "";
  }
  openModal("modalTopping");
}

export function saveTopping() {
  const nama = document.getElementById("tNama").value.trim();
  let id = document
    .getElementById("tId")
    .value.trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  if (!id && nama) {
    id = nama.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  }

  let icon = document.getElementById("tIcon").value.trim();
  if (!icon) {
    icon = "bx-star";
  }

  if (!nama || !id) {
    showToast("Nama dan ID topping wajib diisi", "bx-error-circle");
    return;
  }

  const editId = document.getElementById("tEditId").value;
  const toppings = getToppings();

  if (editId) {
    const idx = toppings.findIndex((t) => t.id === editId);
    if (idx > -1) toppings[idx] = { id, nama, icon };
  } else {
    if (toppings.find((t) => t.id === id)) {
      showToast("ID topping sudah ada", "bx-error-circle");
      return;
    }
    toppings.push({ id, nama, icon });
  }

  saveToppings(toppings);
  closeModal("modalTopping");
  renderTopping();
  showToast("Topping berhasil disimpan", "bx-check-circle");
}

export function deleteTopping(tId) {
  if (!confirm("Hapus topping ini?")) return;
  saveToppings(getToppings().filter((t) => t.id !== tId));
  renderTopping();
  showToast("Topping dihapus", "bx-trash");
}

export function bindToppingEvents() {
  const tNama = document.getElementById("tNama");
  if (tNama) {
    tNama.addEventListener("input", (e) => {
      const editId = document.getElementById("tEditId").value;
      if (!editId) {
        const slug = e.target.value
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "");
        document.getElementById("tId").value = slug;
      }
    });
  }
}

