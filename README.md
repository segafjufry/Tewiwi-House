# Tewiwi House

Aplikasi pemesanan roti artisan dengan fitur prediksi kebutuhan produksi berbasis XGBoost.

🌐 **Live**: [tewiwi-house-backend.vercel.app](https://tewiwi-house-backend.vercel.app)

---

## Arsitektur

| Komponen | Teknologi | Platform |
|---|---|---|
| Frontend | React + Vite + MUI | Vercel |
| Backend API | Node.js + Express | Railway |
| Forecast Service | Python + FastAPI + XGBoost | Railway |
| Database | PostgreSQL | Supabase |

## Struktur Repo

```
tewiwi/
├── backend/          # REST API (Node.js + Express + PostgreSQL)
│   ├── src/          # Source code (routes, services, middleware)
│   ├── migrations/   # SQL migrations
│   ├── model/        # Python forecast service (FastAPI + XGBoost)
│   └── railway.toml  # Railway deployment config
├── frontend/         # Web app (React + Vite + MUI)
│   └── vercel.json   # Vercel deployment config
├── DEPLOY.md         # Panduan deployment lengkap
└── .gitignore
```

## Fitur

**Customer**
- Pesan roti dengan pilih tanggal pengiriman (Selasa / Jumat)
- Lacak status pesanan dengan kode unik
- Konfirmasi pembayaran via WhatsApp

**Admin**
- Dashboard manajemen pesanan, produk, dan kapasitas slot
- Production brief otomatis per tanggal pengiriman
- Statistik model prediksi demand (XGBoost + SARIMA backtest)
- Forecast live per tanggal dari layanan Python

## Menjalankan Lokal

### Backend
```bash
cd backend
cp .env.example .env   # isi nilai yang diperlukan
npm install
npm run dev            # API jalan di http://localhost:3000
```

### Frontend
```bash
cd frontend
cp .env.example .env   # isi VITE_API_URL=http://localhost:3000
npm install
npm run dev            # Vite dev server di http://localhost:5173
```

### Forecast Service (opsional)
```bash
cd backend/model
pip install -r requirements.txt
uvicorn forecast_api:app --host 127.0.0.1 --port 8000
```

## Deploy

Lihat [DEPLOY.md](./DEPLOY.md) untuk panduan lengkap deploy ke Vercel + Railway.

## Tech Stack

- **Backend**: Node.js 20+, Express 5, PostgreSQL, JWT, bcryptjs
- **Frontend**: React 19, Vite 8, MUI 7, React Router 7
- **Forecast**: Python 3.11, FastAPI, XGBoost, scikit-learn, pandas
- **Database**: Supabase (PostgreSQL + RLS)
- **Deployment**: Vercel (frontend), Railway (backend + forecast)
