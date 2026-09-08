export type MachineEventType =
  | 'PRODUCT_DETECTED'
  | 'PRINT_STARTED'
  | 'PRINT_COMPLETED'
  | 'PRINT_FAILED'
  | 'QR_READ'
  | 'QR_READ_FAILED'
  | 'VISION_PASS'
  | 'VISION_FAIL'
  | 'PRODUCT_COMPLETED'
  | 'MACHINE_STARTED'
  | 'MACHINE_STOPPED'
  | 'MACHINE_ERROR'
  | 'EMERGENCY_STOP';

export const VALID_EVENT_TYPES: MachineEventType[] = [
  'PRODUCT_DETECTED',
  'PRINT_STARTED',
  'PRINT_COMPLETED',
  'PRINT_FAILED',
  'QR_READ',
  'QR_READ_FAILED',
  'VISION_PASS',
  'VISION_FAIL',
  'PRODUCT_COMPLETED',
  'MACHINE_STARTED',
  'MACHINE_STOPPED',
  'MACHINE_ERROR',
  'EMERGENCY_STOP',
];

export type InspectionType = 'QR_READ' | 'VISION';
export const VALID_INSPECTION_TYPES: InspectionType[] = ['QR_READ', 'VISION'];

export type InspectionResult = 'PASS' | 'FAIL';
export const VALID_INSPECTION_RESULTS: InspectionResult[] = ['PASS', 'FAIL'];

export type MachineStatus = 'RUNNING' | 'STOPPED' | 'ERROR' | 'UNKNOWN';
export const VALID_MACHINE_STATUSES: MachineStatus[] = ['RUNNING', 'STOPPED', 'ERROR', 'UNKNOWN'];

export interface IpcEventPayload {
  machineId: string;
  eventType: MachineEventType;
  timestamp?: string;
  serialNumber?: string;
  productId?: number;
  data?: Record<string, unknown>;
}

export interface IpcInspectionResultPayload {
  serialNumber?: string;
  productId?: number;
  machineId?: string;
  inspectionType: InspectionType;
  result: InspectionResult;
  details?: Record<string, unknown>;
  timestamp?: string;
}

export interface IpcStatusPayload {
  machineId: string;
  status: MachineStatus;
  timestamp?: string;
  details?: Record<string, unknown>;
}

export interface MachineRecord {
  id: number;
  machine_code: string;
  name: string;
  status: MachineStatus;
  last_seen_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface MachineEventRecord {
  id: number;
  machine_id: number | null;
  product_id: number | null;
  event_type: MachineEventType;
  event_data: Record<string, unknown> | null;
  timestamp: Date;
}
