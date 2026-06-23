// ============================================================
// ADMIN: STATE
// State lokal (localStorage) untuk menu, topping, stok, settings,
// serta sinkronisasi menu/stok ke Firestore agar halaman customer
// (index.html) ikut terupdate.
// ============================================================

import {
  db,
  collection,
  addDoc,
  doc,
  updateDoc,
  setDoc,
  getDoc,
  serverTimestamp,
  runTransaction,
  query,
  orderBy,
  limit,
  getDocs,
} from "../firebase-config.js";

// ====== DEFAULT DATA (dipakai saat localStorage masih kosong) ======
export const DEFAULT_MENU = [
  {
    id: "tb-mix",
    nama: "Mix Topping",
    deskripsi:
      "Pilih sendiri kombinasi hingga 4 topping favoritmu dalam satu box berisi 4 pcs.",
    icon: "bx-category",
    type: "mix",
    harga: 13000,
    isi: 4,
    maksTopping: 4,
    badge: "Bisa Custom",
  },
  {
    id: "tb-keju",
    nama: "Keju",
    deskripsi:
      "Satu box berisi 4 pcs, seluruhnya bertopping keju gurih meleleh.",
    icon: "bxs-cheese",
    type: "single",
    toppingId: "keju",
    harga: 13000,
    isi: 4,
  },
  {
    id: "tb-daun-bawang",
    nama: "Daun Bawang",
    deskripsi:
      "Satu box berisi 4 pcs, seluruhnya bertopping daun bawang segar.",
    icon: "bx-leaf",
    type: "single",
    toppingId: "daun-bawang",
    harga: 13000,
    isi: 4,
  },
  {
    id: "tb-cabe-rawit",
    nama: "Cabe Rawit",
    deskripsi: "Satu box berisi 4 pcs, seluruhnya bertopping cabe rawit pedas.",
    icon: "bxs-hot",
    type: "single",
    toppingId: "cabe-rawit",
    harga: 13000,
    isi: 4,
  },
  {
    id: "tb-sosis",
    nama: "Sosis",
    deskripsi: "Satu box berisi 4 pcs, seluruhnya bertopping sosis gurih.",
    icon: "bx-baguette",
    type: "single",
    toppingId: "sosis",
    harga: 13000,
    isi: 4,
  },
  {
    id: "tb-kepiting",
    nama: "Kepiting",
    deskripsi: "Satu box berisi 4 pcs, seluruhnya bertopping kepiting spesial.",
    icon: "bx-dish",
    type: "single",
    toppingId: "kepiting",
    harga: 13000,
    isi: 4,
  },
  {
    id: "tb-jamur",
    nama: "Jamur",
    deskripsi: "Satu box berisi 4 pcs, seluruhnya bertopping jamur lezat.",
    icon: "bx-cookie",
    type: "single",
    toppingId: "jamur",
    harga: 13000,
    isi: 4,
  },
  {
    id: "coffee-aren",
    nama: "Coffee Aren",
    deskripsi: "Kopi susu gula aren premium kemasan botol 250 ml, manis dan segar.",
    icon: "bx-drink",
    type: "drink",
    harga: 15000,
    isi: "250 ml",
  },
];

export const DEFAULT_TOPPINGS = [
  { id: "keju", nama: "Keju", icon: "bxs-cheese" },
  { id: "daun-bawang", nama: "Daun Bawang", icon: "bx-leaf" },
  { id: "cabe-rawit", nama: "Cabe Rawit", icon: "bxs-hot" },
  { id: "sosis", nama: "Sosis", icon: "bx-baguette" },
  { id: "kepiting", nama: "Kepiting", icon: "bx-dish" },
  { id: "jamur", nama: "Jamur", icon: "bx-cookie" },
];

// ====== STATE (di-load sekali saat module ini pertama kali diimport) ======
export let localMenuData = null;
export let localToppings = null;
export let localStok = {};
export let stokHistory = [];
export let allOrders = [];
export let currentOrderFilter = "semua";
export let adminSettings = {};
export let adminPassword = "";

export function setAllOrders(orders) {
  allOrders = orders;
}

export function setCurrentOrderFilter(filter) {
  currentOrderFilter = filter;
}

// ====== GETTERS ======
export function getMenu() {
  return localMenuData || DEFAULT_MENU;
}
export function getToppings() {
  return localToppings || DEFAULT_TOPPINGS;
}
export function getStok(menuId) {
  return localStok[menuId] ?? 50;
}

