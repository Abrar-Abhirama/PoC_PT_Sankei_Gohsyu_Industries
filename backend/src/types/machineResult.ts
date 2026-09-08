export type MachineResultStatus = 'OK' | 'NG';

export const VALID_MACHINE_RESULT_STATUSES: MachineResultStatus[] = ['OK', 'NG'];

export interface CreateMachineResultBody {
  machineId: string;
  status: MachineResultStatus;
  timestamp: string;
}

export interface MachineResult {
  id: number;
  machineId: string;
  status: MachineResultStatus;
  timestamp: string;
  createdAt?: string;
}

export interface MachineResultStats {
  total: number;
  okCount: number;
  ngCount: number;
  yieldRate: number;
  latestResult: MachineResult | null;
}
