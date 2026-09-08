import React from 'react';
import { MachineResult } from '../types';

interface RecentResultsTableProps {
  results: MachineResult[];
  loading: boolean;
  apiError?: string | null;
  onRetry?: () => void;
}

export const RecentResultsTable: React.FC<RecentResultsTableProps> = ({
  results,
  loading,
  apiError,
  onRetry,
}) => {
  return (
    <div className="card table-card">
      <div className="card-header-row">
        <div>
          <h3 className="card-heading">📋 Recent Machine Results (OK / NG)</h3>
          <p className="card-subheading">Live stream of inspection results received from the OPC UA Client</p>
        </div>
        <span className="count-pill font-mono">{results.length} records</span>
      </div>

      <div className="table-responsive">
        <table className="custom-table">
          <thead>
            <tr>
              <th style={{ width: '80px' }}>ID</th>
              <th>Machine ID</th>
              <th>Status</th>
              <th>Timestamp (ISO-8601)</th>
              <th style={{ textAlign: 'right' }}>Recorded At</th>
            </tr>
          </thead>
          <tbody>
            {loading && results.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-6">
                  <span className="spinner" /> Loading machine results from backend...
                </td>
              </tr>
            ) : apiError && results.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-6">
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ color: '#fca5a5', fontSize: '0.9rem' }}>
                      ⚠️ Unable to load machine results: {apiError}
                    </span>
                    {onRetry && (
                      <button type="button" onClick={onRetry} className="retry-btn">
                        Retry Loading
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : results.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-6 text-muted">
                  No machine results recorded yet. Run <code>node mock-opc-client/index.js --ok</code> to send results.
                </td>
              </tr>
            ) : (
              results.map((item) => (
                <tr key={item.id} className="table-row">
                  <td className="font-mono text-muted">#{item.id}</td>
                  <td className="font-mono font-medium text-cyan">
                    {item.machineId}
                  </td>
                  <td>
                    <span
                      className={`badge badge--${
                        item.status === 'OK' ? 'success' : 'error'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="font-mono text-xs">
                    {new Date(item.timestamp).toLocaleString([], {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </td>
                  <td className="font-mono text-muted text-xs" style={{ textAlign: 'right' }}>
                    {new Date(item.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

