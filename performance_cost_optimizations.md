# Hasil Pembenahan Performa & Biaya (Performance & Cost Optimization)

Berkas ini menjelaskan seluruh perubahan yang telah diimplementasikan pada aplikasi Tabato untuk meningkatkan kecepatan muat halaman, mengurangi beban memori browser, dan meminimalkan biaya operasi database (Firestore Reads & Writes).

---

## 1. Perubahan & Optimasi yang Dilakukan

### A. Eliminasi Double Reads pada Halaman Pelanggan (Customer Page)
* **Lokasi Berkas**: [app.js](file:///d:/belajar%20membuat%20web/tabato-app/public/app.js)
* **Masalah Sebelumnya**: Pada saat startup, halaman melakukan pemuatan data awal secara satu-per-satu menggunakan `getDoc` (`loadMenuFromFirestore`, `loadToppingsFromFirestore`, `loadStokFromFirestore`). Sesaat setelah data tersebut dirender, aplikasi mendaftarkan listener real-time `onSnapshot`. Karena `onSnapshot` secara default *selalu* mengembalikan state awal dokumen pada saat dihubungkan, pemanggilan `getDoc` sebelumnya adalah operasi redundan yang membuang-buang kuota baca (Reads) Firestore sebanyak 2x lipat.
* **Solusi Perbaikan**: Menghapus seluruh fungsi pemuat statis (`loadMenuFromFirestore`, dsb.) dan memodifikasi inisialisasi aplikasi (`init`) agar mendaftarkan `onSnapshot` secara langsung.
* **Dampak**: 
  - Mengurangi jumlah pembacaan Firestore (Reads) sebesar **50%** setiap kali halaman pelanggan dimuat.
  - Mempercepat waktu muat visual karena rendering langsung berjalan saat koneksi real-time terjalin.

### B. Pembatasan Jumlah Data Real-time (Query Limiting)
* **Lokasi Berkas**: [orders.js](file:///d:/belajar%20membuat%20web/tabato-app/public/Firestore/orders.js)
* **Masalah Sebelumnya**: Listener real-time kasir menarik seluruh koleksi `pesanan` tanpa batas (`orderBy("waktu_pesan", "desc")`). Jika total transaksi telah mencapai ribuan data, setiap kasir yang membuka dasbor akan memicu ribuan pembacaan Firestore, yang berakibat pada pembengkakan biaya dan melambatnya render browser kasir.
* **Solusi Perbaikan**: Menambahkan klausa batasan `limit(150)` pada kueri snapshot pesanan:
  ```javascript
  const q = query(
    collection(db, "pesanan"),
    orderBy("waktu_pesan", "desc"),
    limit(150)
  );
  ```
* **Dampak**: 
  - Membatasi biaya baca Firestore saat halaman POS dibuka maksimal **150 Reads** per perangkat (hemat biaya secara signifikan).
  - Mencegah browser kasir melambat karena hanya memproses maksimal 150 transaksi teranyar dalam memori.

### C. Kueri Laporan Penjualan On-Demand (Date-Range Filtering)
* **Lokasi Berkas**: [laporan.js](file:///d:/belajar%20membuat%20web/tabato-app/public/Firestore/laporan.js)
* **Masalah Sebelumnya**: Statistik laporan dihitung dengan memproses array lokal `allOrders` di browser. Karena `allOrders` sekarang dibatasi maksimal 150 data teratas (efek limitasi di atas), data statistik bulanan atau mingguan menjadi tidak akurat jika jumlah pesanan melampaui limit tersebut.
* **Solusi Perbaikan**: Mengubah `loadLaporan()` menjadi asinkron dan meluncurkan kueri Firestore terfilter tanggal secara langsung sesuai periode yang dipilih kasir (`hari`, `minggu`, atau `bulan`):
  ```javascript
  const q = query(
    collection(db, "pesanan"),
    where("waktu_pesan", ">=", startDate),
    orderBy("waktu_pesan", "desc")
  );
  const snap = await getDocs(q);
  ```
* **Dampak**:
  - Laporan penjualan tetap **100% akurat** dan mencakup seluruh transaksi yang terjadi pada periode tersebut.
  - Browser tidak menampung ribuan array transaksi di memori dari awal startup, melainkan hanya mengambil data yang diperlukan saat tombol laporan diklik.

### D. Agregasi Pendapatan Server-Side (Server-Side Sum Aggregation)
* **Lokasi Berkas**: [dashboard.js](file:///d:/belajar%20membuat%20web/tabato-app/public/Firestore/dashboard.js)
* **Masalah Sebelumnya**: Nilai "Total Pendapatan" sepanjang masa dihitung dengan cara mengiterasi dan menjumlahkan properti `total_harga` dari semua pesanan dalam array `allOrders`. Dengan adanya limitasi 150 pesanan, total omset sepanjang masa akan bernilai salah (hanya menjumlahkan 150 pesanan terakhir).
* **Solusi Perbaikan**: Memodifikasi `renderDashboard()` menjadi fungsi asinkron dan memanfaatkan fitur agregasi server-side modern dari Firebase SDK (`getAggregateFromServer` & `sum`):
  ```javascript
  const qSelesai = query(collection(db, "pesanan"), where("status", "==", "selesai"));
  const snapshot = await getAggregateFromServer(qSelesai, {
    totalRev: sum("total_harga")
  });
  totalRevenue = snapshot.data().totalRev || 0;
  ```
* **Dampak**:
  - Menghitung total omset miliaran rupiah sekalipun dengan **biaya kueri yang sangat murah** (Firestore hanya menghitung agregat di server dan mengembalikan 1 data angka saja, alih-alih mendownload seluruh baris dokumen ke browser).
  - Dasbor POS Admin menjadi instan dan ringan saat pertama kali dimuat.

---

## 2. Perbandingan Performa & Biaya Sebelum vs Sesudah

| Aspek Pengukuran | Sebelum Optimasi | Setelah Optimasi | Hasil Efisiensi |
| :--- | :--- | :--- | :--- |
| ** reads per Customer Load** | 3 `getDoc` + 3 `onSnapshot` (Total **6 Reads**) | 3 `onSnapshot` (Total **3 Reads**) | **Hemat 50% Reads** |
| ** reads per Admin Load** (Misal ada 1.000 pesanan) | 1.000 Reads (Memuat semua riwayat pesanan) | 150 Reads (Dibatasi limit) | **Hemat 85% Reads** |
| **Perhitungan Omset All-time** | Mengunduh ribuan dokumen untuk dijumlahkan lokal | Agregasi server-side (`getAggregateFromServer`) | **Hemat biaya read & hemat RAM browser** |
| **Akurasi Data Laporan** | Hanya akurat jika semua data diunduh (boros) | Akurat secara dinamis berdasarkan kueri tanggal | **Efisien & Akurat** |

Optimasi ini membuat aplikasi Tabato siap menangani ribuan transaksi per hari tanpa khawatir tagihan Firestore melonjak atau browser admin menjadi lemot/hang.
