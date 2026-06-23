// ============================================================
// TABATO - APP.JS (Vanilla JS, tanpa framework, untuk loading cepat)
// ============================================================

import {
  db,
  collection,
  setDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  onSnapshot,
} from "./firebase-config.js";
import { MENU_DATA, DAFTAR_TOPPING } from "./menu-data.js";

// ---------- STATE ----------
let cart = []; // { menuId, nama, icon, hargaSatuan, toppingLabel, qty }
let activeMenu = null;
let selectedToppingIds = []; // untuk mode "mix"

// Menu & topping aktif — bisa dioverride dari Firestore
let activeMenuData = MENU_DATA;
let activeToppingData = DAFTAR_TOPPING;
let activeStokData = {}; // menyimpan stok aktif per menuId

// ---------- STOCK UTILS (PIECE-BASED) ----------
function getStockInBoxes(menuId) {
  const target = activeMenuData.find((x) => x.id === menuId);
  if (menuId === "tb-mix") {
    const totalPieces = activeMenuData
      .filter((m) => m.id !== "tb-mix" && m.type !== "mix" && m.type !== "drink")
      .reduce((sum, m) => sum + (activeStokData[m.id] ?? 0), 0);
    return Math.floor(totalPieces / 4);
  }
  if (target && target.type === "drink") {
    return activeStokData[menuId] ?? 0;
  }
  const pieces = activeStokData[menuId] ?? 0;
  return Math.floor(pieces / 4);
}

function calculateCartToppingPieces(cartItems) {
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

function validateCartStock(potentialCart) {
  const piecesNeeded = calculateCartToppingPieces(potentialCart);
  for (const [toppingId, needed] of Object.entries(piecesNeeded)) {
    const available = activeStokData["tb-" + toppingId] ?? 0;
    if (needed > available) {
      return {
        valid: false,
        toppingName: getToppingById(toppingId)?.nama || toppingId,
      };
    }
  }

  // Validasi stok Kopi Aren
  const coffeeQty = potentialCart
    .filter((item) => item.menuId === "coffee-aren")
    .reduce((sum, item) => sum + item.qty, 0);
  if (coffeeQty > 0) {
    const available = activeStokData["coffee-aren"] ?? 0;
    if (coffeeQty > available) {
      return {
        valid: false,
        toppingName: "Coffee Aren",
      };
    }
  }
  return { valid: true };
}

// ---------- UTIL ----------
function formatRupiah(num) {
  return "Rp " + num.toLocaleString("id-ID");
}

function escapeHTML(str) {
  if (typeof str !== "string") return str;
  return str.replace(/[&<>"']/g, (m) => {
    switch (m) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#039;';
      default: return m;
    }
  });
}

function getToppingById(id) {
  return activeToppingData.find((t) => t.id === id);
}

function showToast(message, icon = "bx-info-circle") {
  const toast = document.getElementById("toast");
  toast.innerHTML = `<i class='bx ${icon}'></i><span>${message}</span>`;
  toast.classList.add("visible");
  setTimeout(() => toast.classList.remove("visible"), 2400);
}

