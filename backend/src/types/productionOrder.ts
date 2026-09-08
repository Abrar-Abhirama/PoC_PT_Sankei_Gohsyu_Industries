export type ProductionOrderStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'CANCELLED';

export interface ProductionOrder {
  id: number;
  order_number: string;
  product_code: string;
  product_name: string;
  target_quantity: number;
  status: ProductionOrderStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateProductionOrderBody {
  order_number: string;
  product_code: string;
  product_name: string;
  target_quantity: number;
}