export function getStokBoxes(menuId) {
  const menu = getMenu();
  const target = menu.find((x) => x.id === menuId);
  if (menuId === "tb-mix") {
    const totalPieces = menu
      .filter((m) => m.id !== "tb-mix" && m.type !== "mix" && m.type !== "drink")
      .reduce((sum, m) => sum + getStok(m.id), 0);
    return Math.floor(totalPieces / 4);
  }
  if (target && target.type === "drink") {
    return getStok(menuId);
  }
  const pieces = getStok(menuId);
  return Math.floor(pieces / 4);
}

export async function deductStockForOrder(detailItems, docId, actionSource = "Sistem") {
  const menu = getMenu();
  const toppings = getToppings();
  const deductions = {};
  const logDetails = [];

  for (const item of detailItems) {
    const m = menu.find((x) => x.nama === item.nama_item);
    if (!m) continue;

    if (m.id === "tb-mix" || m.type === "mix") {
      let toppingIds = item.topping_ids || [];
      if (toppingIds.length === 0 && item.varian_toping && item.varian_toping !== "-") {
        const names = item.varian_toping.split(",").map((s) => s.trim());
        names.forEach((name) => {
          const t = toppings.find((x) => x.nama.toLowerCase() === name.toLowerCase());
          if (t) toppingIds.push(t.id);
        });
      }

      if (toppingIds.length > 0) {
        const N = toppingIds.length;
        const countsPerBox = {};
        for (let i = 0; i < 4; i++) {
          const tid = toppingIds[i % N];
          countsPerBox[tid] = (countsPerBox[tid] || 0) + 1;
        }

        for (const [tid, count] of Object.entries(countsPerBox)) {
          const targetMenuId = "tb-" + tid;
          const piecesToDeduct = count * item.jumlah;
          deductions[targetMenuId] = (deductions[targetMenuId] || 0) + piecesToDeduct;
          logDetails.push({
            menuId: targetMenuId,
            deduct: piecesToDeduct,
            alasan: `Pesanan ${docId} (Mix Topping: potong ${piecesToDeduct} pcs)`
          });
        }
      }
    } else if (m.type === "drink") {
      const piecesToDeduct = 1 * item.jumlah;
      deductions[m.id] = (deductions[m.id] || 0) + piecesToDeduct;
      logDetails.push({
        menuId: m.id,
        deduct: piecesToDeduct,
        alasan: `Pesanan ${docId} (potong ${piecesToDeduct} pcs)`
      });
    } else {
      const piecesToDeduct = 4 * item.jumlah;
      deductions[m.id] = (deductions[m.id] || 0) + piecesToDeduct;
      logDetails.push({
        menuId: m.id,
        deduct: piecesToDeduct,
        alasan: `Pesanan ${docId} (potong ${piecesToDeduct} pcs/box)`
      });
    }
  }

  if (Object.keys(deductions).length === 0) return;

  const stokDocRef = doc(db, "config", "stok");
  const newLogs = [];

  try {
    await runTransaction(db, async (transaction) => {
      const stokSnap = await transaction.get(stokDocRef);
      let currentStokData = {};
      if (stokSnap.exists() && stokSnap.data().data) {
        currentStokData = stokSnap.data().data;
      }

      const updatedStokData = { ...currentStokData };
      newLogs.length = 0; // Bersihkan jika transaksi dicoba ulang

      for (const [menuId, deductAmount] of Object.entries(deductions)) {
        const oldQty = currentStokData[menuId] ? currentStokData[menuId].qty : 50;
        const newQty = Math.max(0, oldQty - deductAmount);
        
        localStok[menuId] = newQty;
        updatedStokData[menuId] = {
          qty: newQty,
          habis: newQty <= 0
        };

        const logsForThisMenu = logDetails.filter(d => d.menuId === menuId);
        logsForThisMenu.forEach((log) => {
          newLogs.push({
            waktu: new Date().toISOString(),
            menuId,
            namaProduk: (getMenu().find((m) => m.id === menuId) || {}).nama || menuId,
            delta: -log.deduct,
            stokBaru: newQty,
            alasan: log.alasan,
            petugas: actionSource
          });
        });
      }

      transaction.set(stokDocRef, { data: updatedStokData, updatedAt: serverTimestamp() }, { merge: true });

      // Simpan log secara individual di koleksi stokHistory
      newLogs.forEach((log) => {
        const newLogRef = doc(collection(db, "stokHistory"));
        transaction.set(newLogRef, log);
      });
    });

    // Tambahkan ke state memori lokal jika transaksi sukses
    stokHistory.unshift(...newLogs);
    if (stokHistory.length > 100) {
      stokHistory.length = 100;
    }
  } catch (err) {
    console.error("Gagal melakukan transaksi pengurangan stok:", err);
    for (const [menuId, deductAmount] of Object.entries(deductions)) {
      localStok[menuId] = Math.max(0, (localStok[menuId] || 50) - deductAmount);
    }
  }
}

