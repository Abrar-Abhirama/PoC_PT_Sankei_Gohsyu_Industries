# Mock OPC UA Client — PT Sankei Gohsyu Industries

A lightweight, zero-dependency Node.js simulator for the future Industrial PC (IPC) OPC UA Client.

## Architecture

```
[PLC]
  │ (Industrial signals / tags)
  ▼
[OPC UA Server]
  │ (OPC UA Binary Protocol)
  ▼
[Mock OPC UA Client (IPC)] ───► POST /api/v1/machine-results ───► [Node.js Backend] ───► [PostgreSQL]
```

> **PoC Note**:
> This client simulates the IPC layer without requiring a physical PLC or OPC UA server. It formats machine inspection outcomes (`OK` / `NG`) as standard JSON payloads and sends them to the Node.js backend.

---

## Data Model

The Mock OPC UA Client produces payloads adhering to the following schema:

```json
{
  "machineId": "MACHINE-01",
  "status": "OK",
  "timestamp": "2026-09-08T10:30:00.000Z"
}
```

- **`machineId`**: Identifier of the machine or station (default: `MACHINE-01`).
- **`status`**: Inspection result, strictly `"OK"` or `"NG"`.
- **`timestamp`**: ISO-8601 formatted timestamp of the event.

---

## Quick Start

### 1. Send a Single OK Result
```bash
node index.js --ok
```

### 2. Send a Single NG Result
```bash
node index.js --ng
```

### 3. Run Interactive CLI Menu
```bash
node index.js
```

### 4. Run Continuous / Periodic Simulation
Simulates continuous line production with ~85% OK and ~15% NG rate:
```bash
node index.js --periodic --interval 2000
```

---

## Configuration

The Mock OPC UA Client can be configured via environment variables or CLI arguments:

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `BACKEND_URL` | `http://localhost:3000/api/v1` | Full base URL of the backend API |
| `BACKEND_HOST` | `localhost` | Fallback backend host |
| `BACKEND_PORT` | `3000` | Fallback backend port |
| `MACHINE_ID` | `MACHINE-01` | Default station or machine identifier |

### CLI Options

| Option | Alias | Description | Example |
|---|---|---|---|
| `--ok` | `--pass` | Send single OK result and exit | `node index.js --ok` |
| `--ng` | `--fail` | Send single NG result and exit | `node index.js --ng` |
| `--status <OK\|NG>` | | Send specified result | `node index.js --status OK` |
| `--machine <id>` | `--machineId` | Specify machine ID | `node index.js --ok --machine CNC-02` |
| `--url <url>` | | Specify backend API base URL | `node index.js --ok --url http://localhost:3000` |
| `--periodic` | `-p`, `--continuous` | Start continuous inspection loop | `node index.js --periodic` |
| `--interval <ms>` | | Periodic loop interval (default: 2000) | `node index.js -p --interval 1500` |
| `--ratio <percentage>` | | Target OK percentage (default: 85) | `node index.js -p --ratio 95` |
| `--count <n>` | | Stop after sending n results | `node index.js -p --count 10` |
| `--help` | `-h` | Display help screen | `node index.js --help` |

---

## Error Handling

The client handles backend connectivity issues gracefully:
- **Connection Refused (`ECONNREFUSED`)**: Warns that the backend server is not running without throwing an unhandled stack trace.
- **Timeouts**: Destroys stalled requests after 6000ms and logs a warning.
- **In periodic mode**: Logs connection warnings and automatically retries on subsequent cycles without terminating.