function generateResi() {
  const date = new Date();
  const ymd = date.toISOString().slice(2, 10).replace(/-/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `TBT-${ymd}-${rand}`;
}

// ---------- DARK MODE ----------
function initTheme() {
  const saved = localStorage.getItem("tabato-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = saved ? saved === "dark" : prefersDark;
  document.documentElement.classList.toggle("dark", isDark);
  updateThemeIcon(isDark);
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle("dark");
  localStorage.setItem("tabato-theme", isDark ? "dark" : "light");
  updateThemeIcon(isDark);
}

function updateThemeIcon(isDark) {
  const btn = document.getElementById("themeToggle");
  btn.innerHTML = isDark
    ? `<i class='bx bx-sun'></i>`
    : `<i class='bx bx-moon'></i>`;
}

// ---------- RENDER MENU ----------
function renderMenuItemCard(item) {
  const stokBoxes = getStockInBoxes(item.id);
  const isHabis = stokBoxes <= 0;
  const btnLabel = isHabis ? "Habis" : "Pilih";
  const btnDisabled = isHabis ? "disabled" : "";
  const cardClass = isHabis ? "menu-card out-of-stock" : "menu-card";
  
  const imgPath = item.id === "coffee-aren" ? "assets/img/coffee_aren.png" : "assets/img/menu_tabato.jpeg";
  let unitText = `<i class='bx bx-package'></i> ${item.isi} pcs / box`;
  if (item.type === "drink") {
    unitText = `<i class='bx bx-drink'></i> ${item.isi}`;
  }

  return `
    <div class="${cardClass}" data-id="${item.id}">
      ${item.badge ? `<span class="menu-card-badge">${item.badge}</span>` : ""}
      <div class="menu-card-img"><img src="${imgPath}" alt="${item.nama}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;"></div>
      <div class="menu-card-body">
        <h3>${item.nama}</h3>
        <p>${item.deskripsi}</p>
        <div class="menu-card-footer">
          <div class="price-wrap">
            <span class="price">${formatRupiah(item.harga)}</span>
            <span class="price-unit">${unitText}</span>
          </div>
          <button class="add-btn" data-id="${item.id}" ${btnDisabled}>
            <i class='bx ${isHabis ? "bx-x-circle" : "bx-plus"}'></i> ${btnLabel}
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderMenu() {
  const container = document.getElementById("menuGrid");
  
  const foodItems = activeMenuData.filter(item => item.type !== "drink");
  const drinkItems = activeMenuData.filter(item => item.type === "drink");

  const foodHTML = foodItems.map(item => renderMenuItemCard(item)).join("");
  const drinkHTML = drinkItems.map(item => renderMenuItemCard(item)).join("");

  let html = `<div class="menu-grid">${foodHTML}</div>`;
  
  if (drinkItems.length > 0) {
    html += `
      <div class="menu-separator-container">
        <div class="menu-separator-line"></div>
        <h3 class="menu-section-title"><i class='bx bx-drink'></i> Minuman</h3>
      </div>
      <div class="menu-grid">${drinkHTML}</div>
    `;
  }
  
  container.innerHTML = html;
}

// Helper untuk memperbarui tampilan info sisa stok pada modal detail
function updateDetailStockDisplay() {
  if (!activeMenu) return;
  let stockEl = document.getElementById("detailStockInfo");
  if (!stockEl) {
    stockEl = document.createElement("p");
    stockEl.id = "detailStockInfo";
    stockEl.style.fontSize = "12.5px";
    stockEl.style.color = "var(--text-secondary)";
    stockEl.style.marginBottom = "16px";
    stockEl.style.fontWeight = "600";
    const descEl = document.getElementById("detailDeskripsi");
    descEl.parentNode.insertBefore(stockEl, descEl.nextSibling);
  }
  const maxStok = getStockInBoxes(activeMenu.id);
  const unitLabel = activeMenu.type === "drink" ? "pcs" : "box";
  stockEl.innerHTML = `<i class='bx bx-layer' style='color:var(--accent);margin-right:4px;font-size:14px;vertical-align:middle;'></i> Sisa stok: <strong>${maxStok} ${unitLabel}</strong>`;
}

// ---------- DETAIL SHEET ----------
function openDetailSheet(menuId) {
  activeMenu = activeMenuData.find((m) => m.id === menuId);
  let qty = 1;

  const imgPath = activeMenu.id === "coffee-aren" ? "assets/img/coffee_aren.png" : "assets/img/menu_tabato.jpeg";
  document.getElementById("detailIcon").innerHTML =
    `<img src="${imgPath}" alt="${activeMenu.nama}" style="width:100%;height:100%;object-fit:cover;border-radius:14px;">`;
  document.getElementById("detailNama").textContent = activeMenu.nama;
  document.getElementById("detailDeskripsi").textContent = activeMenu.deskripsi;

  const badgeEl = document.getElementById("detailIsiBadge");
  const qtyLabelEl = document.getElementById("detailQtyLabel");
  if (activeMenu.type === "drink") {
    badgeEl.innerHTML = `<i class="bx bx-drink"></i> ${activeMenu.isi}`;
    qtyLabelEl.innerHTML = `<i class="bx bx-shopping-bag"></i> Jumlah Beli`;
  } else {
    badgeEl.innerHTML = `<i class="bx bx-package"></i> ${activeMenu.isi} pcs / box`;
    qtyLabelEl.innerHTML = `<i class="bx bx-box"></i> Jumlah Box`;
  }

  updateDetailStockDisplay();

  const singleInfo = document.getElementById("singleToppingInfo");
  const mixGroup = document.getElementById("mixToppingGroup");

  if (activeMenu.type === "drink") {
    singleInfo.style.display = "none";
    mixGroup.style.display = "none";
    selectedToppingIds = [];
  } else if (activeMenu.type === "single") {
    // ---- Mode single topping: tampilkan info saja, tidak bisa diubah ----
    singleInfo.style.display = "block";
    mixGroup.style.display = "none";

    const topping = getToppingById(activeMenu.toppingId);
    document.getElementById("singleToppingChip").innerHTML =
      `<i class='bx ${topping.icon}'></i> Seluruh ${activeMenu.isi} pcs bertopping ${topping.nama}`;

    selectedToppingIds = [activeMenu.toppingId];
  } else {
    // ---- Mode mix topping: checkbox multi-select, maks 4 ----
    singleInfo.style.display = "none";
    mixGroup.style.display = "block";
    selectedToppingIds = [];

    renderToppingCheckboxList();
  }

  document.getElementById("detailQty").textContent = qty;
  updateDetailPrice(qty);
  updateAddToCartState(qty);

  document.getElementById("qtyMinus").onclick = () => {
    if (qty > 1) {
      qty--;
      document.getElementById("detailQty").textContent = qty;
      updateDetailPrice(qty);
      updateAddToCartState(qty);
    }
  };
  document.getElementById("qtyPlus").onclick = () => {
    const potentialCart = JSON.parse(JSON.stringify(cart));
    const key = activeMenu.id + "|" + [...selectedToppingIds].sort().join(",");
    const existing = potentialCart.find((c) => c.key === key);
    if (existing) {
      existing.qty += 1;
    } else {
      potentialCart.push({
        key,
        menuId: activeMenu.id,
        nama: activeMenu.nama,
        toppingIds: [...selectedToppingIds],
        qty: qty + 1,
      });
    }

    const check = validateCartStock(potentialCart);
    if (!check.valid) {
      showToast(`Stok ${check.toppingName} tidak mencukupi`, "bx-error-circle");
      return;
    }
    qty++;
    document.getElementById("detailQty").textContent = qty;
    updateDetailPrice(qty);
    updateAddToCartState(qty);
  };

  document.getElementById("addToCartBtn").onclick = () => {
    if (activeMenu.type === "mix" && selectedToppingIds.length === 0) {
      showToast("Pilih minimal 1 topping dulu ya", "bx-error-circle");
      return;
    }

    const success = addToCart(activeMenu, selectedToppingIds, qty);
    if (success) {
      closeSheet("detailSheet");
      showToast(`${activeMenu.nama} ditambahkan ke keranjang`, "bx-check-circle");
    }
  };

  openSheet("detailSheet");
}

function formatMixToppingsLabel(ids) {
  const counts = {};
  ids.forEach((id) => {
    counts[id] = (counts[id] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([id, count]) => {
      const name = getToppingById(id)?.nama || id;
      return `${name} x${count}`;
    })
    .join(", ");
}

function renderToppingCheckboxList() {
  const topingList = document.getElementById("topingList");
  const maks = activeMenu.maksTopping;

  topingList.innerHTML = activeToppingData
    .map(
      (t) => {
        const stok = activeStokData["tb-" + t.id] ?? 0;
        const outOfStock = stok <= 0;
        const count = selectedToppingIds.filter((id) => id === t.id).length;
        return `
    <div class="topping-checkbox ${outOfStock ? "out-of-stock disabled" : ""}" data-id="${t.id}" style="cursor: default;">
      <div class="tc-icon"><i class='bx ${t.icon}'></i></div>
      <span class="tc-name" style="flex:1;">${t.nama} ${outOfStock ? "<small style='color:var(--danger)'>(Habis)</small>" : `<small style="color:var(--text-muted); font-size:10px; font-weight:normal; display:block;">Stok: ${stok} pcs</small>`}</span>
      <div class="qty-control topping-qty-control" style="${outOfStock ? "display: none;" : ""}">
        <button type="button" class="t-qty-minus" data-id="${t.id}"><i class="bx bx-minus"></i></button>
        <span class="t-qty-val" data-id="${t.id}">${count}</span>
        <button type="button" class="t-qty-plus" data-id="${t.id}"><i class="bx bx-plus"></i></button>
      </div>
    </div>
  `;
      }
    )
    .join("");

  updateToppingCounter();

  topingList.querySelectorAll(".t-qty-minus").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const idx = selectedToppingIds.indexOf(id);
      if (idx > -1) {
        selectedToppingIds.splice(idx, 1);
        updateToppingDisplay(id);
      }
    });
  });

  topingList.querySelectorAll(".t-qty-plus").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const currentCount = selectedToppingIds.filter((x) => x === id).length;
      const boxQty = parseInt(document.getElementById("detailQty").textContent);
      const available = activeStokData["tb-" + id] ?? 0;

      if (selectedToppingIds.length >= maks) {
        showToast(`Maksimal total ${maks} topping per box`, "bx-error-circle");
        return;
      }

      if ((currentCount + 1) * boxQty > available) {
        showToast(`Stok ${getToppingById(id)?.nama || id} tidak mencukupi`, "bx-error-circle");
        return;
      }

      selectedToppingIds.push(id);
      updateToppingDisplay(id);
    });
  });

  renderToppingSelectionState();
}

function updateToppingDisplay(id) {
  const count = selectedToppingIds.filter((x) => x === id).length;
  const valEl = document.querySelector(`.t-qty-val[data-id="${id}"]`);
  if (valEl) {
    valEl.textContent = count;
  }
  renderToppingSelectionState();
  const qty = parseInt(document.getElementById("detailQty").textContent);
  updateDetailPrice(qty);
  updateAddToCartState(qty);
}

function renderToppingSelectionState() {
  const topingList = document.getElementById("topingList");
  const maks = activeMenu.maksTopping;
  const isFull = selectedToppingIds.length >= maks;

  topingList.querySelectorAll(".topping-checkbox").forEach((box) => {
    const id = box.dataset.id;
    const count = selectedToppingIds.filter((x) => x === id).length;
    const isSelected = count > 0;
    const outOfStock = (activeStokData["tb-" + id] ?? 0) <= 0;
    box.classList.toggle("selected", isSelected);
    
    const plusBtn = box.querySelector(".t-qty-plus");
    if (plusBtn) {
      plusBtn.disabled = isFull || outOfStock;
    }
    const minusBtn = box.querySelector(".t-qty-minus");
    if (minusBtn) {
      minusBtn.disabled = count <= 0;
    }
  });

  updateToppingCounter();
}

function updateToppingCounter() {
  const counter = document.getElementById("toppingCounter");
  const maks = activeMenu.maksTopping;
  counter.textContent = `${selectedToppingIds.length}/${maks}`;
  counter.classList.toggle("full", selectedToppingIds.length >= maks);
}

function buildToppingLabel() {
  if (activeMenu.type === "drink") {
    return "-";
  }
  if (activeMenu.type === "single") {
    const t = getToppingById(activeMenu.toppingId);
    return t.nama;
  }
  if (selectedToppingIds.length === 0) return "Belum pilih topping";
  if (activeMenu.type === "mix") {
    return formatMixToppingsLabel(selectedToppingIds);
  }
  return selectedToppingIds.map((id) => getToppingById(id).nama).join(", ");
}

function updateDetailPrice(qty) {
  const total = activeMenu.harga * qty;
  document.getElementById("addToCartBtn").innerHTML =
    `<i class='bx bx-cart-add'></i><span>Tambah ke Keranjang &middot; ${formatRupiah(total)}</span>`;
}

function updateAddToCartState(qty) {
  const btn = document.getElementById("addToCartBtn");
  if (activeMenu.type === "mix") {
    if (selectedToppingIds.length !== activeMenu.maksTopping) {
      btn.disabled = true;
    } else {
      btn.disabled = false;
    }
  } else {
    btn.disabled = false;
  }
}

// ---------- CART LOGIC ---------
function addToCart(menu, toppingIds, qty) {
  const potentialCart = JSON.parse(JSON.stringify(cart));
  const toppingLabel = buildToppingLabel();
  const key = menu.id + "|" + [...toppingIds].sort().join(",");

  const existing = potentialCart.find((c) => c.key === key);
  if (existing) {
    existing.qty += qty;
  } else {
    potentialCart.push({
      key,
      menuId: menu.id,
      nama: menu.nama,
      icon: menu.icon,
      hargaSatuan: menu.harga,
      toppingLabel: toppingLabel,
      toppingIds: [...toppingIds],
      qty: qty,
    });
  }

  const check = validateCartStock(potentialCart);
  if (!check.valid) {
    showToast(`Stok ${check.toppingName} tidak mencukupi`, "bx-error-circle");
    return false;
  }

  cart = potentialCart;
  renderCartBadgeAndBar();
  return true;
}

function updateCartQty(index, delta) {
  const potentialCart = JSON.parse(JSON.stringify(cart));
  const item = potentialCart[index];

  if (delta < 0) {
    item.qty += delta;
    if (item.qty <= 0) {
      cart.splice(index, 1);
    } else {
      cart = potentialCart;
    }
    renderCartBadgeAndBar();
    renderCart();
    return;
  }

  item.qty += delta;
  const check = validateCartStock(potentialCart);
  if (!check.valid) {
    showToast(`Stok ${check.toppingName} tidak mencukupi`, "bx-error-circle");
    return;
  }

  cart = potentialCart;
  renderCartBadgeAndBar();
  renderCart();
}

function cartTotalQty() {
  return cart.reduce((sum, c) => sum + c.qty, 0);
}

function cartTotalPrice() {
  return cart.reduce((sum, c) => sum + c.hargaSatuan * c.qty, 0);
}

function renderCartBadgeAndBar() {
  const totalQty = cartTotalQty();
  const badge = document.getElementById("cartBadge");
  const bar = document.getElementById("stickyCartBar");

  if (totalQty > 0) {
    badge.textContent = totalQty;
    badge.style.display = "flex";
    bar.classList.add("visible");
    document.getElementById("barCount").textContent = totalQty;
    document.getElementById("barTotal").textContent =
      formatRupiah(cartTotalPrice());
  } else {
    badge.style.display = "none";
    bar.classList.remove("visible");
  }
}

function renderCart() {
  const container = document.getElementById("cartItems");
  const summary = document.getElementById("cartSummary");

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="cart-empty">
        <i class='bx bx-cart'></i>
        <p>Keranjang masih kosong.<br>Yuk pilih Tabato favoritmu!</p>
      </div>`;
    summary.style.display = "none";
    document.getElementById("goToCheckoutBtn").disabled = true;
    return;
  }

  summary.style.display = "block";
  document.getElementById("goToCheckoutBtn").disabled = false;

  container.innerHTML = cart
    .map(
      (c, idx) => {
        const imgPath = c.menuId === "coffee-aren" ? "assets/img/coffee_aren.png" : "assets/img/menu_tabato.jpeg";
        return `
    <div class="cart-item">
      <div class="cart-item-icon"><img src="${imgPath}" alt="${c.nama}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;"></div>
      <div class="cart-item-body">
        <h4>${c.nama}</h4>
        <p>${c.toppingLabel}</p>
        <div class="cart-item-footer">
          <span class="price">${formatRupiah(c.hargaSatuan * c.qty)}</span>
          <div class="mini-qty">
            <button data-idx="${idx}" data-delta="-1"><i class='bx bx-minus'></i></button>
            <span>${c.qty}</span>
            <button data-idx="${idx}" data-delta="1"><i class='bx bx-plus'></i></button>
          </div>
        </div>
      </div>
    </div>
  `;
      }
    )
    .join("");

  container.querySelectorAll(".mini-qty button").forEach((btn) => {
    btn.addEventListener("click", () => {
      updateCartQty(parseInt(btn.dataset.idx), parseInt(btn.dataset.delta));
    });
  });

  document.getElementById("cartTotalPrice").textContent =
    formatRupiah(cartTotalPrice());
}

// ---------- SHEET HELPERS ----------
function openSheet(id) {
  document.getElementById(id).classList.add("active");
}
function closeSheet(id) {
  document.getElementById(id).classList.remove("active");
}

// ---------- CHECKOUT ----------
let checkoutPaymentMethod = "cash"; // 'cash' | 'qris'

function switchCheckoutPaymentMethod(method) {
  checkoutPaymentMethod = method;
  document
    .querySelectorAll("#checkoutPaymentMethod .payment-method-btn")
    .forEach((b) => b.classList.toggle("active", b.dataset.method === method));
  
  const qrisBox = document.getElementById("qrisPaymentBox");
  if (method === "qris") {
    qrisBox.style.display = "block";
    document.getElementById("qrisTotalVal").textContent = formatRupiah(cartTotalPrice());
  } else {
    qrisBox.style.display = "none";
  }
  document.getElementById("qrisConfirmError").style.display = "none";
}

function validateForm() {
  let valid = true;
  const nama = document.getElementById("inputNama");
  const lokasi = document.getElementById("inputLokasi");

  [nama, lokasi].forEach((el) =>
    el.closest(".form-group").classList.remove("error"),
  );

  if (!nama.value.trim()) {
    nama.closest(".form-group").classList.add("error");
    valid = false;
  }
  if (!lokasi.value.trim()) {
    lokasi.closest(".form-group").classList.add("error");
    valid = false;
  }

  // Untuk QRIS, customer wajib mencentang konfirmasi bahwa pembayaran sudah dilakukan
  if (checkoutPaymentMethod === "qris") {
    const checkbox = document.getElementById("qrisConfirmCheckbox");
    const errorEl = document.getElementById("qrisConfirmError");
    if (!checkbox.checked) {
      errorEl.style.display = "block";
      valid = false;
    } else {
      errorEl.style.display = "none";
    }
  }

  return valid;
}

async function submitOrder() {
  if (!validateForm()) return;
  if (cart.length === 0) {
    showToast("Keranjang masih kosong", "bx-error-circle");
    return;
  }

  const submitBtn = document.getElementById("submitOrderBtn");
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<span class="spinner"></span><span>Mengirim pesanan...</span>`;

  const nama_pemesan = document.getElementById("inputNama").value.trim();
  const no_wa = document.getElementById("inputWa").value.trim();
  const lokasi_antar = document.getElementById("inputLokasi").value.trim();

  const detail_item = cart.map((c) => ({
    nama_item: c.nama,
    varian_toping: c.toppingLabel,
    topping_ids: c.toppingIds || [],
    jumlah: c.qty,
    subtotal: c.hargaSatuan * c.qty,
  }));

  const total_harga = cartTotalPrice();
  const resi = generateResi();

  // Pesanan QRIS menunggu admin memverifikasi pembayaran masuk dulu sebelum diproses.
  // Pesanan Cash langsung berstatus "baru" seperti biasa (bayar di tempat saat diantar).
  const status =
    checkoutPaymentMethod === "qris" ? "menunggu_verifikasi" : "baru";

  const pesananDoc = {
    id_pesanan: resi,
    nama_pemesan,
    no_wa: no_wa || "-",
    lokasi_antar,
    detail_item,
    total_harga,
    status,
    sumber: "online",
    metode_bayar: checkoutPaymentMethod,
    waktu_pesan: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, "pesanan", resi), pesananDoc);
    showSuccessScreen(resi, lokasi_antar);
    cart = [];
    renderCartBadgeAndBar();
  } catch (err) {
    console.error("Gagal mengirim pesanan:", err);
    showToast(
      "Gagal mengirim pesanan. Cek koneksi & konfigurasi Firebase.",
      "bx-error-circle",
    );
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<i class='bx bx-send'></i><span>Pesan Sekarang</span>`;
  }
}

