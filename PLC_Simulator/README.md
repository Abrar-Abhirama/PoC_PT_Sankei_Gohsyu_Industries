# PLC Simulator (Keyence KV-8000 & SR-1000 Emulator)

This Python service acts as an OPC UA Server emulating the physical **Keyence KV-8000 PLC** and **Keyence SR-1000** barcode/QR scanner reader for the PoC QR Traceability System.

---

## 1. Simulated Architecture

```text
[ PostgreSQL ]
      ↕ REST API
[ Node.js Backend ]
      ↕ REST API
[ C# IPC Gateway ]
      ↕ OPC UA (opc.tcp://127.0.0.1:4840/freeopcua/server/)
[ Python PLC Simulator ]
```

---

## 2. OPC UA Node Specification

| Node Variable | NodeID | Direction | Data Type | Description |
|---|---|---|---|---|
| `QR_Data` | `ns=2;i=2` | IPC $\rightarrow$ PLC | String | Receives the barcode string to mark |
| `Verification_Status` | `ns=2;i=3` | PLC $\rightarrow$ IPC | String | Returns `IDLE`, `PROCESSING`, `OK`, or `NG` |

---

## 3. How to Run the Simulator

### Option A: Using the Batch Script
Double-click or execute in PowerShell:
```powershell
.\PoC\run_simulator.bat
```

### Option B: Using Python directly
```powershell
& "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe" -u PoC/plc_simulator.py
```

---

## 4. Replacing Simulator with the Physical PLC (Migration Checklist)

When the physical Keyence KV-8000 PLC hardware arrives:

1. **Network**: Connect the KV-8000 (Ethernet port / KV-XLE02 unit) to the local Industrial PC network.
2. **OPC UA Server**: Enable and configure the built-in OPC UA Server on KV-8000 (port 4840).
3. **Variable Mapping**:
   - Create a string tag for incoming barcode (e.g. `DM1000` / `QR_Data`) and expose it to OPC UA.
   - Create a string tag for verification result (e.g. `DM1050` / `Verification_Status`) and expose it to OPC UA.
4. **C# IPC Configuration**:
   Update environment variables or `Program.cs` default values:
   - `PLC_OPC_ENDPOINT`: Change from `opc.tcp://127.0.0.1:4840/...` to `opc.tcp://<KV8000_IP>:4840/...`
   - `QR_NODE_ID`: Change to KV-8000 node ID (if different from `ns=2;i=2`)
   - `STATUS_NODE_ID`: Change to KV-8000 node ID (if different from `ns=2;i=3`)
5. No backend or database code changes are needed!