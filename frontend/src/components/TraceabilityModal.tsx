import React from 'react';
import { ProductTraceability } from '../types';

interface TraceabilityModalProps {
  data: ProductTraceability | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}

export const TraceabilityModal: React.FC<TraceabilityModalProps> = ({
  data,
  loading,
  error,
  onClose,
}) => {
  if (!data && !loading && !error) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-title">
            <span className="modal-icon">🔍</span>
            <div>
              <h3>Product Traceability History</h3>
              <p className="modal-subtitle">
                {data ? data.serialNumber : 'Loading traceability record...'}
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} title="Close modal">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {loading && (
            <div className="modal-loading">
              <span className="spinner" />
              <p>Fetching complete chronological traceability...</p>
            </div>
          )}

          {error && (
            <div className="alert alert--error">
              <strong>Error finding product:</strong>
              <p>{error}</p>
            </div>
          )}

          {data && (
            <>
              {/* Top Summary Banner */}
              <div className="trace-banner">
                <div className="trace-banner-item">
                  <span className="label">Serial Number</span>
                  <span className="value font-mono highlight">{data.serialNumber}</span>
                </div>
                <div className="trace-banner-item">
                  <span className="label">Overall Status</span>
                  <span
                    className={`badge badge--${
                      data.productionStatus === 'PASS'
                        ? 'success'
                        : data.productionStatus === 'FAIL'
                        ? 'error'
                        : 'warning'
                    }`}
                  >
                    {data.productionStatus}
                  </span>
                </div>
                <div className="trace-banner-item">
                  <span className="label">Production Order</span>
                  <span className="value font-mono">
                    {data.productionOrder.orderNumber || '-'}
                  </span>
                </div>
                <div className="trace-banner-item">
                  <span className="label">Product Name</span>
                  <span className="value">
                    {data.productionOrder.productName} ({data.productionOrder.productCode})
                  </span>
                </div>
                <div className="trace-banner-item">
                  <span className="label">Machine / Line</span>
                  <span className="value">{data.machine.machineCode || 'LINE-01'}</span>
                </div>
                <div className="trace-banner-item">
                  <span className="label">Cycle Time</span>
                  <span className="value font-mono">
                    {data.product.cycleTimeSeconds !== null
                      ? `${data.product.cycleTimeSeconds}s`
                      : 'In Progress'}
                  </span>
                </div>
              </div>

              {/* Inspection Hardware Summary Cards */}
              <div className="trace-hardware-grid">
                <div
                  className={`hardware-card ${
                    data.inspections.qrReadingResult.result === 'PASS'
                      ? 'card--pass'
                      : data.inspections.qrReadingResult.result === 'FAIL'
                      ? 'card--fail'
                      : ''
                  }`}
                >
                  <div className="hardware-card-header">
                    <span className="hw-icon">📷</span>
                    <div>
                      <h4>Keyence SR-1000 (QR Reader)</h4>
                      <span className="hw-type">Laser Code Verification</span>
                    </div>
                  </div>
                  <div className="hardware-card-body">
                    <div className="hw-stat">
                      <span>Result:</span>
                      <span
                        className={`badge badge--${
                          data.inspections.qrReadingResult.result === 'PASS'
                            ? 'success'
                            : data.inspections.qrReadingResult.result === 'FAIL'
                            ? 'error'
                            : 'warning'
                        }`}
                      >
                        {data.inspections.qrReadingResult.result || 'PENDING'}
                      </span>
                    </div>
                    {data.inspections.qrReadingResult.details && (
                      <pre className="hw-details">
                        {JSON.stringify(data.inspections.qrReadingResult.details, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>

                <div
                  className={`hardware-card ${
                    data.inspections.visionInspectionResult.result === 'PASS'
                      ? 'card--pass'
                      : data.inspections.visionInspectionResult.result === 'FAIL'
                      ? 'card--fail'
                      : ''
                  }`}
                >
                  <div className="hardware-card-header">
                    <span className="hw-icon">👁️</span>
                    <div>
                      <h4>Keyence IV3 (Vision Sensor)</h4>
                      <span className="hw-type">Surface & Dimension Check</span>
                    </div>
                  </div>
                  <div className="hardware-card-body">
                    <div className="hw-stat">
                      <span>Result:</span>
                      <span
                        className={`badge badge--${
                          data.inspections.visionInspectionResult.result === 'PASS'
                            ? 'success'
                            : data.inspections.visionInspectionResult.result === 'FAIL'
                            ? 'error'
                            : 'warning'
                        }`}
                      >
                        {data.inspections.visionInspectionResult.result || 'PENDING'}
                      </span>
                    </div>
                    {data.inspections.visionInspectionResult.details && (
                      <pre className="hw-details">
                        {JSON.stringify(data.inspections.visionInspectionResult.details, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              </div>

              {/* Chronological History Timeline */}
              <div className="trace-timeline-section">
                <h4 className="section-title">Chronological Lifecycle History</h4>
                <div className="timeline-container">
                  {data.timeline && data.timeline.length > 0 ? (
                    data.timeline.map((step) => {
                      const isPass = step.status === 'PASS';
                      const isFail = step.status === 'FAIL' || step.status === 'ERROR';
                      const badgeClass = isPass
                        ? 'badge--success'
                        : isFail
                        ? 'badge--error'
                        : 'badge--info';

                      return (
                        <div key={step.step} className={`timeline-item ${isFail ? 'item--fail' : ''}`}>
                          <div className="timeline-marker">
                            <span className="timeline-step-num">{step.step}</span>
                          </div>
                          <div className="timeline-content">
                            <div className="timeline-top">
                              <span className="timeline-title">{step.title}</span>
                              <span className={`badge ${badgeClass}`}>{step.status}</span>
                              <span className="timeline-time font-mono">
                                {new Date(step.timestamp).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                })}
                              </span>
                            </div>
                            <p className="timeline-desc">{step.description}</p>
                            {step.details && Object.keys(step.details).length > 0 && (
                              <details className="timeline-raw">
                                <summary>View raw event data</summary>
                                <pre>{JSON.stringify(step.details, null, 2)}</pre>
                              </details>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="empty-text">No lifecycle events recorded yet.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