function showSuccessScreen(resi, lokasi) {
  closeSheet("checkoutSheet");
  closeSheet("cartSheet");
  document.getElementById("mainContent").style.display = "none";
  document.getElementById("successScreen").style.display = "flex";
  document.getElementById("resiCode").textContent = resi;
  document.getElementById("successLokasi").textContent = lokasi;
}

function resetToHome() {
  document.getElementById("successScreen").style.display = "none";
  document.getElementById("mainContent").style.display = "block";
  document.getElementById("inputNama").value = "";
  document.getElementById("inputWa").value = "";
  document.getElementById("inputLokasi").value = "";
  document.getElementById("qrisConfirmCheckbox").checked = false;
  switchCheckoutPaymentMethod("cash");
  const submitBtn = document.getElementById("submitOrderBtn");
  submitBtn.disabled = false;
  submitBtn.innerHTML = `<i class='bx bx-send'></i><span>Pesan Sekarang</span>`;
}

function trackOrderDirectly() {
  const resi = document.getElementById("resiCode").textContent.trim();
  resetToHome();
  document.getElementById("trackResiInput").value = resi;
  openSheet("trackSheet");
  searchOrders();
}

// ---------- CEK STATUS PESANAN ----------

const STATUS_STEPS = [
  { key: "baru", label: "Pesanan Diterima", icon: "bx-receipt" },
  { key: "proses", label: "Sedang Disiapkan", icon: "bx-food-menu" },
  { key: "selesai", label: "Selesai", icon: "bx-check" },
];

function formatTrackDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return (
    d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }) +
    " " +
    d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
  );
}

function renderStatusStepper(status) {
  // Pesanan dibatalkan: tampilkan stepper khusus, tidak ikut alur normal
  if (status === "batal") {
    return `
      <div class="track-stepper">
        <div class="track-step batal">
          <div class="track-step-dot"><i class='bx bx-x'></i></div>
          <span class="track-step-label">Dibatalkan</span>
        </div>
      </div>`;
  }

  // Pesanan QRIS yang belum diverifikasi pembayarannya: tampilkan step menunggu verifikasi
  if (status === "menunggu_verifikasi") {
    return `
      <div class="track-stepper">
        <div class="track-step current">
          <div class="track-step-line"></div>
          <div class="track-step-dot"><i class='bx bx-time-five'></i></div>
          <span class="track-step-label">Menunggu Verifikasi Pembayaran</span>
        </div>
        <div class="track-step">
          <div class="track-step-line"></div>
          <div class="track-step-dot"><i class='bx bx-food-menu'></i></div>
          <span class="track-step-label">Sedang Disiapkan</span>
        </div>
        <div class="track-step">
          <div class="track-step-dot"><i class='bx bx-check'></i></div>
          <span class="track-step-label">Selesai</span>
        </div>
      </div>`;
  }

  const currentIdx = STATUS_STEPS.findIndex((s) => s.key === status);
  return `
    <div class="track-stepper">
      ${STATUS_STEPS.map((step, idx) => {
        let cls = "";
        if (idx < currentIdx) cls = "completed";
        else if (idx === currentIdx) cls = "current";
        return `
          <div class="track-step ${cls}">
            <div class="track-step-line"></div>
            <div class="track-step-dot"><i class='bx ${step.icon}'></i></div>
            <span class="track-step-label">${step.label}</span>
          </div>`;
      }).join("")}
    </div>`;
}

