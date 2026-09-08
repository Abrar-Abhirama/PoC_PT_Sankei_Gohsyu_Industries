# PoC — Machine OK/NG Traceability System
### PT Sankei Gohsyu Industries

A local, on-premise industrial machine inspection traceability system PoC for monitoring machine OK/NG results.

---

## Target Architecture

```
PLC
  ↓
OPC UA Server
  ↓
OPC UA Client (simulated by mock-ipc)
  ↓
Node.js Backend
  ↓
PostgreSQL
  ↓
React Dashboard
```

> **Catatan Arsitektur:** PLC tidak berkomunikasi langsung dengan Node.js Backend. OPC UA Client bertugas membaca nilai dari PLC/OPC UA Server dan mengonversinya menjadi HTTP REST request JSON sederhana (`{ machineId, status: "OK" | "NG", timestamp }`) ke Backend. Komunikasi OPC UA dan PLC fisik belum diimplementasikan pada tahap PoC ini.

---

## Tech Stack

| Layer | Technology | Port |
|---|---|---|
| **Frontend** | React 18 + TypeScript (Vite) | `5173` |
| **Backend** | Node.js + TypeScript + Express.js | `3000` |
| **Database** | PostgreSQL 16 | `5432` |
| **Simulator** | Node.js Mock OPC UA Client | - |
| **Containers** | Docker + Docker Compose | - |

---

## Project Structure

```
.
├── frontend/          # React + TypeScript (Vite) dashboard
│   └── src/
│       ├── components/
│       │   ├── KpiCards.tsx            # KPI Cards (Total, OK, NG, Yield, Station)
│       │   └── RecentResultsTable.tsx  # Live stream of machine inspection results
│       ├── App.tsx                     # Main dashboard layout with auto-sync
│       ├── types.ts                    # MachineResult & MachineResultStats types
│       └── main.tsx
├── backend/           # Node.js + TypeScript + Express API
│   └── src/
│       ├── config/                     # Database pool & migration runner
│       ├── routes/
│       │   ├── health.ts               # Health check endpoint
│       │   └── machineResults.ts       # POST/GET machine results & summary
│       ├── types/
│       │   └── machineResult.ts        # Domain model interfaces
│       ├── app.ts                      # Express app configuration
│       └── index.ts                    # Server entry point
├── database/
│   └── init/
│       └── 01_schema.sql               # Database schema (machine_results)
├── mock-ipc/
│   └── index.js                        # OPC UA Client simulator (CLI / interactive)
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (with Docker Compose)
- Node.js (v18+)

### 1. Build and Start All Services

```bash
docker compose up --build -d
```

Check status:
```bash
docker compose ps
```

| Service | URL |
|---|---|
| **React Dashboard** | http://localhost:5173 |
| **Backend API** | http://localhost:3000/api/v1 |
| **Health Check** | http://localhost:3000/api/v1/health |
| **PostgreSQL** | `localhost:5432` (db: `sankei_db`, user: `sankei_user`) |

---

## 🤖 Mock OPC UA Client Simulator

Komponen simulator ini mensimulasikan **OPC UA Client** yang berjalan di Industrial PC, mengirimkan hasil inspeksi mesin (**OK** / **NG**) ke Backend tanpa memerlukan PLC fisik:

```bash
# 1. Kirim hasil inspeksi OK:
node mock-opc-client/index.js --ok

# 2. Kirim hasil inspeksi NG (Defect):
node mock-opc-client/index.js --ng

# 3. Jalankan loop periodik otomatis (default interval: 2000ms, Ctrl+C untuk berhenti):
node mock-opc-client/index.js --periodic

# 4. Tentukan target mesin (default: MACHINE-01):
node mock-opc-client/index.js --ok --machine LINE-02

# 5. Tentukan target backend URL melalui environment variable:
BACKEND_URL=http://localhost:3000/api/v1 node mock-opc-client/index.js --ok

# 6. Buka menu interaktif di terminal:
node mock-opc-client/index.js
```

---

## REST API Specification

Base URL: `http://localhost:3000/api/v1`

### 1. Ingest Machine Result
- **Method:** `POST`
- **Path:** `/api/v1/machine-results`
- **Request Body:**
  ```json
  {
    "machineId": "MACHINE-01",
    "status": "OK",
    "timestamp": "2026-09-08T10:30:00Z"
  }
  ```
  *(Status wajib bernilai `"OK"` atau `"NG"`. `timestamp` opsional, default ke waktu server saat ini)*
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "data": {
      "id": 1,
      "machineId": "MACHINE-01",
      "status": "OK",
      "timestamp": "2026-09-08T10:30:00.000Z",
      "createdAt": "2026-09-08T10:30:01.234Z"
    }
  }
  ```

### 2. Get Recent Machine Results
- **Method:** `GET`
- **Path:** `/api/v1/machine-results?limit=50&machineId=MACHINE-01`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 1,
        "machineId": "MACHINE-01",
        "status": "OK",
        "timestamp": "2026-09-08T10:30:00.000Z",
        "createdAt": "2026-09-08T10:30:01.234Z"
      }
    ],
    "total": 1
  }
  ```

### 3. Get Latest Machine Result
- **Method:** `GET`
- **Path:** `/api/v1/machine-results/latest?machineId=MACHINE-01`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "id": 1,
      "machineId": "MACHINE-01",
      "status": "OK",
      "timestamp": "2026-09-08T10:30:00.000Z",
      "createdAt": "2026-09-08T10:30:01.234Z"
    }
  }
  ```

### 4. Get Machine Results Summary (Stats)
- **Method:** `GET`
- **Path:** `/api/v1/machine-results/summary`
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "total": 100,
      "okCount": 88,
      "ngCount": 12,
      "yieldRate": 88.0,
      "latestResult": { ... }
    }
  }
  ```

### 5. System Health Check
- **Method:** `GET`
- **Path:** `/api/v1/health`
- **Response (200 OK):**
  ```json
  {
    "status": "ok",
    "timestamp": "2026-09-08T10:30:00.000Z",
    "database": "connected"
  }
  ```

---

## Database

PostgreSQL berjalan di port **5432** (service `postgres`).

### Tabel Tunggal: `machine_results`

```sql
CREATE TABLE machine_results (
    id         SERIAL PRIMARY KEY,
    machine_id VARCHAR(50) NOT NULL,
    status     VARCHAR(10) NOT NULL CHECK (status IN ('OK', 'NG')),
    timestamp  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_machine_results_machine_id ON machine_results(machine_id);
CREATE INDEX idx_machine_results_status     ON machine_results(status);
CREATE INDEX idx_machine_results_timestamp  ON machine_results(timestamp DESC);
```
