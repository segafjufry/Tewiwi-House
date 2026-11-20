# 🥐 Téwiwi House (Téwiwi Bakehouse) — Integrated Digital Ecosystem

Ekosistem aplikasi web terintegrasi untuk operasional, pemesanan, manajemen produksi, dan layanan pelanggan berbasis AI pada **Téwiwi Bakehouse**. Proyek ini menyatukan aplikasi utama, layanan *backend* API, serta asisten virtual berbasis *Retrieval-Augmented Generation* (RAG) dalam satu arsitektur modern.

---

## 🌐 Tautan Ekosistem & Deployment

| Komponen | Deskripsi | URL / Repositori |
| :--- | :--- | :--- |
| **Main Repository** | Kode sumber utama ekosistem aplikasi Téwiwi House | [GitHub — segafjufry/Tewiwi-House](https://github.com/segafjufry/Tewiwi-House) |
| **Backend & Core App** | Layanan API *backend* dan antarmuka aplikasi inti | [tewiwi-house-backend.vercel.app](https://tewiwi-house-backend.vercel.app/) |
| **AI Customer Chatbot** | Asisten informasi produk berbasis dokumen referensi (RAG) | [chatbottewiwi.vercel.app](https://chatbottewiwi.vercel.app/) |

---

## ✨ Fitur Utama

### 1. Aplikasi Inti & Backend (Téwiwi House)

* **Manajemen Produk & Katalog:** Pengelolaan daftar produk bakery/pastry, harga, deskripsi, dan ketersediaan stok.
* **Operasional & Pemesanan:** Alur pencatatan pesanan pelanggan, manajemen transaksi, dan pemantauan status pesanan.
* **Prediksi Kebutuhan Produksi:** Model XGBoost untuk forecast permintaan per SKU dengan backtest dan live forecast dari layanan Python.
* **RESTful API Terintegrasi:** Menyediakan *endpoint* terstruktur untuk komunikasi data antara antarmuka pengguna dan layanan pendukung.

### 2. Chatbot Informasi Produk (Chatbot Téwiwi Bakehouse)

* **Tanya Jawab Berbasis Dokumen (RAG):** Menjawab pertanyaan pelanggan secara akurat berdasarkan dokumen referensi aktif milik Téwiwi Bakehouse (katalog menu, komposisi bahan, informasi alergen, cara pemesanan, dll.).
* **Antarmuka Interaktif & Responsif:** Desain antarmuka *chat* yang ringan, ramah pengguna, dan optimal diakses baik melalui perangkat seluler maupun desktop.
* **Konteks Terkendali:** Memastikan jawaban tetap relevan dan mengacu pada basis pengetahuan resmi toko.

---

## 🏗️ Arsitektur & Tech Stack

| Komponen | Teknologi | Platform |
| :--- | :--- | :--- |
| **Frontend** | React 19, Vite 8, MUI 7, React Router 7 | Vercel |
| **Backend API** | Node.js 20+, Express 5, PostgreSQL, JWT | Railway |
| **Forecast Service** | Python 3.11, FastAPI, XGBoost, scikit-learn, pandas | Railway |
| **Database** | PostgreSQL (Supabase + RLS) | Supabase |
| **AI / RAG** | LLM dengan arsitektur Retrieval-Augmented Generation | Vercel |

---

## 🚀 Panduan Instalasi Lokal

Ikuti langkah berikut untuk menjalankan repositori utama di lingkungan lokal:

1. **Clone repositori:**
   ```bash
   git clone https://github.com/segafjufry/Tewiwi-House.git
   cd Tewiwi-House
   ```

2. **Instal dependensi backend:**
   ```bash
   cd backend
   npm install
   ```

3. **Konfigurasi Environment Variables:**

   Salin file contoh konfigurasi dan sesuaikan kredensial yang dibutuhkan:
   ```bash
   cp backend/.env.example backend/.env
   ```
   ```env
   PORT=3000
   DATABASE_URL=postgresql://user:password@host:5432/postgres
   ADMIN_API_KEY=your-secret-key
   CORS_ORIGIN=http://localhost:5173
   FORECAST_API_URL=http://127.0.0.1:8000
   ```

4. **Jalankan backend:**
   ```bash
   cd backend
   npm run dev   # API jalan di http://localhost:3000
   ```

5. **Jalankan frontend:**
   ```bash
   cd frontend
   npm install
   npm run dev   # Vite dev server di http://localhost:5173
   ```

6. **Jalankan forecast service (opsional):**
   ```bash
   cd backend/model
   pip install -r requirements.txt
   uvicorn forecast_api:app --host 127.0.0.1 --port 8000
   ```

---

## 📂 Struktur Proyek

```text
Tewiwi-House/
├── backend/              # REST API (Node.js + Express + PostgreSQL)
│   ├── src/              # Source code (routes, services, middleware)
│   ├── migrations/       # SQL migrations
│   ├── model/            # Python forecast service (FastAPI + XGBoost)
│   ├── .env.example      # Template variabel lingkungan
│   └── railway.toml      # Railway deployment config
├── frontend/             # Web app (React + Vite + MUI)
│   ├── src/              # Source code (pages, components, services)
│   └── vercel.json       # Vercel deployment config
├── DEPLOY.md             # Panduan deployment lengkap
└── README.md             # Dokumentasi proyek
```

---

## 🤝 Kontribusi

Kontribusi, laporan *bug*, dan saran pengembangan sangat terbuka:

1. *Fork* repositori ini.
2. Buat *branch* fitur baru (`git checkout -b fitur/nama-fitur`).
3. *Commit* perubahan Anda (`git commit -m 'Menambahkan fitur baru'`).
4. *Push* ke *branch* tersebut (`git push origin fitur/nama-fitur`).
5. Buat *Pull Request*.
