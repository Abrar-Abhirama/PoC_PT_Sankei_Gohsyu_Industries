import { useEffect, useState, useCallback, useRef } from 'react';
import {
  CurrentProductionOrder,
  MachineInfo,
  MachineEvent,
  ProductItem,
  ProductTraceability,
} from './types';
import { KpiCards } from './components/KpiCards';
import { TraceabilitySearch } from './components/TraceabilitySearch';
import { TraceabilityModal } from './components/TraceabilityModal';
import { RecentResultsTable } from './components/RecentResultsTable';
import { RecentEventsFeed } from './components/RecentEventsFeed';

export default function App() {
  // Main state
  const [currentOrder, setCurrentOrder] = useState<CurrentProductionOrder | null>(null);
  const [machine, setMachine] = useState<MachineInfo | null>(null);
  const [recentProducts, setRecentProducts] = useState<ProductItem[]>([]);
  const [recentEvents, setRecentEvents] = useState<MachineEvent[]>([]);
  
  // App status
  const [isBackendHealthy, setIsBackendHealthy] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Traceability Modal State
  const [selectedTraceability, setSelectedTraceability] = useState<ProductTraceability | null>(null);
  const [traceabilityLoading, setTraceabilityLoading] = useState(false);
  const [traceabilityError, setTraceabilityError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Polling ref
  const timerRef = useRef<number | null>(null);

  /**
   * Fetch all dashboard data concurrently
   */
  const fetchDashboardData = useCallback(async () => {
    try {
      const [orderRes, statusRes, productsRes, eventsRes, healthRes] = await Promise.allSettled([
        fetch('/api/v1/production/current').then((r) => r.json()),
        fetch('/api/v1/ipc/status?machineId=LINE-01').then((r) => r.json()),
        fetch('/api/v1/products').then((r) => r.json()),
        fetch('/api/v1/ipc/events?limit=25').then((r) => r.json()),
        fetch('/api/v1/health').then((r) => r.json()),
      ]);

      if (healthRes.status === 'fulfilled' && healthRes.value?.status === 'ok') {
        setIsBackendHealthy(true);
      } else {
        setIsBackendHealthy(false);
      }

      if (orderRes.status === 'fulfilled' && orderRes.value?.data) {
        setCurrentOrder(orderRes.value.data);
      } else if (orderRes.status === 'fulfilled' && orderRes.value?.data === null) {
        setCurrentOrder(null);
      }

      if (statusRes.status === 'fulfilled' && statusRes.value?.data) {
        setMachine(statusRes.value.data);
      }

      if (productsRes.status === 'fulfilled' && Array.isArray(productsRes.value?.data)) {
        setRecentProducts(productsRes.value.data);
      }

      if (eventsRes.status === 'fulfilled' && Array.isArray(eventsRes.value?.data)) {
        setRecentEvents(eventsRes.value.data);
      }

      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
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

  /**
   * Fetch Traceability for a specific product serial number
   */
  const handleInspectProduct = async (serialNumber: string) => {
    setIsModalOpen(true);
    setTraceabilityLoading(true);
    setTraceabilityError(null);
    setSelectedTraceability(null);

    try {
      const res = await fetch(`/api/v1/products/${encodeURIComponent(serialNumber)}/traceability`);
      const json = await res.json();

      if (res.ok && json.data) {
        setSelectedTraceability(json.data);
      } else {
        setTraceabilityError(json.error || `Failed to find product ${serialNumber}`);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Network error';
      setTraceabilityError(`Network error inspecting product: ${errorMsg}`);
    } finally {
      setTraceabilityLoading(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedTraceability(null);
    setTraceabilityError(null);
  };

  return (
    <div className="app-layout">
      {/* Top Navbar */}
      <header className="navbar">
        <div className="navbar-brand">
          <div className="brand-hexagon">⬡</div>
          <div>
            <div className="brand-company">PT SANKEI GOHSYU INDUSTRIES</div>
            <h1 className="brand-title">QR Traceability System — Production Dashboard</h1>
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

      {/* Main Dashboard Workspace */}
      <main className="dashboard-content">
        {/* Row 1: KPI Summary Metric Cards */}
        <KpiCards order={currentOrder} machine={machine} />

        {/* Row 2: Traceability Search Bar */}
        <TraceabilitySearch
          onSearch={handleInspectProduct}
          recentProducts={recentProducts}
          searching={traceabilityLoading}
        />

        {/* Row 3: Split View - Recent Results & Live Events Feed */}
        <div className="dashboard-split-grid">
          <RecentResultsTable
            products={recentProducts}
            onSelectProduct={handleInspectProduct}
            loading={loading}
          />
          <RecentEventsFeed
            events={recentEvents}
            onSelectProduct={handleInspectProduct}
            loading={loading}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="dashboard-footer font-mono">
        <span>PoC Phase — PT Sankei Gohsyu Industries</span>
        <span>Last synced: {lastRefreshed.toLocaleTimeString()}</span>
      </footer>

      {/* Traceability Inspection Modal */}
      {isModalOpen && (
        <TraceabilityModal
          data={selectedTraceability}
          loading={traceabilityLoading}
          error={traceabilityError}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