function renderTrackResultCard(order) {
  const metodeBayarLabel = order.metode_bayar === "qris" ? "QRIS" : "Tunai";
  return `
    <div class="track-result-card">
      <div class="track-result-header">
        <div>
          <div class="track-result-resi">${escapeHTML(order.id_pesanan)}</div>
          <div class="track-result-date">${formatTrackDate(order.waktu_pesan)}</div>
        </div>
      </div>
      ${renderStatusStepper(order.status)}
      <div style="margin-top:14px;">
        ${(order.detail_item || [])
          .map(
            (it) => `
          <div class="track-item-row">
            <span>${escapeHTML(it.nama_item)} <span style="color:var(--text-muted)">&times;${it.jumlah}</span></span>
            <span style="font-weight:700">${formatRupiah(it.subtotal)}</span>
          </div>
        `,
          )
          .join("")}
      </div>
      <div class="track-item-row" style="border-top:1px solid var(--card-border);margin-top:6px;padding-top:10px;">
        <span style="font-weight:700">Total &middot; ${metodeBayarLabel}</span>
        <span style="font-weight:800;color:var(--accent)">${formatRupiah(order.total_harga)}</span>
      </div>
    </div>`;
}

async function searchOrders() {
  const inputEl = document.getElementById("trackResiInput");
  const value = inputEl.value.trim();

  const errorGroup = document.getElementById("trackResiGroup");
  errorGroup.classList.remove("error");
  if (!value) {
    errorGroup.classList.add("error");
    return;
  }

  const searchBtn = document.getElementById("trackSearchBtn");
  const resultsContainer = document.getElementById("trackResults");
  searchBtn.disabled = true;
  searchBtn.innerHTML = `<span class="spinner"></span><span>Mencari...</span>`;
  resultsContainer.innerHTML = "";

  try {
    const snap = await getDoc(doc(db, "pesanan", value));

    if (!snap.exists()) {
      resultsContainer.innerHTML = `
        <div class="track-result-empty">
          <i class='bx bx-search-alt'></i>
          <p>Pesanan tidak ditemukan.<br>Pastikan nomor resi sudah benar.</p>
        </div>`;
      return;
    }

    const order = snap.data();
    resultsContainer.innerHTML = renderTrackResultCard(order);
  } catch (err) {
    console.error("Gagal mencari pesanan:", err);
    resultsContainer.innerHTML = `
      <div class="track-result-empty">
        <i class='bx bx-error-circle'></i>
        <p>Gagal memuat data. Cek koneksi internet kamu.</p>
      </div>`;
  } finally {
    searchBtn.disabled = false;
    searchBtn.innerHTML = `<i class='bx bx-search'></i><span>Cek Status</span>`;
  }
}

