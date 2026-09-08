import React from 'react';
import { CurrentProductionOrder, MachineInfo } from '../types';

interface KpiCardsProps {
  order: CurrentProductionOrder | null;
  machine: MachineInfo | null;
}

export const KpiCards: React.FC<KpiCardsProps> = ({ order, machine }) => {
  const machineStatus = machine?.status || (order ? 'RUNNING' : 'STOPPED');
  const machineCode = machine?.machine_code || 'LINE-01';

  const target = order ? Number(order.target_quantity) : 0;
  const produced = order ? Number(order.produced_quantity || 0) : 0;
  const passed = order ? Number(order.pass_quantity || 0) : 0;
  const failed = order ? Number(order.fail_quantity || 0) : 0;

  const progressPercent = target > 0 ? Math.min(Math.round((produced / target) * 100), 100) : 0;
  const yieldPercent =
    passed + failed > 0 ? ((passed / (passed + failed)) * 100).toFixed(1) : '100.0';

  return (
    <section className="kpi-grid">
      {/* 1. Machine Status Card */}
      <div className="card kpi-card">
        <div className="kpi-header">
          <span className="kpi-tag">Station & Machine</span>
          <span className={`status-dot dot--${machineStatus.toLowerCase()}`} />
        </div>
        <div className="kpi-main">
          <h2 className="kpi-title font-mono">{machineCode}</h2>
          <span
            className={`badge badge--${
              machineStatus === 'RUNNING'
                ? 'success'
                : machineStatus === 'ERROR'
                ? 'error'
                : 'warning'
            }`}
          >
            {machineStatus}
          </span>
        </div>
        <div className="kpi-footer">
          <span className="kpi-subtext">
            {machine?.name || 'Main Production Assembly Line'}
          </span>
          {machine?.last_seen_at && (
            <span className="kpi-subtext font-mono">
              Heartbeat: {new Date(machine.last_seen_at).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* 2. Current Production Order Card */}
      <div className="card kpi-card">
        <div className="kpi-header">
          <span className="kpi-tag">Active Production Order</span>
          <span className="kpi-badge font-mono">
            {order ? order.status : 'NO ORDER RUNNING'}
          </span>
        </div>
        <div className="kpi-main">
          <h2 className="kpi-title font-mono">
            {order ? order.order_number : '—'}
          </h2>
        </div>
        <div className="kpi-footer">
          <span className="kpi-product-name">
            {order ? `${order.product_name} (${order.product_code})` : 'Standby mode — Start order'}
          </span>
        </div>
      </div>

      {/* 3. Production Progress Card */}
      <div className="card kpi-card">
        <div className="kpi-header">
          <span className="kpi-tag">Production Progress</span>
          <span className="kpi-percent font-mono">{progressPercent}%</span>
        </div>
        <div className="kpi-main">
          <div className="progress-numbers">
            <span className="current-num font-mono">{produced}</span>
            <span className="divider">/</span>
            <span className="target-num font-mono">{target} pcs</span>
          </div>
        </div>
        <div className="progress-bar-container">
          <div
            className="progress-bar-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="kpi-footer">
          <span className="kpi-subtext">
            Remaining: {Math.max(target - produced, 0)} units
          </span>
        </div>
      </div>

      {/* 4. Inspection Quality Yield Card */}
      <div className="card kpi-card">
        <div className="kpi-header">
          <span className="kpi-tag">Inspection Yield</span>
          <span className="kpi-percent font-mono text-emerald">{yieldPercent}%</span>
        </div>
        <div className="kpi-quality-row">
          <div className="quality-item quality--pass">
            <span className="q-label">PASS</span>
            <span className="q-val font-mono">{passed}</span>
          </div>
          <div className="quality-item quality--fail">
            <span className="q-label">FAIL</span>
            <span className="q-val font-mono">{failed}</span>
          </div>
        </div>
        <div className="kpi-footer">
          <span className="kpi-subtext">
            Total Inspected: {passed + failed} pcs
          </span>
        </div>
      </div>
    </section>
  );
};
