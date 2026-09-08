export type BarcodeResultStatus = 'PENDING' | 'PROCESSING' | 'OK' | 'NG';

export interface BarcodeResultItem {
  id: number;
  barcode: string;
  status: BarcodeResultStatus;
  machineId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface DashboardSummary {
  total: number;
  totalProcessed: number;
  totalBarcodes: number;
  okCount: number;
  ngCount: number;
  pendingCount: number;
  processingCount: number;
  yieldRate: number;
  latestResult: BarcodeResultItem | null;
}