// ---------- EVENT BINDINGS ----------
function bindEvents() {
  document.getElementById("themeToggle").addEventListener("click", toggleTheme);

  // Event Delegation untuk klik kartu menu / tombol tambah
  document.getElementById("menuGrid").addEventListener("click", (e) => {
    const el = e.target.closest(".menu-card, .add-btn");
    if (!el) return;

    e.stopPropagation();
    const id = el.dataset.id;
    if (!id) return;

    const stokBoxes = getStockInBoxes(id);
    if (stokBoxes <= 0) {
      showToast("Stok produk ini sedang habis ya", "bx-error-circle");
      return;
    }
    openDetailSheet(id);
  });

  document.getElementById("cartIconBtn").addEventListener("click", () => {
    renderCart();
    openSheet("cartSheet");
  });
  document.getElementById("stickyCartBar").addEventListener("click", () => {
    renderCart();
    openSheet("cartSheet");
  });

  document.getElementById("trackOrderBtn").addEventListener("click", () => {
    openSheet("trackSheet");
  });
  document
    .getElementById("trackSearchBtn")
    .addEventListener("click", searchOrders);
  document.getElementById("trackResiInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") searchOrders();
  });

  document.querySelectorAll("[data-close]").forEach((el) => {
    el.addEventListener("click", () => closeSheet(el.dataset.close));
  });
  document.querySelectorAll(".overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeSheet(overlay.id);
    });
  });

  document.getElementById("goToCheckoutBtn").addEventListener("click", () => {
    closeSheet("cartSheet");
    switchCheckoutPaymentMethod("cash");
    openSheet("checkoutSheet");
  });

  document
    .getElementById("checkoutPaymentMethod")
    .addEventListener("click", (e) => {
      const btn = e.target.closest(".payment-method-btn");
      if (!btn) return;
      switchCheckoutPaymentMethod(btn.dataset.method);
    });

  document
    .getElementById("submitOrderBtn")
    .addEventListener("click", submitOrder);
  document
    .getElementById("backToHomeBtn")
    .addEventListener("click", resetToHome);
  document
    .getElementById("directTrackBtn")
    .addEventListener("click", trackOrderDirectly);
}