export async function restoreStockForOrder(detailItems, docId, actionSource = "Sistem") {
  const menu = getMenu();
  const toppings = getToppings();
  const additions = {};
  const logDetails = [];

  for (const item of detailItems) {
    const m = menu.find((x) => x.nama === item.nama_item);
    if (!m) continue;

    if (m.id === "tb-mix" || m.type === "mix") {
      let toppingIds = item.topping_ids || [];
      if (toppingIds.length === 0 && item.varian_toping && item.varian_toping !== "-") {
        const names = item.varian_toping.split(",").map((s) => s.trim());
        names.forEach((name) => {
          const t = toppings.find((x) => x.nama.toLowerCase() === name.toLowerCase());
          if (t) toppingIds.push(t.id);
        });
      }

      if (toppingIds.length > 0) {
        const N = toppingIds.length;
        const countsPerBox = {};
        for (let i = 0; i < 4; i++) {
          const tid = toppingIds[i % N];
          countsPerBox[tid] = (countsPerBox[tid] || 0) + 1;
        }

        for (const [tid, count] of Object.entries(countsPerBox)) {
          const targetMenuId = "tb-" + tid;
          const piecesToRestore = count * item.jumlah;
          additions[targetMenuId] = (additions[targetMenuId] || 0) + piecesToRestore;
          logDetails.push({
            menuId: targetMenuId,
            add: piecesToRestore,
            alasan: `Pembatalan Pesanan ${docId} (kembalikan ${piecesToRestore} pcs topping)`
          });
        }
      }
    } else if (m.type === "drink") {
      const piecesToRestore = 1 * item.jumlah;
      additions[m.id] = (additions[m.id] || 0) + piecesToRestore;
      logDetails.push({
        menuId: m.id,
        add: piecesToRestore,
        alasan: `Pembatalan Pesanan ${docId} (kembalikan ${piecesToRestore} pcs)`
      });
    } else {
      const piecesToRestore = 4 * item.jumlah;
      additions[m.id] = (additions[m.id] || 0) + piecesToRestore;
      logDetails.push({
        menuId: m.id,
        add: piecesToRestore,
        alasan: `Pembatalan Pesanan ${docId} (kembalikan ${piecesToRestore} pcs/box)`
      });
    }
  }

  if (Object.keys(additions).length === 0) return;

  const stokDocRef = doc(db, "config", "stok");
  const newLogs = [];

  try {
    await runTransaction(db, async (transaction) => {
      const stokSnap = await transaction.get(stokDocRef);
      let currentStokData = {};
      if (stokSnap.exists() && stokSnap.data().data) {
        currentStokData = stokSnap.data().data;
      }

      const updatedStokData = { ...currentStokData };
      newLogs.length = 0; // Bersihkan jika transaksi dicoba ulang

      for (const [menuId, addAmount] of Object.entries(additions)) {
        const oldQty = currentStokData[menuId] ? currentStokData[menuId].qty : 50;
        const newQty = oldQty + addAmount;
        
        localStok[menuId] = newQty;
        updatedStokData[menuId] = {
          qty: newQty,
          habis: newQty <= 0
        };

        const logsForThisMenu = logDetails.filter(d => d.menuId === menuId);
        logsForThisMenu.forEach((log) => {
          newLogs.push({
            waktu: new Date().toISOString(),
            menuId,
            namaProduk: (getMenu().find((m) => m.id === menuId) || {}).nama || menuId,
            delta: log.add,
            stokBaru: newQty,
            alasan: log.alasan,
            petugas: actionSource
          });
        });
      }

      transaction.set(stokDocRef, { data: updatedStokData, updatedAt: serverTimestamp() }, { merge: true });

      // Simpan log secara individual di koleksi stokHistory
      newLogs.forEach((log) => {
        const newLogRef = doc(collection(db, "stokHistory"));
        transaction.set(newLogRef, log);
      });
    });

    // Tambahkan ke state memori lokal jika transaksi sukses
    stokHistory.unshift(...newLogs);
    if (stokHistory.length > 100) {
      stokHistory.length = 100;
    }
  } catch (err) {
    console.error("Gagal melakukan transaksi pengembalian stok:", err);
    for (const [menuId, addAmount] of Object.entries(additions)) {
      localStok[menuId] = (localStok[menuId] || 50) + addAmount;
    }
  }
}

