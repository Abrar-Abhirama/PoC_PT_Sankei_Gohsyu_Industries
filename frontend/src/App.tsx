import { useEffect, useState } from 'react';

interface HealthStatus {
  status: string;
  timestamp: string;
  service: string;
  version: string;
  database: string;
  error?: string;
}

function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/health')
      .then((res) => res.json())
      .then((data: HealthStatus) => {
        setHealth(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        setFetchError(err.message);
        setLoading(false);
      });
  }, []);

  return (
    <div className="container">
      <header className="header">
        <div className="logo-row">
          <div className="logo-icon">⬡</div>
          <div>
            <h1 className="title">QR Traceability System</h1>
            <p className="subtitle">PT Sankei Gohsyu Industries — Proof of Concept</p>
          </div>
        </div>
      </header>

      <main className="main">
        <section className="card status-card">
          <h2 className="card-title">System Status</h2>

          {loading && (
            <div className="status-row">
              <span className="indicator indicator--loading" />
              <span className="status-label">Checking services…</span>
            </div>
          )}

          {fetchError && (
            <div className="alert alert--error">
              <strong>Cannot reach backend</strong>
              <p>{fetchError}</p>
            </div>
          )}

          {health && (
            <div className="health-grid">
              <div className="health-item">
                <span className="health-label">API</span>
                <span className={`badge badge--${health.status === 'ok' ? 'success' : 'error'}`}>
                  {health.status.toUpperCase()}
                </span>
              </div>
              <div className="health-item">
                <span className="health-label">Database</span>
                <span className={`badge badge--${health.database === 'ok' ? 'success' : 'error'}`}>
                  {health.database.toUpperCase()}
                </span>
              </div>
              <div className="health-item">
                <span className="health-label">Service</span>
                <span className="health-value">{health.service}</span>
              </div>
              <div className="health-item">
                <span className="health-label">Version</span>
                <span className="health-value">{health.version}</span>
              </div>
              <div className="health-item">
                <span className="health-label">Timestamp</span>
                <span className="health-value">
                  {new Date(health.timestamp).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}
                </span>
              </div>
              {health.error && (
                <div className="alert alert--error">
                  <strong>DB Error:</strong> {health.error}
                </div>
              )}
            </div>
          )}
        </section>

        <section className="card info-card">
          <h2 className="card-title">Development Environment</h2>
          <p className="info-text">
            The initial project scaffold is running. Business logic and features will be implemented
            in subsequent development phases.
          </p>
          <div className="endpoint-list">
            <div className="endpoint">
              <code className="method">GET</code>
              <code className="path">/health</code>
              <span className="endpoint-desc">Health check</span>
            </div>
            <div className="endpoint">
              <code className="method">GET</code>
              <code className="path">/api/v1</code>
              <span className="endpoint-desc">API root</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
