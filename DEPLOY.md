# Panduan Deploy Tewiwi

Arsitektur produksi:
- **Frontend** → Vercel (React/Vite)
- **Backend** → Railway Service 1 (Node.js/Express)
- **Forecast** → Railway Service 2 (Python/FastAPI)
- **Database** → Supabase (sudah ada)

---

## 1. Deploy Backend (Railway)

### Buat project di Railway
1. Buka [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
2. Pilih repo `Tewiwi-House-Backend`
3. Saat Railway tanya root directory, isi: `backend`

### Set Environment Variables di Railway (backend)
Buka tab **Variables** di service backend, lalu isi:

```
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
TRUST_PROXY=1
DATABASE_URL=postgresql://postgres.gtwdcuuwtnktowzfaczk:...@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres
DATABASE_SSL=require
DB_POOL_MAX=5
AUTO_MIGRATE=true
SEED_BASE_DATA=false
ADMIN_API_KEY=<generate: node -p "require('crypto').randomBytes(32).toString('hex')">
CORS_ORIGIN=https://<nama-frontend>.vercel.app
FORECAST_API_URL=https://<nama-forecast-service>.up.railway.app
PAYMENT_BANK_NAME=Mandiri
PAYMENT_ACCOUNT_NUMBER=1320025937625
PAYMENT_ACCOUNT_NAME=Hanifa Ajeng Supartiwi
ADMIN_WHATSAPP=08131451393
RATE_LIMIT_ORDERS=10
MIN_LEAD_DAYS=2
```

> `CORS_ORIGIN` dan `FORECAST_API_URL` diisi setelah Vercel dan service forecast selesai deploy.

### Dapatkan URL backend
Setelah deploy selesai, Railway memberi URL seperti:
`https://tewiwi-backend-production.up.railway.app`

Simpan URL ini — dibutuhkan di langkah frontend dan forecast.

---

## 2. Deploy Forecast Service (Railway)

### Tambah service baru di project Railway yang sama
1. Di project Railway yang sama → **New Service** → GitHub repo yang sama
2. Root directory: `backend/model`
3. Railway otomatis membaca `railway.toml` dan `nixpacks.toml`

### Set Environment Variables (forecast service)
Tidak ada env variable khusus yang dibutuhkan. Railway otomatis inject `PORT`.

### Dapatkan URL forecast
Setelah deploy, URL seperti:
`https://tewiwi-forecast-production.up.railway.app`

Lalu **update** env variable `FORECAST_API_URL` di service backend dengan URL ini.

---

## 3. Deploy Frontend (Vercel)

### Import project
1. Buka [vercel.com](https://vercel.com) → New Project → Import repo `Tewiwi-House-Backend`
2. **Root Directory**: isi `frontend`
3. Framework preset: **Vite** (otomatis terdeteksi)
4. Build command: `npm run build` (default)
5. Output directory: `dist` (default)

### Set Environment Variables di Vercel
Buka tab **Environment Variables** sebelum deploy:

```
VITE_API_URL=https://<nama-backend>.up.railway.app
```

> Ganti dengan URL backend Railway dari langkah 1.

### Deploy
Klik **Deploy**. Vercel otomatis build dan beri URL seperti:
`https://tewiwi.vercel.app`

Setelah dapat URL Vercel, **update** env variable `CORS_ORIGIN` di Railway backend.

---

## 4. Urutan Deploy yang Benar

```
1. Deploy backend Railway  →  dapat URL backend
2. Deploy forecast Railway →  dapat URL forecast  →  update FORECAST_API_URL di backend
3. Deploy frontend Vercel  →  isi VITE_API_URL dengan URL backend
4. Update CORS_ORIGIN di backend dengan URL Vercel
```

---

## 5. Verifikasi Setelah Deploy

```bash
# Cek backend hidup
curl https://<backend>.up.railway.app/api/health

# Cek forecast service hidup
curl https://<forecast>.up.railway.app/docs

# Cek frontend bisa login admin
# Buka https://<nama>.vercel.app/admin
```

---

## Catatan

- File `backend/.env.example` berisi daftar lengkap semua env variable yang dibutuhkan backend.
- Jangan commit file `.env` ke repo — sudah ada di `.gitignore`.
- `SEED_BASE_DATA=false` di produksi agar data contoh tidak mengisi ulang database asli.
