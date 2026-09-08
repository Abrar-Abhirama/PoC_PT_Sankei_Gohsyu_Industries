import React from 'react';
import { MachineEvent } from '../types';

interface RecentEventsFeedProps {
  events: MachineEvent[];
  onSelectProduct?: (serialNumber: string) => void;
  loading: boolean;
}

export const RecentEventsFeed: React.FC<RecentEventsFeedProps> = ({
  events,
  onSelectProduct,
  loading,
}) => {
  const getEventBadgeClass = (type: string) => {
    if (type.includes('FAIL') || type.includes('ERROR')) return 'badge--error';
    if (type.includes('PASS') || type.includes('COMPLETED')) return 'badge--success';
    if (type.includes('STARTED') || type.includes('DETECTED')) return 'badge--info';
    return 'badge--warning';
  };

  return (
    <div className="card events-card">
      <div className="card-header-row">
        <div>
          <h3 className="card-heading">⚡ Live Machine Events</h3>
          <p className="card-subheading">Stream of PLC and sensor events from the line</p>
        </div>
        <span className="live-pill font-mono">
          <span className="live-dot" /> LIVE
        </span>
      </div>

      <div className="events-list">
        {loading && events.length === 0 ? (
          <div className="text-center py-6">
            <span className="spinner" /> Loading events...
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-6 text-muted">
            No machine events received yet.
          </div>
        ) : (
          events.map((ev) => (
            <div key={ev.id} className="event-item">
              <div className="event-item-top">
                <span className={`badge ${getEventBadgeClass(ev.event_type)}`}>
                  {ev.event_type}
                </span>
                <span className="event-machine font-mono">
                  {ev.machine_code || 'LINE-01'}
                </span>
                <span className="event-time font-mono text-muted">
                  {new Date(ev.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </div>

              <div className="event-item-bottom">
                {ev.serial_number ? (
                  <span className="event-product-link">
                    Serial:{' '}
                    <button
                      className="inline-link font-mono"
                      onClick={() => onSelectProduct && onSelectProduct(ev.serial_number!)}
                    >
                      {ev.serial_number}
                    </button>
                  </span>
                ) : (
                  <span className="text-muted text-xs">General machine event</span>
                )}

                {ev.event_data && (
                  <span className="event-data-chip font-mono" title={JSON.stringify(ev.event_data)}>
                    {JSON.stringify(ev.event_data).slice(0, 32)}...
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
