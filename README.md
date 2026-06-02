# Marketing Activity Monitor

Dashboard monitoring Meta Ads dengan AI Agent (BluesMinds gateway).

## Struktur

```
marketing-monitor/
├── .env                          # Secrets (gitignored)
├── package.json                  # Root monorepo
├── packages/
│   ├── backend/                  # Express proxy server (Node.js)
│   │   └── src/
│   │       ├── index.js          # Server entry
│   │       └── routes/
│   │           ├── meta.js       # Meta Graph API proxy
│   │           └── ai.js         # BluesMinds AI proxy
│   └── frontend/                 # Vite vanilla JS app
│       ├── index.html
│       └── src/
│           ├── main.js           # Entry point
│           ├── app.js            # Dashboard logic
│           ├── ai-agent.js       # AI chat panel
│           ├── style.css         # Styles
│           └── lib/
│               ├── api.js        # All API calls (→ backend)
│               ├── config.js     # Constants (no secrets)
│               └── helpers.js    # Pure utility functions
```

## Menjalankan Lokal

### 1. Install dependencies

```bash
npm install
```

### 2. Konfigurasi `.env`

File `.env` sudah ada di root. Sesuaikan nilai jika perlu.

### 3. Jalankan development server

```bash
npm run dev
```

Ini menjalankan backend (port 3001) dan frontend (port 5173) bersamaan.

- Frontend: http://localhost:5173
- Backend:  http://localhost:3001
- Health:   http://localhost:3001/health

## Build untuk Produksi

```bash
npm run build          # Build frontend ke packages/frontend/dist/
npm run start          # Jalankan backend production
```

Untuk produksi, serve `packages/frontend/dist/` dengan static file server (nginx, Vercel, dll) dan jalankan backend di server terpisah. Set `VITE_API_BASE_PROD` ke URL backend produksi.

## Keamanan

- Semua secrets (Meta App Secret, BluesMinds API Key) hanya ada di **backend**
- Frontend tidak punya akses ke secrets — semua panggilan API melalui proxy `/api/*`
- Meta token disimpan di `localStorage` browser (bukan di kode)
- Token di-inspect dan di-extend otomatis via backend endpoint

## Environment Variables

| Variable                    | Lokasi   | Keterangan                         |
|-----------------------------|----------|------------------------------------|
| `META_APP_ID`               | Backend  | Meta App ID                        |
| `META_APP_SECRET`           | Backend  | Meta App Secret                    |
| `BLUESMINDS_API_KEY`        | Backend  | BluesMinds API key                 |
| `BLUESMINDS_BASE`           | Backend  | BluesMinds API base URL            |
| `PORT`                      | Backend  | Port server (default: 3001)        |
| `VITE_META_FALLBACK_TOKEN`  | Frontend | Token default (di `.env` root)     |
| `VITE_API_BASE_PROD`        | Frontend | Backend URL untuk production build |
