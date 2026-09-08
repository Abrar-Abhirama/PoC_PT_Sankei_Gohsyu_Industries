import { useEffect, useState, useCallback, useRef } from 'react';
import { DashboardSummary, BarcodeResultItem, PaginationInfo } from './types';
import { KpiCards } from './components/KpiCards';
import { RecentResultsTable } from './components/RecentResultsTable';

export default function App() {
  // Machine Results & Summary State
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [results, setResults] = useState<BarcodeResultItem[]>([]);

  // Pagination & Filtering State
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 15,
    pageSize: 15,
    total: 0,
    totalPages: 1,
  });

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
      // Build paginated query parameters
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });

      if (statusFilter && statusFilter !== 'ALL') {
        params.append('status', statusFilter);
      }

      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }

      const [summaryRes, resultsRes, healthRes] = await Promise.all([
        fetch('/api/v1/machine-results/summary').then(async (r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status} fetching summary`);
          return r.json();
        }),
        fetch(`/api/v1/machine-results?${params.toString()}`).then(async (r) => {
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
      if (healthRes?.status === 'ok') {
        setIsBackendHealthy(true);
      } else {
        setIsBackendHealthy(false);
      }

      // Set Summary Stats
      if (summaryRes?.success && summaryRes.data) {
        setSummary(summaryRes.data);
      }

      // Set Paginated Barcode Results
      if (resultsRes?.success && Array.isArray(resultsRes.data)) {
        setResults(resultsRes.data);
        if (resultsRes.pagination) {
          setPagination(resultsRes.pagination);
        } else {
          const total = resultsRes.total || resultsRes.data.length;
          setPagination({
            page,
            limit: pageSize,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize) || 1,
          });
        }
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
  }, [page, pageSize, statusFilter, searchQuery]);

  // Initial load and polling setup (every 2.5s)
  useEffect(() => {
    fetchDashboardData();

    if (autoRefresh) {
      timerRef.current = window.setInterval(fetchDashboardData, 2500);
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
          <div className="brand-hexagon">⚙️</div>
          <div>
            <div className="brand-company">PT SANKEI GOHSYU INDUSTRIES</div>
            <h1 className="brand-title">Machine OK/NG Traceability Dashboard — PoC</h1>
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
              {isBackendHealthy ? 'SYSTEM ONLINE' : 'DISCONNECTED'}
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
              {autoRefresh ? 'Live Auto-Sync (2.5s)' : 'Sync Paused'}
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

        {/* Section 1 & 2: Current Machine Status Hero & Summary Counts */}
        <KpiCards summary={summary} loading={loading} />

        {/* Section 3: Barcode Results Table with Full Pagination & Filtering */}
        <div style={{ marginTop: '1.25rem' }}>
          <RecentResultsTable
            results={results}
            loading={loading}
            apiError={apiError}
            onRetry={fetchDashboardData}
            pagination={pagination}
            onPageChange={(newPage) => setPage(newPage)}
            pageSize={pageSize}
            onPageSizeChange={(newPageSize) => setPageSize(newPageSize)}
            statusFilter={statusFilter}
            onStatusFilterChange={(newStatus) => setStatusFilter(newStatus)}
            searchQuery={searchQuery}
            onSearchChange={(query) => setSearchQuery(query)}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="dashboard-footer font-mono">
        <span>PoC Flow: PostgreSQL → Node Backend → C# IPC → OPC UA → Python PLC Simulator → OPC UA → C# IPC → Node Backend → PostgreSQL</span>
        <span>Last synced: {lastRefreshed.toLocaleTimeString()}</span>
      </footer>
    </div>
  );
}
