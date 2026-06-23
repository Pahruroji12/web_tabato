# Perbaikan Desain Database: Refactoring Riwayat Stok (stokHistory)

Dokumen ini menjelaskan detail perbaikan desain database pada penyimpanan riwayat perubahan stok (stock history logs) di Cloud Firestore untuk aplikasi POS & Online Order Tabato.

## Masalah Sebelumnya (Bottleneck Skalabilitas)

Sebelumnya, riwayat stok disimpan sebagai array objek di dalam sebuah dokumen tunggal:
`config/stokHistory` -> `{ items: [...] }`

Setiap kali terjadi perubahan stok (pengurangan saat pesanan dibuat, pengembalian saat pesanan dibatalkan, atau penyetelan stok manual), aplikasi akan:
1. Membaca seluruh array log lama dari dokumen `config/stokHistory`.
2. Menyisipkan entri log baru ke awal array di memori.
3. Membatasi ukuran array maksimal 200 elemen di client-side.
4. Menulis kembali seluruh dokumen tersebut ke Firestore.

### Risiko Utama:
* **Firestore Document Size Limit**: Batas ukuran maksimal dokumen Firestore adalah **1MB**. Menyimpan array logs terus-menerus akan menyebabkan ukuran dokumen bertambah hingga melebihi batas ini dan menyebabkan aplikasi mengalami *crash* saat beroperasi di masa mendatang.
* **Biaya Firestore Read/Write**: Setiap kali transaksi stok terjadi, aplikasi dipaksa melakukan pembacaan dokumen `stokHistory` lama sebelum menulis data baru. Ini meningkatkan latensi dan kuota Firestore Reads/Writes secara tidak efisien.

---

## Solusi Desain Baru (Koleksi Dokumen Terpisah)

Kami merancang ulang penyimpanan riwayat stok ke koleksi dokumen terpisah bernama **`stokHistory`**, di mana setiap log disimpan secara individual (`stokHistory/{docId}`).

### Keunggulan Desain Baru:
1. **Skalabilitas Tanpa Batas**: Setiap log disimpan dalam dokumen tersendiri, sehingga batas dokumen 1MB tidak akan pernah tercapai.
2. **Pengurangan Operasi Baca (Reads)**: Pada saat transaksi stok (`setStok`, `deductStockForOrder`, `restoreStockForOrder`), aplikasi **tidak perlu lagi membaca dokumen riwayat lama**. Cukup buat referensi acak dengan `doc(collection(db, "stokHistory"))` dan lakukan operasi `set` langsung di dalam transaksi.
3. **Pemuatan Cepat & Hemat Memori**: Pada saat inisialisasi aplikasi, data dimuat secara terurut dan dibatasi maksimal 100 log terbaru saja (`orderBy("waktu", "desc")` dan `limit(100)`).
4. **Audit Log Imutabel**: Melalui aturan keamanan `firestore.rules`, koleksi `stokHistory` ini dilindungi dengan ketat agar bersifat imutabel:
   * Hanya membolehkan `read` dan `create` bagi kasir/admin yang sah (`request.auth != null`).
   * Memblokir semua operasi `update` dan `delete` (`allow update, delete: if false`).

---

## Mekanisme Migrasi Otomatis (Graceful Migration)

Untuk menjamin transisi yang lancar dan mencegah hilangnya riwayat stok lama milik merchant, kami menyisipkan logika migrasi otomatis dalam modul startup (`initAdminState`):
* Jika kueri ke koleksi `stokHistory` yang baru menghasilkan data kosong (menandakan aplikasi baru saja dideploy/dimigrasikan), sistem secara otomatis membaca dokumen lama `config/stokHistory`.
* Log lama tersebut akan di-push ke tampilan tabel riwayat di UI agar langsung dapat dilihat oleh kasir.
* Sistem kemudian secara asinkron (tanpa memblokir UI) memindahkan log lama tersebut satu per satu ke koleksi `stokHistory` yang baru.

---

## Berkas yang Diperbarui

1. **[state.js](file:///d:/belajar%20membuat%20web/tabato-app/public/admin/state.js)**:
   * Menambahkan impor kueri Firestore: `query`, `orderBy`, `limit`, `getDocs`.
   * Refactor `initAdminState()` untuk memuat data dari koleksi dengan batas limit 100, lengkap dengan fallback & auto-migration.
   * Refactor transaksi stok `setStok`, `deductStockForOrder`, dan `restoreStockForOrder` agar membuat dokumen individual pada koleksi `stokHistory`.
   * Mendepresiasi fungsi lama `syncStokHistoryToFirestore()`.
2. **[stok.js](file:///d:/belajar%20membuat%20web/tabato-app/public/Firestore/stok.js)**:
   * Mengubah `saveStok` menjadi fungsi `async` yang menggunakan `await setStok(...)` agar UI terupdate tepat waktu setelah data berhasil disimpan ke cloud database.
3. **[firestore.rules](file:///d:/belajar%20membuat%20web/tabato-app/firestore.rules)**:
   * Mengamankan jalur koleksi `/stokHistory/{docId}` dengan izin `read, create` saja dan menolak `update, delete`.
