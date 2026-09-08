import React from 'react';
import { BarcodeResultItem, PaginationInfo } from '../types';

interface RecentResultsTableProps {
  results: BarcodeResultItem[];
  loading: boolean;
  apiError?: string | null;
  onRetry?: () => void;
  pagination: PaginationInfo;
  onPageChange: (newPage: number) => void;
  pageSize: number;
  onPageSizeChange: (newPageSize: number) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  searchQuery: string;
  onSearchChange: (search: string) => void;
}

export const RecentResultsTable: React.FC<RecentResultsTableProps> = ({
  results,
  loading,
  apiError,
  onRetry,
  pagination,
  onPageChange,
  pageSize,
  onPageSizeChange,
  statusFilter,
  onStatusFilterChange,
  searchQuery,
  onSearchChange,
}) => {
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OK':
        return <span className="badge badge--success">OK</span>;
      case 'NG':
        return <span className="badge badge--error">NG</span>;
      case 'PROCESSING':
        return <span className="badge badge--info">PROCESSING</span>;
      case 'PENDING':
        return <span className="badge badge--warning">PENDING</span>;
      default:
        return <span className="badge font-mono">{status}</span>;
    }
  };

  // Calculate entry range shown
  const startItem = pagination.total === 0 ? 0 : (pagination.page - 1) * pageSize + 1;
  const endItem = Math.min(pagination.page * pageSize, pagination.total);

  // Generate pagination buttons window (max 5 visible buttons)
  const generatePageNumbers = () => {
    const totalPages = pagination.totalPages || 1;
    const current = pagination.page;
    const pages: (number | string)[] = [];

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (current > 3) pages.push('...');
      
      const start = Math.max(2, current - 1);
      const end = Math.min(totalPages - 1, current + 1);
      for (let i = start; i <= end; i++) pages.push(i);

      if (current < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }

    return pages;
  };

  const statusOptions = [
    { label: 'All Status', value: 'ALL' },
    { label: 'OK', value: 'OK' },
    { label: 'NG', value: 'NG' },
    { label: 'PROCESSING', value: 'PROCESSING' },
    { label: 'PENDING', value: 'PENDING' },
  ];

  return (
    <div className="card table-card">
      {/* Card Header */}
      <div className="card-header-row" style={{ flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
        <div>
          <h3 className="card-heading">📋 Machine Barcode Log & Traceability</h3>
          <p className="card-subheading">
            Live sequential log of all barcodes in PostgreSQL ({pagination.total} total items)
          </p>
        </div>

        {/* Filter Controls Toolbar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', alignItems: 'center' }}>
          {/* Barcode Search Box */}
          <div className="table-search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search barcode..."
              value={searchQuery}
              onChange={(e) => {
                onSearchChange(e.target.value);
                onPageChange(1);
              }}
              className="table-search-input font-mono"
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => {
                  onSearchChange('');
                  onPageChange(1);
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Filter Chips */}
          <div className="status-filter-group">
            {statusOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`status-chip ${statusFilter === opt.value ? 'status-chip--active' : ''}`}
                onClick={() => {
                  onStatusFilterChange(opt.value);
                  onPageChange(1);
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="table-responsive">
        <table className="custom-table">
          <thead>
            <tr>
              <th style={{ width: '80px' }}>ID</th>
              <th>Barcode</th>
              <th>Status</th>
              <th>Time</th>
              <th>Machine</th>
              <th style={{ textAlign: 'right' }}>Full Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {loading && results.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-6">
                  <span className="spinner" /> Loading barcode results from backend...
                </td>
              </tr>
            ) : apiError && results.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-6">
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ color: '#fca5a5', fontSize: '0.9rem' }}>
                      ⚠️ Unable to load barcode results: {apiError}
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
                <td colSpan={6} className="text-center py-6 text-muted font-mono">
                  {searchQuery || statusFilter !== 'ALL'
                    ? 'No barcodes found matching the current filter / search query.'
                    : 'No barcodes processed yet. Waiting for C# IPC Gateway and PLC Simulator...'}
                </td>
              </tr>
            ) : (
              results.map((item) => (
                <tr key={item.id} className="table-row">
                  <td className="font-mono text-muted">#{item.id}</td>
                  <td className="font-mono font-semibold text-cyan" style={{ fontSize: '0.95rem' }}>
                    {item.barcode}
                  </td>
                  <td>{getStatusBadge(item.status)}</td>
                  <td className="font-mono font-medium" style={{ fontSize: '0.9rem' }}>
                    {formatTime(item.updatedAt || item.createdAt)}
                  </td>
                  <td className="font-mono text-muted text-xs">
                    {item.machineId || 'MACHINE-01'}
                  </td>
                  <td className="font-mono text-muted text-xs" style={{ textAlign: 'right' }}>
                    {item.updatedAt
                      ? new Date(item.updatedAt).toLocaleString()
                      : new Date(item.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="table-pagination-footer">
        {/* Left: Entries Info & Page Size */}
        <div className="pagination-info-group">
          <span className="pagination-text font-mono">
            Showing <strong>{startItem}</strong>–<strong>{endItem}</strong> of <strong>{pagination.total}</strong> barcodes
          </span>

          <div className="page-size-selector font-mono">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="page-select"
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>per page</span>
          </div>
        </div>

        {/* Right: Page Navigation Controls */}
        <div className="pagination-nav">
          <button
            type="button"
            className="page-btn page-btn-nav"
            disabled={pagination.page <= 1}
            onClick={() => onPageChange(1)}
            title="First Page"
          >
            ⏮ First
          </button>
          <button
            type="button"
            className="page-btn page-btn-nav"
            disabled={pagination.page <= 1}
            onClick={() => onPageChange(pagination.page - 1)}
            title="Previous Page"
          >
            ◀ Prev
          </button>

          {/* Page Pills */}
          <div className="page-pills font-mono">
            {generatePageNumbers().map((p, idx) =>
              typeof p === 'number' ? (
                <button
                  key={p}
                  type="button"
                  className={`page-pill ${p === pagination.page ? 'page-pill--active' : ''}`}
                  onClick={() => onPageChange(p)}
                >
                  {p}
                </button>
              ) : (
                <span key={`dots-${idx}`} className="page-ellipsis">
                  …
                </span>
              )
            )}
          </div>

          <button
            type="button"
            className="page-btn page-btn-nav"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => onPageChange(pagination.page + 1)}
            title="Next Page"
          >
            Next ▶
          </button>
          <button
            type="button"
            className="page-btn page-btn-nav"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => onPageChange(pagination.totalPages)}
            title="Last Page"
          >
            Last ⏭
          </button>
        </div>
      </div>
    </div>
  );
};
