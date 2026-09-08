# PoC — Local QR Traceability System
### PT Sankei Gohsyu Industries

A local, on-premise QR traceability system PoC for monitoring the production and inspection process of manufactured products.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript (Vite) |
| Backend | Node.js + TypeScript + Express.js |
| Database | PostgreSQL 16 |
| Containerization | Docker + Docker Compose |

---

## Project Structure

```
.
├── frontend/          # React + TypeScript (Vite) — port 5173
├── backend/           # Node.js + TypeScript + Express — port 3000
├── database/
│   └── init/          # SQL init scripts (run once on first start)
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)
- Git

### 1. Clone the repository

```bash
git clone <repository-url>
cd PoC_PT_Sankei_Gohsyu_Industries
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` if you need to change default ports or credentials. The defaults work out of the box.

### 3. Build and start all services

```bash
docker-compose up --build
```

This command will:
1. Build the frontend and backend Docker images
2. Start PostgreSQL and wait for it to be healthy
3. Start the backend (connects to PostgreSQL)
4. Start the frontend (connects to the backend)

### 4. Access the application

| Service | URL |
|---|---|
| **Frontend** | http://localhost:5173 |
| **Backend API** | http://localhost:3000 |
| **Health Check** | http://localhost:3000/health |
| **PostgreSQL** | `localhost:5432` (use a DB client) |

---

## Commands Reference

### 1. 🐳 Docker Commands (Full Stack — Recommended)

Run all services together using Docker Compose:

```bash
# Build images and start all containers (first time / after dependency updates)
docker compose up --build

# Start all containers in background (detached mode)
docker compose up -d

# Check status of running containers
docker compose ps

# View logs (real-time streaming):
docker compose logs -f             # All services
docker compose logs -f frontend    # Frontend only
docker compose logs -f backend     # Backend only
docker compose logs -f postgres    # PostgreSQL only

# Restart a specific service:
docker compose restart frontend
docker compose restart backend
docker compose restart postgres

# Stop all containers (preserves database volume)
docker compose down

# Stop all containers AND wipe database volume (clean reset)
docker compose down -v

# Rebuild images without starting
docker compose build

# Start a specific service only:
docker compose up postgres
docker compose up backend
docker compose up frontend
```

---

### 2. ⚛️ Frontend Commands (Standalone / Local Node.js)

Run frontend directly on host machine without Docker:

```bash
cd frontend

# Install dependencies
npm install

# Start Vite dev server with hot reload (http://localhost:5173)
npm run dev

# Check TypeScript types without building
npm run typecheck

# Build for production
npm run build

# Preview production build locally
npm run preview
```

---

### 3. 🟢 Backend Commands (Standalone / Local Node.js)

Run backend directly on host machine (*requires PostgreSQL running on localhost:5432*):

```bash
cd backend

# Install dependencies
npm install

# Start dev server with hot reload via ts-node-dev (http://localhost:3000)
npm run dev

# Check TypeScript types without building
npm run typecheck

# Compile TypeScript to dist/ (JavaScript)
npm run build

# Run compiled production build
npm start
```

---

### 4. 🐘 Database Commands (PostgreSQL Access)

```bash
# Access psql shell inside the running Docker container:
docker exec -it sankei_postgres psql -U sankei_user -d sankei_db

# Or connect from host machine (if psql is installed locally):
psql -h localhost -p 5432 -U sankei_user -d sankei_db

# Quick query test from terminal:
docker exec -it sankei_postgres psql -U sankei_user -d sankei_db -c "\dt"
```

---

### 5. 🤖 Mock IPC Commands (Simulasi Hardware & PLC)

Digunakan untuk development dan testing tanpa membutuhkan PLC KV-8000 atau hardware Keyence fisik:

```bash
# Buka Menu Interaktif (Interactive CLI):
node mock-ipc/index.js

# Jalankan 1 siklus produksi lengkap (PASS):
node mock-ipc/index.js --cycle

# Simulasi kegagalan pembacaan QR Code (QR Read FAIL):
node mock-ipc/index.js --fail-qr

# Simulasi kegagalan inspeksi visual (Vision FAIL):
node mock-ipc/index.js --fail-vision

# Simulasi alarm / emergency stop mesin:
node mock-ipc/index.js --error