// ====== SETTERS (persist ke Firestore) ======
export async function saveMenu(data) {
  localMenuData = data;
  await syncMenuToFirestore(data);
}

export async function saveToppings(data) {
  localToppings = data;
  try {
    const ref = doc(db, "config", "toppings");
    await setDoc(
      ref,
      {
        items: data,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (e) {
    console.warn("Gagal sync toppings ke Firestore:", e);
  }
}

export async function setStok(menuId, val, alasan = "-", petugas = "Admin") {
  const targetVal = Math.max(0, val);
  const stokDocRef = doc(db, "config", "stok");
  let newLog = null;

  try {
    await runTransaction(db, async (transaction) => {
      const stokSnap = await transaction.get(stokDocRef);
      let currentStokData = {};
      if (stokSnap.exists() && stokSnap.data().data) {
        currentStokData = stokSnap.data().data;
      }

      const oldVal = currentStokData[menuId] ? currentStokData[menuId].qty : 50;
      const delta = targetVal - oldVal;

      localStok[menuId] = targetVal;

      const updatedStokData = { ...currentStokData };
      updatedStokData[menuId] = {
        qty: targetVal,
        habis: targetVal <= 0
      };

      newLog = {
        waktu: new Date().toISOString(),
        menuId,
        namaProduk: (getMenu().find((m) => m.id === menuId) || {}).nama || menuId,
        delta,
        stokBaru: targetVal,
        alasan,
        petugas
      };

      transaction.set(stokDocRef, { data: updatedStokData, updatedAt: serverTimestamp() }, { merge: true });
      
      const newLogRef = doc(collection(db, "stokHistory"));
      transaction.set(newLogRef, newLog);
    });

    if (newLog) {
      stokHistory.unshift(newLog);
      if (stokHistory.length > 100) {
        stokHistory.length = 100;
      }
    }
  } catch (e) {
    console.error("Gagal melakukan transaksi setStok:", e);
    localStok[menuId] = targetVal;
  }
}

export async function saveAdminSettings(settings) {
  for (const key in adminSettings) {
    delete adminSettings[key];
  }
  Object.assign(adminSettings, settings);
  try {
    const ref = doc(db, "config", "settings");
    await setDoc(
      ref,
      {
        ...settings,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (e) {
    console.warn("Gagal sync settings ke Firestore:", e);
  }
}

export async function saveAdminPassword(newPassword) {
  // Deprecated: Password admin dikelola via Firebase Auth, bukan lagi disimpan plaintext di Firestore config
}

// ====== FIRESTORE SYNC ======
async function syncMenuToFirestore(menuData) {
  try {
    const ref = doc(db, "config", "menuData");
    await setDoc(
      ref,
      {
        items: menuData,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (e) {
    console.warn("Gagal sync menu ke Firestore:", e);
  }
}

async function syncStokToFirestore() {
  try {
    const stokWithStatus = {};
    getMenu().forEach((m) => {
      stokWithStatus[m.id] = {
        qty: getStok(m.id),
        habis: getStok(m.id) <= 0,
      };
    });
    const ref = doc(db, "config", "stok");
    await setDoc(
      ref,
      {
        data: stokWithStatus,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (e) {
    console.warn("Gagal sync stok ke Firestore:", e);
  }
}

async function syncStokHistoryToFirestore() {
  // Deprecated: Riwayat stok kini disimpan per dokumen secara individual di koleksi 'stokHistory'
}

// ====== INITIALIZER ======
export async function initAdminState() {
  try {
    // 1. Load Menu
    const menuDoc = await getDoc(doc(db, "config", "menuData"));
    if (menuDoc.exists() && menuDoc.data().items) {
      localMenuData = menuDoc.data().items;
      if (!localMenuData.some(m => m.id === "coffee-aren")) {
        localMenuData.push({
          id: "coffee-aren",
          nama: "Coffee Aren",
          deskripsi: "Kopi susu gula aren premium kemasan botol 250 ml, manis dan segar.",
          icon: "bx-drink",
          type: "drink",
          harga: 15000,
          isi: "250 ml",
        });
        await syncMenuToFirestore(localMenuData);
      }
    } else {
      localMenuData = DEFAULT_MENU;
      await syncMenuToFirestore(localMenuData);
    }

    // 2. Load Toppings
    const toppingsDoc = await getDoc(doc(db, "config", "toppings"));
    if (toppingsDoc.exists() && toppingsDoc.data().items) {
      localToppings = toppingsDoc.data().items;
    } else {
      localToppings = DEFAULT_TOPPINGS;
      await saveToppings(localToppings);
    }

    // 3. Load Stock
    const stokDoc = await getDoc(doc(db, "config", "stok"));
    if (stokDoc.exists()) {
      const docData = stokDoc.data();
      // Mendukung skema nested { data: {...} } maupun skema flat di root dokumen
      const rawData = docData.data || docData;

      for (const key in localStok) {
        delete localStok[key];
      }
      for (const key in rawData) {
        if (key === "updatedAt" || key === "data") continue;

        if (rawData[key] && typeof rawData[key] === "object") {
          localStok[key] = rawData[key].qty ?? 50;
        } else if (typeof rawData[key] === "number") {
          localStok[key] = rawData[key];
        }
      }
      if (localStok["coffee-aren"] === undefined) {
        localStok["coffee-aren"] = 0;
        await syncStokToFirestore();
      }
    } else {
      for (const key in localStok) {
        delete localStok[key];
      }
      localMenuData.forEach((m) => {
        localStok[m.id] = m.id === "coffee-aren" ? 0 : 50;
      });
      await syncStokToFirestore();
    }

    // 4. Load Stock History
    stokHistory.length = 0;
    try {
      const q = query(collection(db, "stokHistory"), orderBy("waktu", "desc"), limit(100));
      const historySnap = await getDocs(q);
      historySnap.forEach((d) => {
        stokHistory.push(d.data());
      });

      // Fallback & Migrasi Otomatis dari config/stokHistory jika koleksi baru kosong
      if (stokHistory.length === 0) {
        const oldHistoryDoc = await getDoc(doc(db, "config", "stokHistory"));
        if (oldHistoryDoc.exists() && oldHistoryDoc.data().items) {
          const oldItems = oldHistoryDoc.data().items;
          stokHistory.push(...oldItems);

          // Migrasikan item secara asinkron ke koleksi baru
          for (const item of oldItems) {
            const newLogRef = doc(collection(db, "stokHistory"));
            setDoc(newLogRef, item).catch(err =>
              console.error("Gagal migrasi riwayat stok lama ke koleksi baru:", err)
            );
          }
        }
      }
    } catch (err) {
      console.error("Gagal memuat riwayat stok dari koleksi Firestore:", err);
      // Jika kueri koleksi gagal (misal rules bermasalah), coba baca dari dokumen lama sebagai fallback darurat.
      try {
        const oldHistoryDoc = await getDoc(doc(db, "config", "stokHistory"));
        if (oldHistoryDoc.exists() && oldHistoryDoc.data().items) {
          stokHistory.push(...oldHistoryDoc.data().items);
        }
      } catch (errFallback) {
        console.error("Gagal memuat riwayat stok fallback:", errFallback);
      }
    }

    // 5. Load Settings
    const settingsDoc = await getDoc(doc(db, "config", "settings"));
    for (const key in adminSettings) {
      delete adminSettings[key];
    }
    if (settingsDoc.exists()) {
      Object.assign(adminSettings, settingsDoc.data());
    } else {
      Object.assign(adminSettings, {
        namaToko: "Tabato",
        tagline: "Tahu Baso Toping",
        minStok: 10,
      });
      await saveAdminSettings(adminSettings);
    }

    // 6. Password loading deprecated (Firebase Auth handles session & password verification securely)
  } catch (e) {
    console.error("Gagal inisialisasi data dari Firestore:", e);
    loadFromLocalStorageFallback();
  }
}

function loadFromLocalStorageFallback() {
  localMenuData = JSON.parse(localStorage.getItem("tabato-menu")) || DEFAULT_MENU;
  localToppings = JSON.parse(localStorage.getItem("tabato-toppings")) || DEFAULT_TOPPINGS;
  
  const tempStok = JSON.parse(localStorage.getItem("tabato-stok")) || {};
  for (const key in localStok) {
    delete localStok[key];
  }
  Object.assign(localStok, tempStok);
  if (Object.keys(localStok).length === 0) {
    localMenuData.forEach((m) => {
      localStok[m.id] = 50;
    });
  }

  const tempHist = JSON.parse(localStorage.getItem("tabato-stok-history")) || [];
  stokHistory.length = 0;
  stokHistory.push(...tempHist);

  const tempSet = JSON.parse(localStorage.getItem("tabato-admin-settings")) || {};
  for (const key in adminSettings) {
    delete adminSettings[key];
  }
  Object.assign(adminSettings, {
    namaToko: "Tabato",
    tagline: "Tahu Baso Toping",
    minStok: 10,
    ...tempSet
  });

  adminPassword = "";
}
