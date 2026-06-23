// ============================================================
// DATA MENU TABATO
// Produk dijual per box berisi 4 pcs, harga Rp13.000 / box.
//
// Struktur:
// - type: "mix"     -> customer pilih kombinasi topping sendiri (checkbox, maks 4)
// - type: "single"  -> seluruh isi box menggunakan 1 jenis topping yang sama
// ============================================================

export const HARGA_PER_BOX = 13000;
export const ISI_PER_BOX = 4;

// Daftar 6 topping yang tersedia (dipakai untuk opsi Mix & untuk badge single)
// icon: nama class Boxicons (tanpa prefix "bx ")
export const DAFTAR_TOPPING = [
  { id: "keju", nama: "Keju", icon: "bxs-cheese" },
  { id: "daun-bawang", nama: "Daun Bawang", icon: "bx-leaf" },
  { id: "cabe-rawit", nama: "Cabe Rawit", icon: "bxs-hot" },
  { id: "sosis", nama: "Sosis", icon: "bx-baguette" },
  { id: "kepiting", nama: "Kepiting", icon: "bx-dish" },
  { id: "jamur", nama: "Jamur", icon: "bx-cookie" },
];

export const MENU_DATA = [
  {
    id: "tb-mix",
    nama: "Mix Topping",
    deskripsi: `Pilih sendiri kombinasi hingga 4 topping favoritmu dalam satu box berisi ${ISI_PER_BOX} pcs.`,
    icon: "bx-category",
    type: "mix",
    harga: HARGA_PER_BOX,
    isi: ISI_PER_BOX,
    maksTopping: 4,
    badge: "Bisa Custom",
  },
  {
    id: "tb-keju",
    nama: "Keju",
    deskripsi: `Satu box berisi ${ISI_PER_BOX} pcs, seluruhnya bertopping keju gurih meleleh.`,
    icon: "bxs-cheese",
    type: "single",
    toppingId: "keju",
    harga: HARGA_PER_BOX,
    isi: ISI_PER_BOX,
  },
  {
    id: "tb-daun-bawang",
    nama: "Daun Bawang",
    deskripsi: `Satu box berisi ${ISI_PER_BOX} pcs, seluruhnya bertopping daun bawang segar.`,
    icon: "bx-leaf",
    type: "single",
    toppingId: "daun-bawang",
    harga: HARGA_PER_BOX,
    isi: ISI_PER_BOX,
  },
  {
    id: "tb-cabe-rawit",
    nama: "Cabe Rawit",
    deskripsi: `Satu box berisi ${ISI_PER_BOX} pcs, seluruhnya bertopping cabe rawit pedas.`,
    icon: "bxs-hot",
    type: "single",
    toppingId: "cabe-rawit",
    harga: HARGA_PER_BOX,
    isi: ISI_PER_BOX,
  },
  {
    id: "tb-sosis",
    nama: "Sosis",
    deskripsi: `Satu box berisi ${ISI_PER_BOX} pcs, seluruhnya bertopping sosis gurih.`,
    icon: "bx-baguette",
    type: "single",
    toppingId: "sosis",
    harga: HARGA_PER_BOX,
    isi: ISI_PER_BOX,
  },
  {
    id: "tb-kepiting",
    nama: "Kepiting",
    deskripsi: `Satu box berisi ${ISI_PER_BOX} pcs, seluruhnya bertopping kepiting spesial.`,
    icon: "bx-dish",
    type: "single",
    toppingId: "kepiting",
    harga: HARGA_PER_BOX,
    isi: ISI_PER_BOX,
  },
  {
    id: "tb-jamur",
    nama: "Jamur",
    deskripsi: `Satu box berisi ${ISI_PER_BOX} pcs, seluruhnya bertopping jamur lezat.`,
    icon: "bx-cookie",
    type: "single",
    toppingId: "jamur",
    harga: HARGA_PER_BOX,
    isi: ISI_PER_BOX,
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
