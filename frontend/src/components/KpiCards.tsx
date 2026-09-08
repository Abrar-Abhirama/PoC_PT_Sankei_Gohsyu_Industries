import React from 'react';
import { MachineResultStats } from '../types';

interface KpiCardsProps {
  stats: MachineResultStats | null;
  loading?: boolean;
}

export const KpiCards: React.FC<KpiCardsProps> = ({ stats, loading }) => {
  const latest = stats?.latestResult;
  const machineCode = latest?.machineId || 'MACHINE-01';
  const total = stats?.total ?? 0;
  const okCount = stats?.okCount ?? 0;
  const ngCount = stats?.ngCount ?? 0;
  const yieldRate = stats?.yieldRate !== undefined ? stats.yieldRate.toFixed(1) : '100.0';

  const statusType = latest?.status; // 'OK' | 'NG' | undefined

  return (
    <section className="kpi-grid">
      {/* 1. Machine Status Indicator */}
      <div className="card kpi-card">
        <div className="kpi-header">
          <span className="kpi-tag">Machine Status Indicator</span>
          <span className="kpi-badge font-mono">{machineCode}</span>
        </div>
        <div className="kpi-main">
          {statusType === 'OK' ? (
            <div className="status-indicator-box indicator--ok">
              <span className="indicator-beacon beacon--ok" />
              STATUS: OK
            </div>
          ) : statusType === 'NG' ? (
            <div className="status-indicator-box indicator--ng">
              <span className="indicator-beacon beacon--ng" />
              STATUS: NG
            </div>
          ) : (
            <div className="status-indicator-box indicator--standby">
              <span className="indicator-beacon beacon--standby" />
              STANDBY
            </div>
          )}
        </div>
        <div className="kpi-footer">
          <span className="kpi-subtext font-mono">
            {latest
              ? `Signal at ${new Date(latest.timestamp).toLocaleTimeString()}`
              : 'Awaiting OPC UA Client signal'}
          </span>
        </div>
      </div>

      {/* 2. Total Results Card */}
      <div className="card kpi-card">
        <div className="kpi-header">
          <span className="kpi-tag">Total Results</span>
          <span className="kpi-badge font-mono">INSPECTIONS</span>
        </div>
        <div className="kpi-main">
          <div className="progress-numbers">
            <span className="current-num font-mono">
              {loading && !stats ? '...' : total}
            </span>
            <span className="target-num font-mono">units</span>
          </div>
        </div>
        <div className="kpi-footer">
          <span className="kpi-subtext">Cumulative machine inspection results</span>
        </div>
      </div>

      {/* 3. OK & NG Counts Card */}
      <div className="card kpi-card">
        <div className="kpi-header">
          <span className="kpi-tag">Results Breakdown</span>
          <span className="kpi-percent font-mono text-emerald">{yieldRate}% Yield</span>
        </div>
        <div className="kpi-quality-row">
          <div className="quality-item quality--pass">
            <span className="q-label">OK COUNT</span>
            <span className="q-val font-mono">{okCount}</span>
          </div>
          <div className="quality-item quality--fail">
            <span className="q-label">NG COUNT</span>
            <span className="q-val font-mono">{ngCount}</span>
          </div>
        </div>
        <div className="kpi-footer">
          <span className="kpi-subtext">
            {okCount} OK / {ngCount} NG recorded
          </span>
        </div>
      </div>

      {/* 4. Current / Latest Machine Result */}
      <div className="card kpi-card">
        <div className="kpi-header">
          <span className="kpi-tag">Latest Inspection</span>
          <span className="kpi-badge font-mono">OPC UA</span>
        </div>
        <div className="kpi-main">
          {latest ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span
                className={`badge badge--${latest.status === 'OK' ? 'success' : 'error'}`}
                style={{ fontSize: '1.25rem', padding: '0.35rem 0.85rem' }}
              >
                {latest.status}
              </span>
              <span className="font-mono text-muted text-xs">
                ID #{latest.id}
              </span>
            </div>
          ) : (
            <span className="text-muted font-mono">Awaiting results...</span>
          )}
        </div>
        <div className="kpi-footer">
          <span className="kpi-subtext font-mono text-xs">
            {latest
              ? new Date(latest.timestamp).toLocaleString()
              : 'No machine results yet'}
          </span>
        </div>
      </div>
    </section>
  );
};

