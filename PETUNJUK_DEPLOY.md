# Sahabat Petani Kerinci V3.6 — Panduan 28 Bab + Dashboard Admin

## Isi pembaruan
- Panduan umum diperluas menjadi 28 bab dan lampiran catatan.
- Dashboard admin: login, input riwayat harga, kelola data cabai/kentang, kelola berita, dan grafik riwayat harga.
- Website publik membaca harga, berita, dan statistik melalui API Cloudflare Pages Functions.
- Riwayat harga disimpan sebagai catatan baru agar grafik tidak kehilangan data lama. Harga tidak diisi otomatis atau dikarang.

## PENTING: konfigurasi Cloudflare wajib dilakukan satu kali
ZIP ini bukan sekadar situs statis. Fitur admin bersama membutuhkan Cloudflare Pages Functions + D1. Tanpa konfigurasi ini, halaman publik tetap dapat dibuka, tetapi dashboard akan menampilkan pesan database belum terhubung.

1. Buat database D1 di Cloudflare Dashboard, misalnya `sahabat-petani-kerinci-db`.
2. Buka D1 Console database tersebut, jalankan seluruh isi file `schema.sql`.
3. Buka Pages project Sahabat Petani Kerinci → Settings → Functions → D1 database bindings. Tambahkan binding dengan Variable name `DB`, pilih database D1 yang dibuat.
4. Jika menggunakan `wrangler.toml`, ganti `GANTI_DENGAN_DATABASE_ID_D1` dengan database ID yang benar. Jangan menebak ID. Pastikan binding `DB` tetap sama.
5. Pada Pages project → Settings → Variables and Secrets, tambahkan secrets: `ADMIN_PASSWORD` (kata sandi admin yang kuat) dan `SESSION_SECRET` (nilai acak panjang minimal 32 karakter). Jangan menaruh secret di file HTML/JS atau membagikannya.
6. Deploy ZIP/isi folder ini sebagai project Pages yang mendukung Functions. Pastikan folder `functions/api/[[path]].js` ikut ter-deploy.
7. Deploy melalui Git integration Cloudflare Pages atau Wrangler CLI agar folder `functions/` ikut diproses. Untuk Wrangler, dari folder project jalankan `npx wrangler pages deploy . --project-name NAMA_PROJECT` setelah konfigurasi binding siap. Dashboard drag-and-drop statis belum tentu mengikutsertakan Pages Functions.
8. Pasang secret melalui Cloudflare Pages Settings → Variables and Secrets, atau gunakan `npx wrangler pages secret put ADMIN_PASSWORD --project-name NAMA_PROJECT` dan perintah yang sama untuk `SESSION_SECRET`.
9. Buka `/admin.html`, masuk menggunakan `ADMIN_PASSWORD`, lalu uji input harga dengan data nyata dan sumber yang jelas.

## Cara kerja dan batasan
- Harga publik adalah harga yang dimasukkan admin, bukan feed harga otomatis. Setiap catatan wajib memiliki komoditas, harga, satuan, tanggal, wilayah, dan sumber.
- Grafik hanya menggambarkan riwayat yang tersimpan. Jika data masih sedikit, grafik belum dapat menunjukkan tren yang kuat.
- Pengelolaan komoditas saat ini menyimpan deskripsi/varietas/status. Berita dapat disimpan sebagai draft atau diterbitkan.
- Admin menggunakan cookie sesi HttpOnly, Secure, SameSite Strict dengan masa berlaku 8 jam. Gunakan kata sandi kuat dan jangan gunakan jaringan/perangkat umum untuk login.
- Fitur ini belum memiliki multi-user/role, reset password, upload gambar berita, atau impor otomatis dari sumber harga.

## Uji setelah deploy
- `https://DOMAIN/admin.html` menampilkan form login.
- Setelah login, tambahkan satu catatan harga uji yang benar-benar bersumber.
- Pastikan harga muncul di halaman utama dan riwayat muncul di grafik.
- Terbitkan satu berita, lalu pastikan tampil di bagian Berita.
- Coba keluar dan masuk kembali.

Jangan memasukkan data harga perkiraan seolah-olah data pasar resmi. Cantumkan sumber dan tanggal pengamatan secara jujur.
