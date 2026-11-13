# KonterPOS - Point of Sale & Manajemen Usaha Toko Handphone

Aplikasi Web POS & Manajemen Toko Handphone modern berbasis **React + TypeScript + Vite + Tailwind CSS** dengan sinkronisasi Cloud Firestore dan dukungan pencetakan struk thermal 58mm/80mm.

---

## 🚀 Panduan Mengatasi Halaman Blank di GitHub Pages

Jika saat membuka di GitHub Pages halaman aplikasi tampak putih / kosong (*blank*), hal ini umumnya disebabkan oleh salah satu dari 2 hal:
1. **GitHub Pages dikonfigurasi men-deploy source code mentah (`main / (root)`)**, padahal browser tidak bisa membaca file TypeScript mentah (`.tsx`).
2. **Missing Trailing Slash** pada URL repository (`https://username.github.io/repo-name` tanpa tanda garis miring `/` di ujungnya).

Repository ini sudah dilengkapi dengan **GitHub Actions Workflow Otomatis** (`.github/workflows/deploy.yml`) dan script penyesuaian path otomatis.

### Cara Mengaktifkan GitHub Pages yang Benar:

1. Buka repository Anda di GitHub.
2. Klik tab **Settings** (Pengaturan).
3. Di bilah menu kiri, pilih **Pages**.
4. Pada bagian **Build and deployment**:
   - Di menu pilihan **Source**, ubah dari *"Deploy from a branch"* menjadi **`GitHub Actions`**.
5. Simpan pengaturan.
6. Masuk ke tab **Actions** di repository Anda. Workflow **"Deploy to GitHub Pages"** akan otomatis berjalan, meng-compile kode Vite menjadi bundle produksi (`dist/`), dan menerbitkannya ke URL GitHub Pages Anda.
7. Buka link GitHub Pages yang disediakan (contoh: `https://username.github.io/nama-repo/`). Aplikasi akan langsung terbuka normal!

---

## 🛠️ Menjalankan di Lokal (Development)

```bash
# 1. Install dependensi
npm install

# 2. Jalankan server development (Port 3000)
npm run dev

# 3. Build bundle produksi
npm run build
```

---

## 🔐 Kredensial Login Default Terminal Kasir

- **Username**: `owner` atau `kasir1`
- **PIN/Password**: `123456`