# Reset status mesin kembali ke RUNNING:
node mock-ipc/index.js --status RUNNING

# Jalankan simulasi kontinu berulang tiap 2.5 detik (Ctrl+C untuk berhenti):
node mock-ipc/index.js --continuous

# Jalankan dari folder backend via npm:
cd backend
npm run mock:ipc             # Menu interaktif
npm run mock:ipc:cycle       # 1 siklus normal
npm run mock:ipc:continuous  # Loop kontinu
```

---

## API

Base URL: `http://localhost:3000/api/v1`

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Health check — confirms API and DB connectivity |
| `/production-orders` | GET / POST | List and create production orders |
| `/production-orders/:id` | GET | Retrieve specific production order by ID |
| `/production/start` | POST | Start an active production run |
| `/production/stop` | POST | Stop/complete the running production order |
| `/production/current` | GET | Get the currently active production order and live metrics |
| `/products` | GET / POST | Register products and query serial numbers |
| `/products/:serialNumber` | GET | Product details by unique QR serial number |
| `/ipc/status` | POST | IPC machine heartbeat and status updates |
| `/ipc/events` | POST | Forward machine events (PRODUCT_DETECTED, PRINT_STARTED, etc.) |
| `/ipc/next-product` | GET | Retrieve next product to be marked |
| `/ipc/inspection-result` | POST | Ingest inspection results (QR_READ, VISION) from Keyence devices |

---

## 🤖 Mock IPC Simulator (Panduan Lengkap)

Simulator Mock IPC (`mock-ipc/index.js`) bertindak sebagai **C# IPC Service** yang mengirimkan event REST/JSON ke backend sesuai kontrak API yang sesungguhnya.

### Skenario yang Didukung

| Parameter CLI | Deskripsi Skenario | Hasil Produk |
|---|---|---|
| *(tanpa parameter)* | Menampilkan menu interaktif bernomor di terminal | Sesuai pilihan |
| `--cycle` / `--pass` | `PRODUCT_DETECTED` ➔ `PRINT_STARTED` ➔ `PRINT_COMPLETED` ➔ `QR_READ` (PASS) ➔ `VISION_PASS` | **PASS** |
| `--fail-qr` | Simulasi barcode buram / tidak terbaca oleh SR-1000 (`QR_READ_FAILED`) | **FAIL** |
| `--fail-vision` | QR terbaca sukses, tetapi kamera IV3 mendeteksi goresan cacat (`VISION_FAIL`) | **FAIL** |
| `--error` | Simulasi interlock keselamatan terbuka / alarm mesin (`MACHINE_ERROR`) | Mesin ➔ **ERROR** |
| `--status <STATUS>` | Update status mesin (`RUNNING`, `STOPPED`, `ERROR`, `UNKNOWN`) | Update tabel `machines` |
| `--continuous`, `-c` | Loop otomatis memproduksi barang terus-menerus (88% PASS, 6% QR Fail, 6% Vision Fail) | Streaming real-time |
| `--interval <ms>` | Mengatur jeda waktu antar produk pada mode continuous (default: `2500` ms) | - |
| `--machine <ID>` | Menentukan mesin target (default: `LINE-01`) | - |
| `--event <TYPE>` | Mengirim single event langsung (misal: `PRODUCT_COMPLETED`, `EMERGENCY_STOP`) | - |

> 💡 **Fitur Cerdas**: Jika simulator dijalankan saat tidak ada production order yang berstatus `RUNNING`, simulator akan **otomatis membuat dan menjalankan order sementara** (`PO-MOCK-XXXXXX`) sehingga proses pengujian dapat berjalan tanpa setup manual!

---

## Database

PostgreSQL runs on port **5432** with the following defaults (from `.env.example`):

| Setting | Value |
|---|---|
| Database | `sankei_db` |
| User | `sankei_user` |
| Password | `sankei_password` |

Data is persisted in a Docker named volume (`sankei_postgres_data`). It survives container restarts but is removed with `docker-compose down -v`.

### Schema

The initial schema creates the following tables:

- `production_orders`
- `products`
- `machine_events`
- `inspections`
- `machines`

---

## Environment Variables

See [`.env.example`](.env.example) for all available configuration options.