// Setelah menu dimuat, subscribe perubahan real-time supaya kalau admin
// update menu, halaman customer ikut berubah tanpa perlu refresh.
function subscribeMenuRealtime() {
  onSnapshot(doc(db, "config", "menuData"), (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    if (Array.isArray(data.items) && data.items.length > 0) {
      activeMenuData = data.items;
      renderMenu(); // re-render otomatis saat menu berubah
    }
  });
}

// Subscribe perubahan real-time untuk toppings
function subscribeToppingsRealtime() {
  onSnapshot(doc(db, "config", "toppings"), (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    if (Array.isArray(data.items) && data.items.length > 0) {
      activeToppingData = data.items;
    }
  });
}

// Subscribe perubahan real-time untuk stok
function subscribeStokRealtime() {
  onSnapshot(doc(db, "config", "stok"), (snap) => {
    if (!snap.exists()) return;
    const docData = snap.data();
    const rawData = docData.data || docData;
    activeStokData = {};
    for (const key in rawData) {
      if (key === "updatedAt" || key === "data") continue;

      if (rawData[key] && typeof rawData[key] === "object") {
        activeStokData[key] = rawData[key].qty ?? 50;
      } else if (typeof rawData[key] === "number") {
        activeStokData[key] = rawData[key];
      }
    }
    renderMenu(); // re-render agar tampilan "Habis" update
    updateDetailStockDisplay();
  });
}

// ---------- INIT ----------
function init() {
  initTheme();
  bindEvents();
  renderCartBadgeAndBar();
  subscribeMenuRealtime(); // subscribe real-time secara langsung (mengambil data awal otomatis)
  subscribeToppingsRealtime();
  subscribeStokRealtime();
}

document.addEventListener("DOMContentLoaded", () => init());

