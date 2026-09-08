"""
=============================================================================
  PLC & SR-1000 SCANNER SIMULATOR (Keyence KV-8000 Emulator)
  PoC - PT Sankei Gohsyu Industries
=============================================================================

PURPOSE:
  Temporarily emulates the physical Keyence KV-8000 PLC and SR-1000 QR Code
  reader until real hardware is installed and networked.

HARDWARE MAPPING FOR REAL PLC REPLACEMENT:
  When migrating to the physical KV-8000 PLC:
  1. Set up OPC UA Server on KV-8000 (or KV-XLE02 Ethernet unit).
  2. Point IPC Gateway to the real PLC IP:
     PLC_OPC_ENDPOINT="opc.tcp://<KV8000_IP>:4840/..."
  3. Map the two PLC variables to identical NodeIDs (or update IPC config):
     - QR_Data Node:             ns=2;i=2  (Writable string, receives Barcode from IPC)
     - Verification_Status Node: ns=2;i=3  (Readable string, returns 'OK' or 'NG')

LIFECYCLE BEHAVIOR:
  1. Handshake: IPC resets Verification_Status to 'IDLE'.
  2. Input: IPC writes new Barcode string to QR_Data node.
  3. Processing: Simulator changes status to 'PROCESSING' and waits cycle time.
  4. Decision: Simulator writes final inspection result ('OK' or 'NG') to
     Verification_Status node.
=============================================================================
"""

import asyncio
import os
import sys
import datetime
import random
from pathlib import Path
from asyncua import Server, ua

# Configuration (overridable via Environment Variables)
ENDPOINT_HOST = os.getenv("PLC_HOST", "127.0.0.1")
ENDPOINT_PORT = int(os.getenv("PLC_PORT", "4840"))
NAMESPACE_URI = os.getenv("PLC_NAMESPACE", "http://simulasi.plc.keyence")
CYCLE_TIME_SEC = float(os.getenv("PLC_CYCLE_TIME_SEC", "3.0"))
OK_WEIGHT = int(os.getenv("PLC_OK_WEIGHT", "80"))  # Probability: 80% OK
NG_WEIGHT = int(os.getenv("PLC_NG_WEIGHT", "20"))  # Probability: 20% NG

SCRIPT_DIR = Path(__file__).resolve().parent
CERT_FILE = SCRIPT_DIR / "cert.pem"
KEY_FILE = SCRIPT_DIR / "key.pem"


def ensure_certificates():
    """Generates self-signed TLS certificates if they don't already exist."""
    if CERT_FILE.exists() and KEY_FILE.exists():
        return

    print("[Setup] Generating self-signed certificate for PLC Simulator...")
    try:
        from cryptography import x509
        from cryptography.x509.oid import NameOID
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa

        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        subject = issuer = x509.Name([
            x509.NameAttribute(NameOID.COMMON_NAME, "Keyence-KV8000-Simulator"),
        ])
        cert = (
            x509.CertificateBuilder()
            .subject_name(subject)
            .issuer_name(issuer)
            .public_key(key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(datetime.datetime.now(datetime.timezone.utc))
            .not_valid_after(datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=365))
            .sign(key, hashes.SHA256())
        )

        with open(KEY_FILE, "wb") as f:
            f.write(key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.TraditionalOpenSSL,
                encryption_algorithm=serialization.NoEncryption()
            ))

        with open(CERT_FILE, "wb") as f:
            f.write(cert.public_bytes(serialization.Encoding.PEM))

        print("[Setup] Certificate files created successfully.")
    except Exception as e:
        print(f"[Setup Warning] Could not generate certificates automatically: {e}")


async def main():
    ensure_certificates()

    server = Server()
    await server.init()
    endpoint_url = f"opc.tcp://{ENDPOINT_HOST}:{ENDPOINT_PORT}/freeopcua/server/"
    server.set_endpoint(endpoint_url)

    if CERT_FILE.exists() and KEY_FILE.exists():
        await server.load_certificate(str(CERT_FILE))
        await server.load_private_key(str(KEY_FILE))
    server.set_security_policy([ua.SecurityPolicyType.NoSecurity])

    idx = await server.register_namespace(NAMESPACE_URI)
    obj = await server.nodes.objects.add_object(idx, "KV8000")

    # 1. QR / Barcode input node (ns=2;i=2)
    qr_node = await obj.add_variable(idx, "QR_Data", "INITIAL_STATE")
    await qr_node.set_writable()

    # 2. Verification Status output node (ns=2;i=3)
    status_node = await obj.add_variable(idx, "Verification_Status", "IDLE")
    await status_node.set_writable()

    print("\n" + "=" * 65)
    print("      KEYENCE KV-8000 & SR-1000 PLC SIMULATOR ACTIVE")
    print("=" * 65)
    print(f"  OPC UA Endpoint : {endpoint_url}")
    print(f"  Namespace URI   : {NAMESPACE_URI}")
    print(f"  QR Input Node   : {qr_node.nodeid}  (QR_Data)")
    print(f"  Status Node     : {status_node.nodeid}  (Verification_Status)")
    print(f"  Cycle Time      : {CYCLE_TIME_SEC} seconds")
    print(f"  Probability     : {OK_WEIGHT}% OK / {NG_WEIGHT}% NG")
    print("=" * 65)
    print("Ready and listening for incoming barcodes from C# IPC Gateway...\n", flush=True)

    last_qr = "INITIAL_STATE"

    async with server:
        while True:
            await asyncio.sleep(0.5)
            try:
                current_qr = await qr_node.read_value()
            except Exception:
                continue

            # Detect new barcode sent by IPC
            if current_qr != last_qr and current_qr not in ("INITIAL_STATE", "IDLE"):
                timestamp = datetime.datetime.now().strftime("%H:%M:%S")
                print(f"[{timestamp}] [PLC] Menerima Barcode: '{current_qr}'", flush=True)
                print(f"[{timestamp}] [PLC] Memulai proses Laser Marking & Scan SR-1000...", flush=True)

                await status_node.write_value("PROCESSING")

                # Simulate machine processing cycle time
                await asyncio.sleep(CYCLE_TIME_SEC)

                # Simulate inspection verification result
                hasil_scan = random.choices(["OK", "NG"], weights=[OK_WEIGHT, NG_WEIGHT])[0]

                timestamp_done = datetime.datetime.now().strftime("%H:%M:%S")
                print(f"[{timestamp_done}] [PLC] Proses selesai. Hasil Verifikasi: {hasil_scan}\n", flush=True)

                # Write final decision to status node for IPC to read
                await status_node.write_value(hasil_scan)

                last_qr = current_qr


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, asyncio.CancelledError):
        print("\n[PLC] Simulator dihentikan oleh pengguna.")