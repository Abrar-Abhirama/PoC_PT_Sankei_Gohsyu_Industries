import React, { useState } from 'react';
import { ProductItem } from '../types';

interface TraceabilitySearchProps {
  onSearch: (serialNumber: string) => void;
  recentProducts: ProductItem[];
  searching: boolean;
}

export const TraceabilitySearch: React.FC<TraceabilitySearchProps> = ({
  onSearch,
  recentProducts,
  searching,
}) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  const handleQuickSelect = (serial: string) => {
    setQuery(serial);
    onSearch(serial);
  };

  return (
    <div className="card search-card">
      <div className="search-header">
        <div>
          <h3 className="search-title">🔎 Product Traceability Search</h3>
          <p className="search-desc">
            Enter a product serial number to inspect its complete chronological lifecycle history.
          </p>
        </div>
      </div>

      <form className="search-form" onSubmit={handleSubmit}>
        <div className="search-input-wrapper">
          <span className="search-prefix font-mono">QR:</span>
          <input
            type="text"
            className="search-input font-mono"
            placeholder="e.g. QR-20260908-000019"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="search-submit-btn"
          disabled={!query.trim() || searching}
        >
          {searching ? 'Searching...' : 'Inspect Traceability'}
        </button>
      </form>

      {/* Quick Select Chips from recently inspected products */}
      {recentProducts.length > 0 && (
        <div className="quick-tags-container">
          <span className="quick-tags-label">Quick select recent:</span>
          <div className="quick-tags-list">
            {recentProducts.slice(0, 5).map((p) => (
              <button
                key={p.id}
                type="button"
                className={`quick-tag-chip font-mono chip--${p.status.toLowerCase()}`}
                onClick={() => handleQuickSelect(p.serial_number)}
              >
                {p.serial_number}
                <span className="chip-status">({p.status})</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
