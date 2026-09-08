export type ProductStatus = 'IN_PROGRESS' | 'PASS' | 'FAIL' | 'UNKNOWN';

export interface Product {
  id: number;
  serial_number: string;
  production_order_id: number;
  machine_id: number | null;
  status: ProductStatus;
  created_at: string;
  completed_at: string | null;
}
