using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using Opc.UaFx;
using Opc.UaFx.Client;

namespace IpcGateway
{
    public class BarcodeResponse
    {
        [JsonPropertyName("id")]
        public int Id { get; set; }

        [JsonPropertyName("barcode")]
        public string Barcode { get; set; } = string.Empty;
    }

    class Program
    {
        static async Task Main(string[] args)
        {
            string nextBarcodeUrl = Environment.GetEnvironmentVariable("NEXT_BARCODE_API_URL")
                ?? "http://localhost:3000/api/v1/machine-results/next-barcode";

            string resultsUrl = Environment.GetEnvironmentVariable("RESULTS_API_URL")
                ?? "http://localhost:3000/api/v1/machine-results";

            string endpointUrl = Environment.GetEnvironmentVariable("PLC_OPC_ENDPOINT") 
                ?? "opc.tcp://127.0.0.1:4840/freeopcua/server/";

            string qrNodeId = Environment.GetEnvironmentVariable("QR_NODE_ID") ?? "ns=2;i=2";
            string statusNodeId = Environment.GetEnvironmentVariable("STATUS_NODE_ID") ?? "ns=2;i=3";

            int idleDelayMs = int.TryParse(Environment.GetEnvironmentVariable("IDLE_POLL_MS"), out int parsedDelay) ? parsedDelay : 2000;

            Console.WriteLine("==========================================================");
            Console.WriteLine("   Sankei C# IPC Gateway - Continuous Traceability Loop   ");
            Console.WriteLine("==========================================================");
            Console.WriteLine($"[Config] Next Barcode URL : {nextBarcodeUrl}");
            Console.WriteLine($"[Config] Results URL      : {resultsUrl}");
            Console.WriteLine($"[Config] PLC Endpoint     : {endpointUrl}");
            Console.WriteLine($"[Config] QR Node ID       : {qrNodeId}");
            Console.WriteLine($"[Config] Status Node ID   : {statusNodeId}");
            Console.WriteLine($"[Config] Idle Poll Delay  : {idleDelayMs}ms");
            Console.WriteLine("Tekan CTRL+C untuk menghentikan program.");
            Console.WriteLine("==========================================================\n");

            using var cts = new CancellationTokenSource();
            Console.CancelKeyPress += (s, e) =>
            {
                e.Cancel = true;
                cts.Cancel();
                Console.WriteLine("\n[IPC] Menghentikan loop pemrosesan...");
            };

            using var httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
            OpcClient? plcClient = null;

            try
            {
                while (!cts.Token.IsCancellationRequested)
                {
                    // 1. Ambil Barcode PENDING dari Backend API
                    BarcodeResponse? item = null;
                    try
                    {
                        var response = await httpClient.GetAsync(nextBarcodeUrl, cts.Token);
                        if (!response.IsSuccessStatusCode)
                        {
                            Console.WriteLine($"[Backend Warning] Gagal mengambil barcode. HTTP Status: {response.StatusCode}. Mencoba lagi...");
                            await Task.Delay(3000, cts.Token);
                            continue;
                        }

                        if (response.StatusCode == System.Net.HttpStatusCode.NoContent)
                        {
                            item = null;
                        }
                        else
                        {
                            var rawContent = await response.Content.ReadAsStringAsync(cts.Token);
                            if (!string.IsNullOrWhiteSpace(rawContent) && rawContent.Trim() != "null")
                            {
                                item = JsonSerializer.Deserialize<BarcodeResponse>(rawContent, new JsonSerializerOptions
                                {
                                    PropertyNameCaseInsensitive = true
                                });
                            }
                        }
                    }
                    catch (OperationCanceledException)
                    {
                        break;
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"[Backend Error] Gagal menghubungi backend: {ex.Message}. Menunggu 3 detik...");
                        try { await Task.Delay(3000, cts.Token); } catch (OperationCanceledException) { break; }
                        continue;
                    }

                    // Jika tidak ada barcode yang PENDING, tunggu sejenak lalu polling lagi
                    if (item == null || string.IsNullOrWhiteSpace(item.Barcode))
                    {
                        try { await Task.Delay(idleDelayMs, cts.Token); } catch (OperationCanceledException) { break; }
                        continue;
                    }

                    Console.WriteLine($"\n----------------------------------------------------------");
                    Console.WriteLine($"[IPC] Memproses Barcode ID: {item.Id} | Kode: {item.Barcode}");

                    // 2. Pastikan terhubung ke PLC Simulator
                    bool plcReady = false;
                    while (!plcReady && !cts.Token.IsCancellationRequested)
                    {
                        try
                        {
                            if (plcClient == null)
                            {
                                plcClient = new OpcClient(endpointUrl);
                                plcClient.Security.AutoAcceptUntrustedCertificates = true;
                            }

                            if (plcClient.State != OpcClientState.Connected)
                            {
                                Console.WriteLine("[PLC] Menghubungkan ke PLC Simulator...");
                                plcClient.Connect();
                                Console.WriteLine("[PLC] Terhubung ke PLC Simulator.");
                            }

                            plcReady = true;
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine($"[PLC Error] Gagal terhubung ke PLC: {ex.Message}. Mencoba lagi dalam 3 detik...");
                            plcClient?.Dispose();
                            plcClient = null;
                            try { await Task.Delay(3000, cts.Token); } catch (OperationCanceledException) { break; }
                        }
                    }

                    if (cts.Token.IsCancellationRequested) break;

                    // 3. Kirim Barcode ke PLC dan tunggu hasil verifikasi (OK / NG)
                    string verificationResult = string.Empty;
                    try
                    {
                        // Reset status ke IDLE sebagai handshake
                        plcClient!.WriteNode(statusNodeId, "IDLE");

                        // Tulis Barcode ke QR_Data
                        Console.WriteLine($"[IPC -> PLC] Menulis barcode ke node {qrNodeId}: {item.Barcode}");
                        plcClient.WriteNode(qrNodeId, item.Barcode);

                        // Tunggu proses mesin dan pembacaan SR-1000
                        Console.WriteLine("[PLC] Menunggu pengerjaan mesin & verifikasi status...");
                        string currentStatus = "PROCESSING";

                        while ((currentStatus == "PROCESSING" || currentStatus == "IDLE") && !cts.Token.IsCancellationRequested)
                        {
                            currentStatus = plcClient.ReadNode(statusNodeId).ToString()?.Trim() ?? string.Empty;
                            await Task.Delay(500, cts.Token);
                        }

                        if (currentStatus == "OK" || currentStatus == "NG")
                        {
                            verificationResult = currentStatus;
                            Console.WriteLine($"[PLC -> IPC] Hasil Verifikasi Diterima: {verificationResult}");
                        }
                        else
                        {
                            Console.WriteLine($"[PLC Warning] Status tidak valid: '{currentStatus}'");
                            continue;
                        }
                    }
                    catch (OperationCanceledException)
                    {
                        break;
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"[PLC Error] Terjadi error saat komunikasi dengan PLC: {ex.Message}");
                        plcClient?.Dispose();
                        plcClient = null;
                        try { await Task.Delay(3000, cts.Token); } catch (OperationCanceledException) { break; }
                        continue;
                    }

                    // 4. Kirim Hasil ke Backend API
                    bool backendUpdated = false;
                    while (!backendUpdated && !cts.Token.IsCancellationRequested)
                    {
                        try
                        {
                            Console.WriteLine($"[IPC -> Backend] Mengirim status '{verificationResult}' untuk Barcode ID {item.Id}...");
                            var payload = new
                            {
                                barcodeId = item.Id,
                                status = verificationResult,
                                timestamp = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")
                            };

                            var jsonPayload = JsonSerializer.Serialize(payload);
                            var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");

                            var postResponse = await httpClient.PostAsync(resultsUrl, content, cts.Token);
                            var responseBody = await postResponse.Content.ReadAsStringAsync(cts.Token);

                            if (postResponse.IsSuccessStatusCode)
                            {
                                Console.WriteLine($"[Backend] ✓ Berhasil diperbarui: ID {item.Id} -> {verificationResult}");
                                backendUpdated = true;
                            }
                            else
                            {
                                Console.WriteLine($"[Backend Warning] Gagal simpan hasil (Status: {postResponse.StatusCode}). Response: {responseBody}. Retry dalam 2 detik...");
                                await Task.Delay(2000, cts.Token);
                            }
                        }
                        catch (OperationCanceledException)
                        {
                            break;
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine($"[Backend Error] Gagal mengirim hasil: {ex.Message}. Retry dalam 2 detik...");
                            try { await Task.Delay(2000, cts.Token); } catch (OperationCanceledException) { break; }
                        }
                    }

                    Console.WriteLine($"[IPC] Selesai memproses Barcode ID: {item.Id}. Melanjutkan ke antrean berikutnya...");
                }
            }
            finally
            {
                plcClient?.Dispose();
                Console.WriteLine("\n[IPC] Loop pemrosesan dihentikan.");
            }
        }
    }
}