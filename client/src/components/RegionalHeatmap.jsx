/**
 * RegionalHeatmap.jsx — Tabular breakdowns for regional, UTM-source,
 * and courier data.  Each table shows counts, RTO rates, and a
 * colour-coded risk level badge.
 *
 * Risk bands:
 *   Low      < 25%   (green)
 *   Moderate 25-40%  (amber)
 *   High     > 40%   (red)
 */
import React from 'react';

/** Determine the risk level label and CSS class from an RTO rate. */
function riskLevel(rtoRate) {
  if (rtoRate > 40) return { label: 'High', className: 'badge badge--danger' };
  if (rtoRate >= 25) return { label: 'Moderate', className: 'badge badge--warning' };
  return { label: 'Low', className: 'badge badge--success' };
}

/** Generic breakdown table used for all three data sets. */
function BreakdownTable({ rows, nameKey, nameLabel }) {
  if (!rows || rows.length === 0) return <p className="muted-text">No data available.</p>;

  /* Sort by RTO rate descending */
  const sorted = [...rows].sort((a, b) => b.rto_rate - a.rto_rate);

  return (
    <table className="table">
      <thead>
        <tr>
          <th>{nameLabel}</th>
          <th>Orders</th>
          <th>RTO Rate (%)</th>
          <th>Risk Level</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((row, idx) => {
          const risk = riskLevel(row.rto_rate);
          return (
            <tr key={idx}>
              <td>{row[nameKey] || row._id || 'Unknown'}</td>
              <td>{row.count ?? row.total ?? 0}</td>
              <td>{typeof row.rto_rate === 'number' ? row.rto_rate.toFixed(1) : (row.rto_rate || '--')}</td>
              <td>
                <span className={risk.className}>{risk.label}</span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function RegionalHeatmap({ regionalData, sourceData, courierData }) {
  return (
    <div className="card regional-heatmap">
      {/* State-level breakdown */}
      <h3 className="subsection-heading">By State</h3>
      <BreakdownTable rows={regionalData} nameKey="state" nameLabel="State" />

      {/* UTM Source breakdown */}
      <h3 className="subsection-heading" style={{ marginTop: 24 }}>
        By UTM Source
      </h3>
      <BreakdownTable rows={sourceData} nameKey="utm_source" nameLabel="UTM Source" />

      {/* Courier breakdown */}
      <h3 className="subsection-heading" style={{ marginTop: 24 }}>
        By Courier
      </h3>
      <BreakdownTable rows={courierData} nameKey="courier" nameLabel="Courier" />
    </div>
  );
}

export default RegionalHeatmap;
