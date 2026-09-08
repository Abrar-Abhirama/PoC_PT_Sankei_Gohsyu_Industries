import React from 'react';
import { DashboardSummary } from '../types';

interface KpiCardsProps {
  summary: DashboardSummary | null;
  loading?: boolean;
}

export const KpiCards: React.FC<KpiCardsProps> = ({ summary, loading }) => {
  const latest = summary?.latestResult;
  const machineId = latest?.machineId || 'MACHINE-01';
  const latestBarcode = latest?.barcode || '-';
  const latestStatus = latest?.status; // 'OK' | 'NG' | undefined

  const formatTime = (ts?: string) => {
    if (!ts) return '-';
    try {
      return new Date(ts).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return ts;
    }
  };

  const totalProcessed = summary?.totalProcessed ?? 0;
  const okCount = summary?.okCount ?? 0;
  const ngCount = summary?.ngCount ?? 0;
  const pendingCount = summary?.pendingCount ?? 0;
  const processingCount = summary?.processingCount ?? 0;
  const yieldRate = summary?.yieldRate !== undefined ? summary.yieldRate.toFixed(1) : '100.0';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 1. CURRENT MACHINE STATUS (PROMINENT HERO CARD) */}
      <section className="card" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, var(--color-surface) 0%, rgba(17, 23, 38, 0.8) 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <span className="kpi-tag" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Machine Status</span>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
              Machine: <span className="text-cyan font-mono">{machineId}</span>
            </h2>
          </div>

          <div>
            {latestStatus === 'OK' ? (
              <div className="status-indicator-box indicator--ok" style={{ fontSize: '1.5rem', padding: '0.6rem 1.5rem', borderRadius: '12px' }}>
                <span className="indicator-beacon beacon--ok" style={{ width: '14px', height: '14px' }} />
                STATUS: OK
              </div>
            ) : latestStatus === 'NG' ? (
              <div className="status-indicator-box indicator--ng" style={{ fontSize: '1.5rem', padding: '0.6rem 1.5rem', borderRadius: '12px' }}>
                <span className="indicator-beacon beacon--ng" style={{ width: '14px', height: '14px' }} />
                STATUS: NG
              </div>
            ) : (
              <div className="status-indicator-box indicator--standby" style={{ fontSize: '1.5rem', padding: '0.6rem 1.5rem', borderRadius: '12px' }}>
                <span className="indicator-beacon beacon--standby" style={{ width: '14px', height: '14px' }} />
                STATUS: STANDBY
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', background: 'var(--color-surface-2)', padding: '1rem 1.25rem', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
          <div>
            <div className="kpi-subtext" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Latest Barcode</div>
            <div className="font-mono text-cyan" style={{ fontSize: '1.25rem', fontWeight: 600, wordBreak: 'break-all', marginTop: '0.2rem' }}>
              {loading && !summary ? '...' : latestBarcode}
            </div>
          </div>

          <div>
            <div className="kpi-subtext" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Inspection Result</div>
            <div style={{ marginTop: '0.2rem' }}>
              {latest ? (
                <span className={`badge badge--${latest.status === 'OK' ? 'success' : 'error'}`} style={{ fontSize: '1rem', padding: '0.2rem 0.75rem' }}>
                  {latest.status === 'OK' ? 'PASSED (OK)' : 'REJECTED (NG)'}
                </span>
              ) : (
                <span className="text-muted font-mono">-</span>
              )}
            </div>
          </div>

          <div>
            <div className="kpi-subtext" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>Processed Time</div>
            <div className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-text)', marginTop: '0.2rem' }}>
              {latest ? formatTime(latest.updatedAt) : '-'}
            </div>
          </div>
        </div>
      </section>

      {/* 2. SUMMARY (5 KPI CARDS: Total, OK, NG, Pending, Processing) */}
      <section className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        {/* Total Processed */}
        <div className="card kpi-card">
          <div className="kpi-header">
            <span className="kpi-tag">Total Processed</span>
            <span className="kpi-badge font-mono">DONE</span>
          </div>
          <div className="kpi-main">
            <div className="progress-numbers">
              <span className="current-num font-mono">{loading && !summary ? '...' : totalProcessed}</span>
              <span className="target-num font-mono">items</span>
            </div>
          </div>
          <div className="kpi-footer">
            <span className="kpi-subtext font-mono text-xs">{yieldRate}% Yield Rate</span>
          </div>
        </div>

        {/* OK Count */}
        <div className="card kpi-card" style={{ borderLeft: '4px solid var(--color-emerald)' }}>
          <div className="kpi-header">
            <span className="kpi-tag" style={{ color: 'var(--color-emerald)' }}>OK Count</span>
            <span className="kpi-badge font-mono badge--success">PASS</span>
          </div>
          <div className="kpi-main">
            <div className="progress-numbers">
              <span className="current-num font-mono text-emerald">{okCount}</span>
            </div>
          </div>
          <div className="kpi-footer">
            <span className="kpi-subtext">Verified & Passed</span>
          </div>
        </div>

        {/* NG Count */}
        <div className="card kpi-card" style={{ borderLeft: '4px solid var(--color-rose)' }}>
          <div className="kpi-header">
            <span className="kpi-tag" style={{ color: 'var(--color-rose)' }}>NG Count</span>
            <span className="kpi-badge font-mono badge--error">FAIL</span>
          </div>
          <div className="kpi-main">
            <div className="progress-numbers">
              <span className="current-num font-mono" style={{ color: 'var(--color-rose)' }}>{ngCount}</span>
            </div>
          </div>
          <div className="kpi-footer">
            <span className="kpi-subtext">Failed / Not Good</span>
          </div>
        </div>

        {/* Pending Count */}
        <div className="card kpi-card" style={{ borderLeft: '4px solid var(--color-amber)' }}>
          <div className="kpi-header">
            <span className="kpi-tag" style={{ color: 'var(--color-amber)' }}>Pending</span>
            <span className="kpi-badge font-mono badge--warning">QUEUE</span>
          </div>
          <div className="kpi-main">
            <div className="progress-numbers">
              <span className="current-num font-mono" style={{ color: 'var(--color-amber)' }}>{pendingCount}</span>
            </div>
          </div>
          <div className="kpi-footer">
            <span className="kpi-subtext">Waiting in database</span>
          </div>
        </div>

        {/* Processing Count */}
        <div className="card kpi-card" style={{ borderLeft: '4px solid var(--color-cyan)' }}>
          <div className="kpi-header">
            <span className="kpi-tag" style={{ color: 'var(--color-cyan)' }}>Processing</span>
            <span className="kpi-badge font-mono badge--info">PLC</span>
          </div>
          <div className="kpi-main">
            <div className="progress-numbers">
              <span className="current-num font-mono text-cyan">{processingCount}</span>
            </div>
          </div>
          <div className="kpi-footer">
            <span className="kpi-subtext">In-flight on machine</span>
          </div>
        </div>
      </section>
    </div>
  );
};