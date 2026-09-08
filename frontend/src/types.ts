export interface CurrentProductionOrder {
  id: number;
  order_number: string;
  product_code: string;
  product_name: string;
  target_quantity: number;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'CANCELLED';
  created_at: string;
  updated_at: string;
  produced_quantity: string | number;
  pass_quantity: string | number;
  fail_quantity: string | number;
}

export interface MachineInfo {
  id: number;
  machine_code: string;
  name: string;
  status: 'RUNNING' | 'STOPPED' | 'ERROR' | 'UNKNOWN';
  last_seen_at: string | null;
  updated_at: string;
}

export interface MachineEvent {
  id: number;
  event_type: string;
  event_data: Record<string, unknown> | null;
  timestamp: string;
  machine_code?: string;
  machine_name?: string;
  serial_number?: string;
  product_status?: string;
}

export interface ProductItem {
  id: number;
  serial_number: string;
  production_order_id: number;
  machine_id: number | null;
  status: 'IN_PROGRESS' | 'PASS' | 'FAIL' | 'UNKNOWN';
  created_at: string;
  completed_at: string | null;
  order_number?: string;
}

export interface TraceabilityTimelineItem {
  step: number;
  timestamp: string;
  source: 'EVENT' | 'INSPECTION';
  title: string;
  description: string;
  status: 'INFO' | 'PASS' | 'FAIL' | 'ERROR';
  details?: Record<string, unknown> | null;
}

export interface ProductTraceability {
  serialNumber: string;
  productionStatus: 'IN_PROGRESS' | 'PASS' | 'FAIL' | 'UNKNOWN';
  product: {
    id: number;
    serialNumber: string;
    status: string;
    createdAt: string;
    completedAt: string | null;
    cycleTimeSeconds: number | null;
  };
  productionOrder: {
    id: number;
    orderNumber: string;
    productCode: string;
    productName: string;
    targetQuantity: number;
    status: string;
    createdAt: string;
  };
  machine: {
    id: number | null;
    machineCode: string | null;
    name: string | null;
    status: string | null;
  };
  inspections: {
    qrReadingResult: {
      result: 'PASS' | 'FAIL' | null;
      timestamp: string | null;
      details: Record<string, unknown> | null;
    };
    visionInspectionResult: {
      result: 'PASS' | 'FAIL' | null;
      timestamp: string | null;
      details: Record<string, unknown> | null;
    };
    records: Array<{
      id: number;
      product_id: number;
      inspection_type: string;
      result: string;
      details: Record<string, unknown> | null;
      timestamp: string;
    }>;
  };
  machineEvents: Array<{
    id: number;
    eventType: string;
    eventData: Record<string, unknown> | null;
    timestamp: string;
  }>;
  timeline: TraceabilityTimelineItem[];
}
