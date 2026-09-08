import { useEffect, useState, useCallback, useRef } from 'react';
import { MachineResult, MachineResultStats } from './types';
import { KpiCards } from './components/KpiCards';
import { RecentResultsTable } from './components/RecentResultsTable';

export default function App() {
  // Machine Results State
  const [stats, setStats] = useState<MachineResultStats | null>(null);
  const [results, setResults] = useState<MachineResult[]>([]);

  // System & Connection State
  const [isBackendHealthy, setIsBackendHealthy] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Polling ref
  const timerRef = useRef<number | null>(null);

  /**
   * Fetch all dashboard data concurrently from Node.js backend
   */
  const fetchDashboardData = useCallback(async () => {
    try {
      const [summaryRes, resultsRes, healthRes] = await Promise.all([
        fetch('/api/v1/machine-results/summary').then(async (r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status} fetching summary`);
          return r.json();
        }),
        fetch('/api/v1/machine-results?limit=50').then(async (r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status} fetching results`);
          return r.json();
        }),
        fetch('/api/v1/health')
          .then(async (r) => {
            if (!r.ok) return { status: 'error' };
            return r.json();
          })
          .catch(() => ({ status: 'error' })),
      ]);

      // Set Backend Health status
      if (healthRes.status === 'ok') {
        setIsBackendHealthy(true);
      } else {
        setIsBackendHealthy(false);
      }

      // Set Stats & Results
      if (summaryRes?.success && summaryRes.data) {
        setStats(summaryRes.data);
      }
      if (resultsRes?.success && Array.isArray(resultsRes.data)) {
        setResults(resultsRes.data);
      }

      setApiError(null);
      setLastRefreshed(new Date());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown communication error';
      console.error('[Dashboard] Error fetching backend data:', msg);
      setApiError(`Could not reach backend API (${msg}). Is the Node.js backend running on port 3000?`);
      setIsBackendHealthy(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load and polling setup
  useEffect(() => {
    fetchDashboardData();

    if (autoRefresh) {
      timerRef.current = window.setInterval(fetchDashboardData, 3000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoRefresh, fetchDashboardData]);

  return (
    <div className="app-layout">
      {/* Top Navbar */}
      <header className="navbar">
        <div className="navbar-brand">
          <div className="brand-hexagon">⬡</div>
          <div>
            <div className="brand-company">PT SANKEI GOHSYU INDUSTRIES</div>
            <h1 className="brand-title">Machine OK/NG Inspection Dashboard — PoC</h1>
          </div>
        </div>

        <div className="navbar-actions">
          <div className="system-health">
            <span
              className={`health-dot ${
                isBackendHealthy ? 'dot--healthy' : 'dot--unhealthy'
              }`}
            />
            <span className="font-mono text-xs">
              {isBackendHealthy ? 'API ONLINE' : 'DISCONNECTED'}
            </span>
          </div>

          <div className="refresh-controls">
            <button
              type="button"
              className={`toggle-btn font-mono ${autoRefresh ? 'toggle--active' : ''}`}
              onClick={() => setAutoRefresh(!autoRefresh)}
              title={autoRefresh ? 'Click to pause live polling' : 'Click to resume live polling'}
            >
              <span className="pulse-icon">{autoRefresh ? '●' : '○'}</span>
              {autoRefresh ? 'Live Auto-Sync (3s)' : 'Sync Paused'}
            </button>

            <button
              type="button"
              className="refresh-btn font-mono"
              onClick={() => fetchDashboardData()}
              title="Manual refresh"
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Main Dashboard Content */}
      <main className="dashboard-content">
        {/* API Error Notification Banner */}
        {apiError && (
          <div className="api-error-banner">
            <div className="error-banner-content">
              <span className="error-icon">⚠️</span>
              <div>
                <strong>Backend Communication Error:</strong> {apiError}
              </div>
            </div>
            <button
              type="button"
              onClick={() => fetchDashboardData()}
              className="retry-btn"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Row 1: KPI Cards with Machine Status Indicator & OK/NG Counts */}
        <KpiCards stats={stats} loading={loading} />

        {/* Row 2: Live Machine Results Table */}
        <div style={{ marginTop: '1.25rem' }}>
          <RecentResultsTable
            results={results}
            loading={loading}
            apiError={apiError}
            onRetry={fetchDashboardData}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="dashboard-footer font-mono">
        <span>PoC Architecture: PLC → OPC UA Server → OPC UA Client → Node.js Backend → PostgreSQL → React Dashboard</span>
        <span>Last synced: {lastRefreshed.toLocaleTimeString()}</span>
      </footer>
    </div>
  );
}

