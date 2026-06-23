// ============================================================
// ADMIN: KASIR (POS)
// Tampilan kanban pesanan masuk (online & offline), dengan filter
// status, aksi proses/selesai/batal per pesanan, dan panel untuk
// input pesanan langsung (walk-in) dengan pembayaran tunai/QRIS
// + kalkulator kembalian.
// ============================================================

import {
  allOrders,
  currentOrderFilter,
  setCurrentOrderFilter,
  getMenu,
  getToppings,
  getStok,
  setStok,
  getStokBoxes,
  deductStockForOrder,
} from "../admin/state.js";
import { formatRp, formatDate, statusBadge, showToast, escapeHTML } from "./utils.js";
import {
  updateOrderStatus,
  createOfflineOrder,
  showOrderDetail,
} from "./orders.js";

// ---------- STATE PANEL OFFLINE ----------
let offlineCartItems = []; // { menuId, nama, harga, qty }
let offlinePaymentMethod = "tunai";
let selectedOfflineToppings = []; // topping terpilih untuk tb-mix offline

// ============================================================
// RENDER KANBAN PESANAN
// ============================================================
export function renderKasir() {
  const filter = currentOrderFilter;
  let orders = allOrders;
  if (filter !== "semua") orders = orders.filter((o) => o.status === filter);

  const grid = document.getElementById("orderGrid");
  if (orders.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><i class='bx bx-receipt'></i><p>Tidak ada pesanan ${filter !== "semua" ? "dengan status ini" : ""}</p></div>`;
    return;
  }

  grid.innerHTML = orders
    .map((o) => {
      const items = (o.detail_item || [])
        .map(
          (it) =>
            `<div class="order-item-row"><span class="order-item-name">${escapeHTML(it.nama_item)} <small style="color:var(--text-muted)">(${escapeHTML(it.varian_toping)})</small></span><span>×${it.jumlah}</span></div>`,
        )
        .join("");

      const sumberBadge =
        o.sumber === "offline"
          ? `<span class="badge badge-offline"><i class='bx bx-store-alt'></i> Offline</span>`
          : `<span class="badge badge-online"><i class='bx bx-globe'></i> Online</span>`;
      const metodeBadge =
        o.metode_bayar === "qris"
          ? `<span class="badge badge-qris"><i class='bx bx-qr-scan'></i> QRIS</span>`
          : `<span class="badge badge-tunai"><i class='bx bx-money'></i> Tunai</span>`;

      const actions =
        o.status === "menunggu_verifikasi"
          ? `
      <button class="btn btn-sm btn-success" data-action="verifikasi" data-docid="${o.docId}"><i class='bx bx-shield-quarter'></i> Verifikasi &amp; Proses</button>
      <button class="btn btn-sm btn-danger" data-action="batal" data-docid="${o.docId}"><i class='bx bx-x'></i> Batal</button>
    `
          : o.status === "baru"
            ? `
      <button class="btn btn-sm btn-outline" data-action="proses" data-docid="${o.docId}"><i class='bx bx-play'></i> Proses</button>
      <button class="btn btn-sm btn-danger" data-action="batal" data-docid="${o.docId}"><i class='bx bx-x'></i> Batal</button>
    `
            : o.status === "proses"
              ? `
      <button class="btn btn-sm btn-success" data-action="selesai" data-docid="${o.docId}"><i class='bx bx-check'></i> Selesai</button>
      <button class="btn btn-sm btn-danger" data-action="batal" data-docid="${o.docId}"><i class='bx bx-x'></i> Batal</button>
    `
              : "";

      return `<div class="order-card">
      <div class="order-card-header">
        <div>
          <div class="order-id">${escapeHTML(o.id_pesanan || "—")}</div>
          <div class="order-name">${escapeHTML(o.nama_pemesan || "—")}</div>
          <div class="order-time">${formatDate(o.waktu_pesan)}</div>
        </div>
        ${statusBadge(o.status)}
      </div>
      <div class="order-badges">${sumberBadge}${metodeBadge}</div>
      <div class="order-items">${items}</div>
      <div class="order-lokasi"><i class='bx bx-map-pin'></i>${escapeHTML(o.lokasi_antar || "—")}</div>
      <div class="order-footer">
        <span class="order-total">${formatRp(o.total_harga || 0)}</span>
      </div>
      <div class="order-actions">
        ${actions}
        <button class="btn btn-sm btn-outline" data-action="detail" data-docid="${o.docId}"><i class='bx bx-info-circle'></i></button>
      </div>
    </div>`;
    })
    .join("");
}

// ============================================================
// EVENT BINDING (kanban + panel offline)
// ============================================================
export function bindKasirEvents() {
  // ---- Event Delegation: Klik tombol produk offline ----
  document.getElementById("offlineProductList").addEventListener("click", (e) => {
    const btn = e.target.closest(".offline-product-btn:not([disabled])");
    if (!btn) return;
    const menuId = btn.dataset.menuId;
    if (menuId === "tb-mix") {
      openOfflineToppingSelector(btn);
    } else {
      addToOfflineCart(menuId);
    }
  });

  // ---- Event Delegation: Klik tombol topping offline ----
  document.getElementById("offlineToppingList").addEventListener("click", (e) => {
    const minusBtn = e.target.closest(".off-qty-minus");
    const plusBtn = e.target.closest(".off-qty-plus");
    if (!minusBtn && !plusBtn) return;
    
    e.stopPropagation();
    
    if (minusBtn) {
      const id = minusBtn.dataset.id;
      const idx = selectedOfflineToppings.indexOf(id);
      if (idx > -1) {
        selectedOfflineToppings.splice(idx, 1);
        updateOfflineToppingDisplay(id);
      }
    } else if (plusBtn) {
      const id = plusBtn.dataset.id;
      const currentCount = selectedOfflineToppings.filter((x) => x === id).length;
      const available = getStok("tb-" + id);
      
      if (selectedOfflineToppings.length >= 4) {
        showToast("Maksimal 4 topping per box", "bx-error-circle");
        return;
      }
      
      if (currentCount + 1 > available) {
        showToast("Stok tidak mencukupi", "bx-error-circle");
        return;
      }
      
      selectedOfflineToppings.push(id);
      updateOfflineToppingDisplay(id);
    }
  });

  // ---- Filter tab status ----
  document.getElementById("statusTabs").addEventListener("click", (e) => {
    const btn = e.target.closest(".tab-btn");
    if (!btn) return;
    document
      .querySelectorAll("#statusTabs .tab-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    setCurrentOrderFilter(btn.dataset.filter);
    renderKasir();
  });

  // ---- Aksi tombol pada kartu pesanan (event delegation, BUKAN onclick inline) ----
  // Data item pesanan tidak pernah disisipkan ke atribut HTML — diambil langsung
  // dari allOrders berdasarkan docId, supaya aman dari karakter kutip/JSON yang
  // bisa merusak markup (ini akar masalah tombol "Proses" yang sebelumnya gagal).
  document.getElementById("orderGrid").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const docId = btn.dataset.docid;
    const action = btn.dataset.action;

    if (action === "detail") {
      showOrderDetail(docId);
      return;
    }
    if (action === "batal") {
      updateOrderStatus(docId, "batal");
      return;
    }
    if (action === "proses") {
      const order = allOrders.find((o) => o.docId === docId);
      updateOrderStatus(docId, "proses", order ? order.detail_item : null);
      return;
    }
    if (action === "verifikasi") {
      // Admin mengonfirmasi pembayaran QRIS sudah masuk -> pesanan langsung
      // dipindah ke status "proses" (gabung jadi 1 aksi, stok ikut berkurang).
      const order = allOrders.find((o) => o.docId === docId);
      updateOrderStatus(docId, "proses", order ? order.detail_item : null);
      showToast(
        "Pembayaran dikonfirmasi, pesanan diproses",
        "bx-shield-quarter",
      );
      return;
    }
    if (action === "selesai") {
      updateOrderStatus(docId, "selesai");
      return;
    }
  });

  // ---- Panel pesanan offline ----
  document
    .getElementById("newOfflineOrderBtn")
    .addEventListener("click", openOfflinePanel);
  document
    .getElementById("closeOfflinePanelBtn")
    .addEventListener("click", closeOfflinePanel);

  document
    .getElementById("offlinePaymentMethod")
    .addEventListener("click", (e) => {
      const btn = e.target.closest(".payment-method-btn");
      if (!btn) return;
      document
        .querySelectorAll(".payment-method-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      offlinePaymentMethod = btn.dataset.method;
      document.getElementById("offlineCashCalc").style.display =
        offlinePaymentMethod === "tunai" ? "block" : "none";
      updateKembalianDisplay();
    });

  document
    .getElementById("offlineUangDiterima")
    .addEventListener("input", updateKembalianDisplay);

  document
    .getElementById("submitOfflineOrderBtn")
    .addEventListener("click", submitOfflineOrder);

  document
    .getElementById("confirmOfflineToppingBtn")
    .addEventListener("click", () => {
      if (selectedOfflineToppings.length === 0) {
        showToast("Pilih minimal 1 topping", "bx-error-circle");
        return;
      }
      addMixToOfflineCart();
      restoreOfflineToppingSelection();
    });
}

// ============================================================
// PANEL OFFLINE: buka/tutup
// ============================================================
function restoreOfflineToppingSelection() {
  const selection = document.getElementById("offlineToppingSelection");
  if (!selection) return;
  selection.style.display = "none";
  const parent = document.getElementById("offlineProductList").parentNode;
  if (parent) {
    parent.appendChild(selection);
  }
}

function openOfflinePanel() {
  restoreOfflineToppingSelection();
  offlineCartItems = [];
  offlinePaymentMethod = "tunai";
  selectedOfflineToppings = [];
  document.getElementById("offlineNama").value = "";
  document.getElementById("offlineUangDiterima").value = "";
  document
    .querySelectorAll(".payment-method-btn")
    .forEach((b) => b.classList.toggle("active", b.dataset.method === "tunai"));
  document.getElementById("offlineCashCalc").style.display = "block";

  renderOfflineProductList();
  renderOfflineCart();
  updateKembalianDisplay();

  document.getElementById("offlinePanel").style.display = "flex";
}

function closeOfflinePanel() {
  restoreOfflineToppingSelection();
  document.getElementById("offlinePanel").style.display = "none";
}

// ============================================================
// PANEL OFFLINE: daftar produk yang bisa dipilih kasir
// ============================================================
function renderOfflineProductList() {
  const menu = getMenu();
  const list = document.getElementById("offlineProductList");
  list.innerHTML = menu
    .map((m) => {
      const stokBoxes = getStokBoxes(m.id);
      const disabled = stokBoxes <= 0;
      return `<button class="offline-product-btn" data-menu-id="${m.id}" ${disabled ? "disabled" : ""}>
        <i class='bx ${m.icon}'></i>
        <span class="op-name">${m.nama}</span>
        <span class="op-price">${formatRp(m.harga)}</span>
        ${disabled ? '<span class="op-empty">Habis</span>' : ""}
      </button>`;
    })
    .join("");
}

function openOfflineToppingSelector(btn) {
  selectedOfflineToppings = [];
  document.getElementById("offlineToppingCounter").textContent = "0/4";

  const toppings = getToppings();
  const listEl = document.getElementById("offlineToppingList");
  listEl.innerHTML = toppings
    .map(
      (t) => {
        const stok = getStok("tb-" + t.id);
        const outOfStock = stok <= 0;
        const count = selectedOfflineToppings.filter((id) => id === t.id).length;
        return `
      <div class="topping-checkbox ${outOfStock ? "out-of-stock disabled" : ""}" data-id="${t.id}" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border: 1px solid var(--card-border); border-radius: 8px; margin-bottom: 6px; cursor: default; background: var(--card-bg);">
        <span style="font-size: 13px; font-weight: 600;"><i class="bx ${t.icon}" style="color: var(--accent); margin-right: 6px;"></i> ${t.nama} ${outOfStock ? "(Habis)" : `<span style="font-size: 10px; color: var(--text-muted); font-weight: normal; margin-left: 6px;">Stok: ${stok}</span>`}</span>
        <div class="qty-control topping-qty-control" style="${outOfStock ? "display: none;" : "display: flex;"}">
          <button type="button" class="off-qty-minus" data-id="${t.id}"><i class="bx bx-minus"></i></button>
          <span class="off-qty-val" data-id="${t.id}" style="font-weight: 700; font-size: 13px; min-width: 14px; text-align: center;">${count}</span>
          <button type="button" class="off-qty-plus" data-id="${t.id}"><i class="bx bx-plus"></i></button>
        </div>
      </div>
    `;
      }
    )
    .join("");

  const selection = document.getElementById("offlineToppingSelection");
  if (btn) {
    btn.parentNode.insertBefore(selection, btn.nextSibling);
  }
  selection.style.display = "block";
  updateOfflineToppingState();
}

function updateOfflineToppingDisplay(id) {
  const count = selectedOfflineToppings.filter((x) => x === id).length;
  const valEl = document.querySelector(`.off-qty-val[data-id="${id}"]`);
  if (valEl) {
    valEl.textContent = count;
  }
  updateOfflineToppingState();
}

function updateOfflineToppingState() {
  const isFull = selectedOfflineToppings.length >= 4;
  const listEl = document.getElementById("offlineToppingList");
  
  listEl.querySelectorAll(".topping-checkbox").forEach((box) => {
    const id = box.dataset.id;
    const count = selectedOfflineToppings.filter((x) => x === id).length;
    const isSelected = count > 0;
    const outOfStock = getStok("tb-" + id) <= 0;
    box.classList.toggle("selected", isSelected);
    
    const plusBtn = box.querySelector(".off-qty-plus");
    if (plusBtn) {
      plusBtn.disabled = isFull || outOfStock;
    }
    const minusBtn = box.querySelector(".off-qty-minus");
    if (minusBtn) {
      minusBtn.disabled = count <= 0;
    }
  });
  
  document.getElementById("offlineToppingCounter").textContent = `${selectedOfflineToppings.length}/4`;
  
  const confirmBtn = document.getElementById("confirmOfflineToppingBtn");
  if (confirmBtn) {
    confirmBtn.disabled = selectedOfflineToppings.length !== 4;
  }
}

function calculateOfflineCartToppingPieces(cartItems) {
  const piecesNeeded = {};
  cartItems.forEach((item) => {
    if (item.menuId === "tb-mix") {
      const N = item.toppingIds.length;
      for (let i = 0; i < 4; i++) {
        const tid = item.toppingIds[i % N];
        piecesNeeded[tid] = (piecesNeeded[tid] || 0) + (1 * item.qty);
      }
    } else if (item.menuId !== "coffee-aren") {
      const toppingId = item.menuId.replace("tb-", "");
      piecesNeeded[toppingId] = (piecesNeeded[toppingId] || 0) + (4 * item.qty);
    }
  });
  return piecesNeeded;
}

function validateOfflineCartStock(potentialCart) {
  const piecesNeeded = calculateOfflineCartToppingPieces(potentialCart);
  for (const [toppingId, needed] of Object.entries(piecesNeeded)) {
    const available = getStok("tb-" + toppingId);
    if (needed > available) {
      const t = getToppings().find((x) => x.id === toppingId);
      return {
        valid: false,
        toppingName: t ? t.nama : toppingId,
      };
    }
  }

  // Validasi stok kopi
  const coffeeQty = potentialCart
    .filter((item) => item.menuId === "coffee-aren")
    .reduce((sum, item) => sum + item.qty, 0);
  if (coffeeQty > 0) {
    const available = getStok("coffee-aren");
    if (coffeeQty > available) {
      return {
        valid: false,
        toppingName: "Coffee Aren",
      };
    }
  }
  return { valid: true };
}

function addMixToOfflineCart() {
  const menu = getMenu();
  const m = menu.find((x) => x.id === "tb-mix");
  if (!m) return;

  const key = "tb-mix|" + [...selectedOfflineToppings].sort().join(",");
  const potentialCart = JSON.parse(JSON.stringify(offlineCartItems));
  const existing = potentialCart.find((c) => c.key === key);

  if (existing) {
    existing.qty += 1;
  } else {
    const counts = {};
    selectedOfflineToppings.forEach((id) => {
      counts[id] = (counts[id] || 0) + 1;
    });
    const toppingLabel = Object.entries(counts)
      .map(([id, count]) => {
        const t = getToppings().find((x) => x.id === id);
        const name = t ? t.nama : id;
        return `${name} x${count}`;
      })
      .join(", ");
    potentialCart.push({
      key,
      menuId: "tb-mix",
      nama: "Mix Topping",
      harga: m.harga,
      qty: 1,
      toppingLabel: toppingLabel,
      toppingIds: [...selectedOfflineToppings],
    });
  }

  const check = validateOfflineCartStock(potentialCart);
  if (!check.valid) {
    showToast(`Stok ${check.toppingName} tidak mencukupi`, "bx-error-circle");
    return;
  }

  offlineCartItems = potentialCart;
  renderOfflineCart();
  updateKembalianDisplay();
}

function addToOfflineCart(menuId) {
  const menu = getMenu();
  const m = menu.find((x) => x.id === menuId);
  if (!m) return;
  if (menuId === "tb-mix") return;

  const potentialCart = JSON.parse(JSON.stringify(offlineCartItems));
  const existing = potentialCart.find((c) => c.menuId === menuId);

  if (existing) {
    existing.qty += 1;
  } else {
    const toppings = getToppings();
    const singleTopping = toppings.find((t) => t.id === m.toppingId);
    const toppingLabel = singleTopping ? singleTopping.nama : "-";
    potentialCart.push({
      menuId: m.id,
      nama: m.nama,
      harga: m.harga,
      qty: 1,
      toppingLabel: toppingLabel,
      toppingIds: m.toppingId ? [m.toppingId] : [],
    });
  }

  const check = validateOfflineCartStock(potentialCart);
  if (!check.valid) {
    showToast(`Stok ${check.toppingName} tidak mencukupi`, "bx-error-circle");
    return;
  }

  offlineCartItems = potentialCart;
  renderOfflineCart();
  updateKembalianDisplay();
}

function updateOfflineCartQty(itemKey, delta) {
  const potentialCart = JSON.parse(JSON.stringify(offlineCartItems));
  const item = potentialCart.find((c) => (c.key || c.menuId) === itemKey);
  if (!item) return;

  if (delta < 0) {
    item.qty += delta;
    if (item.qty <= 0) {
      offlineCartItems = offlineCartItems.filter((c) => (c.key || c.menuId) !== itemKey);
    } else {
      offlineCartItems = potentialCart;
    }
    renderOfflineCart();
    updateKembalianDisplay();
    return;
  }

  item.qty += delta;
  const check = validateOfflineCartStock(potentialCart);
  if (!check.valid) {
    showToast(`Stok ${check.toppingName} tidak mencukupi`, "bx-error-circle");
    return;
  }

  offlineCartItems = potentialCart;
  renderOfflineCart();
  updateKembalianDisplay();
}

function offlineCartTotal() {
  return offlineCartItems.reduce((s, c) => s + c.harga * c.qty, 0);
}

function renderOfflineCart() {
  const container = document.getElementById("offlineCart");
  const checkoutSection = document.getElementById("offlineCheckoutSection");
  if (offlineCartItems.length === 0) {
    if (checkoutSection) checkoutSection.style.display = "none";
    container.innerHTML = `<div class="empty-state" style="padding:16px"><i class='bx bx-cart'></i><p>Belum ada item dipilih</p></div>`;
  } else {
    if (checkoutSection) checkoutSection.style.display = "block";
    container.innerHTML = offlineCartItems
      .map(
        (c) => `
      <div class="offline-cart-row" style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--card-border);" data-item-key="${c.key || c.menuId}">
        <div style="flex:1; min-width:0; padding-right:10px;">
          <div class="oc-name" style="font-size:13px; font-weight:700;">${escapeHTML(c.nama)}</div>
          ${c.toppingLabel && c.toppingLabel !== "-" ? `<div style="font-size:11px; color:var(--text-muted); margin-top:2px;">${escapeHTML(c.toppingLabel)}</div>` : ""}
        </div>
        <div class="mini-qty" style="margin-right:10px;">
          <button data-delta="-1"><i class='bx bx-minus'></i></button>
          <span>${c.qty}</span>
          <button data-delta="1"><i class='bx bx-plus'></i></button>
        </div>
        <span class="oc-subtotal" style="font-weight:700; color:var(--accent); min-width:75px; text-align:right;">${formatRp(c.harga * c.qty)}</span>
      </div>
    `
      )
      .join("");

    container.querySelectorAll(".offline-cart-row").forEach((row) => {
      const itemKey = row.dataset.itemKey;
      row.querySelectorAll(".mini-qty button").forEach((btn) => {
        btn.addEventListener("click", () =>
          updateOfflineCartQty(itemKey, parseInt(btn.dataset.delta))
        );
      });
    });
  }

  document.getElementById("offlineTotalPrice").textContent =
    formatRp(offlineCartTotal());
}

// ============================================================
// KALKULATOR KEMBALIAN
// ============================================================
function updateKembalianDisplay() {
  const total = offlineCartTotal();
  const diterima =
    parseInt(document.getElementById("offlineUangDiterima").value) || 0;
  const kembalian = diterima - total;

  const display = document.getElementById("offlineKembalianDisplay");
  const valueEl = document.getElementById("offlineKembalianValue");

  // Render tombol nominal cepat (uang pas & beberapa pecahan umum di atas total)
  renderCashQuickAmounts(total);

  if (offlinePaymentMethod !== "tunai") {
    display.style.display = "none";
    return;
  }
  display.style.display = "flex";

  if (diterima === 0) {
    valueEl.textContent = formatRp(0);
    valueEl.classList.remove("negative");
  } else if (kembalian < 0) {
    valueEl.textContent = `Kurang ${formatRp(Math.abs(kembalian))}`;
    valueEl.classList.add("negative");
  } else {
    valueEl.textContent = formatRp(kembalian);
    valueEl.classList.remove("negative");
  }
}

function renderCashQuickAmounts(total) {
  const wrap = document.getElementById("cashQuickAmounts");
  if (total <= 0) {
    wrap.innerHTML = "";
    return;
  }
  // Bulatkan ke atas ke kelipatan pecahan uang tunai yang umum
  const roundUp = (n, step) => Math.ceil(n / step) * step;
  const options = Array.from(
    new Set([
      total,
      roundUp(total, 5000),
      roundUp(total, 10000),
      roundUp(total, 50000),
      roundUp(total, 100000),
    ]),
  ).slice(0, 4);

  wrap.innerHTML = options
    .map(
      (amt) =>
        `<button type="button" class="cash-quick-btn" data-amount="${amt}">${formatRp(amt)}</button>`,
    )
    .join("");

  wrap.querySelectorAll(".cash-quick-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById("offlineUangDiterima").value = btn.dataset.amount;
      updateKembalianDisplay();
    });
  });
}

// ============================================================
// SUBMIT PESANAN OFFLINE
// ============================================================
async function submitOfflineOrder() {
  if (offlineCartItems.length === 0) {
    showToast("Pilih minimal 1 produk dulu", "bx-error-circle");
    return;
  }

  const total = offlineCartTotal();
  const diterima =
    parseInt(document.getElementById("offlineUangDiterima").value) || 0;

  if (offlinePaymentMethod === "tunai" && diterima < total) {
    showToast("Uang diterima belum cukup", "bx-error-circle");
    return;
  }

  const submitBtn = document.getElementById("submitOfflineOrderBtn");
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="spinner"></span><span>Menyimpan...</span>`;

  const detailItem = offlineCartItems.map((c) => ({
    nama_item: c.nama,
    varian_toping: c.toppingLabel || "-",
    topping_ids: c.toppingIds || [],
    jumlah: c.qty,
    subtotal: c.harga * c.qty,
  }));

  const namaPembeli =
    document.getElementById("offlineNama").value.trim() || "Pembeli Walk-in";
  const kembalian = offlinePaymentMethod === "tunai" ? diterima - total : 0;

  try {
    const resi = await createOfflineOrder({
      nama_pemesan: namaPembeli,
      detail_item: detailItem,
      total_harga: total,
      metode_bayar: offlinePaymentMethod,
      uang_diterima: offlinePaymentMethod === "tunai" ? diterima : total,
      kembalian: offlinePaymentMethod === "tunai" ? kembalian : 0,
    });

    // Kurangi stok langsung karena pesanan offline dianggap selesai saat itu juga
    await deductStockForOrder(detailItem, resi, "Admin");

    showToast("Pesanan offline berhasil disimpan", "bx-check-circle");
    closeOfflinePanel();
  } catch (e) {
    showToast("Gagal menyimpan pesanan offline", "bx-error-circle");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<i class='bx bx-check'></i> Selesaikan Pesanan`;
  }
}
