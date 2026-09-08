import React from 'react';
import { ProductItem } from '../types';

interface RecentResultsTableProps {
  products: ProductItem[];
  onSelectProduct: (serialNumber: string) => void;
  loading: boolean;
}

export const RecentResultsTable: React.FC<RecentResultsTableProps> = ({
  products,
  onSelectProduct,
  loading,
}) => {
  return (
    <div className="card table-card">
      <div className="card-header-row">
        <div>
          <h3 className="card-heading">📦 Recent Production Results</h3>
          <p className="card-subheading">Latest products processed and marked on the line</p>
        </div>
        <span className="count-pill font-mono">{products.length} records</span>
      </div>

      <div className="table-responsive">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Serial Number</th>
              <th>Order</th>
              <th>Result Status</th>
              <th>Timestamp</th>
              <th style={{ textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && products.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-6">
                  <span className="spinner" /> Loading products...
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-6 text-muted">
                  No products recorded yet. Run a production cycle to see results.
                </td>
              </tr>
            ) : (
              products.map((prod) => (
                <tr key={prod.id} className="table-row">
                  <td className="font-mono font-medium text-cyan">
                    {prod.serial_number}
                  </td>
                  <td className="font-mono text-muted">
                    {prod.order_number || `PO-${prod.production_order_id}`}
                  </td>
                  <td>
                    <span
                      className={`badge badge--${
                        prod.status === 'PASS'
                          ? 'success'
                          : prod.status === 'FAIL'
                          ? 'error'
                          : 'warning'
                      }`}
                    >
                      {prod.status}
                    </span>
                  </td>
                  <td className="font-mono text-muted text-xs">
                    {new Date(prod.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="table-action-btn font-mono"
                      onClick={() => onSelectProduct(prod.serial_number)}
                      title="Inspect full traceability"
                    >
                      Inspect →
                    </button>
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
