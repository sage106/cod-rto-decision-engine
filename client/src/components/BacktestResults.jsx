/**
 * BacktestResults.jsx — Displays the output of a backtest run.
 * Shows:
 *   - Summary line (total orders evaluated)
 *   - Bucket-level table with counts, percentages, and actual RTO/delivered splits
 *   - Financial summary cards (avoided cost, lost margin, net impact)
 *   - Accuracy metrics for the Hold/Cancel bucket
 */
import React from 'react';

/**
 * Format a number using the Indian comma system.
 */
function formatIndian(num) {
  if (num == null) return '--';
  const n = Math.round(Number(num));
  const str = Math.abs(n).toString();
  if (str.length <= 3) return (n < 0 ? '-' : '') + str;
  let result = str.slice(-3);
  let remaining = str.slice(0, -3);
  while (remaining.length > 2) {
    result = remaining.slice(-2) + ',' + result;
    remaining = remaining.slice(0, -2);
  }
  if (remaining.length > 0) result = remaining + ',' + result;
  return (n < 0 ? '-' : '') + result;
}

function BacktestResults({ results }) {
  if (!results) return null;

  const summary = results.summary || results.data?.summary || results;
  const total_orders = summary.total_orders;
  const buckets = summary.bucket_distribution || summary.buckets || {};
  const financials = summary.financials || {
    avoided_rto_cost: summary.estimated_savings,
    lost_margin: summary.estimated_losses,
    net_impact: summary.net_impact,
  };
  const accuracy = summary.accuracy || {
    hold_cancel_precision: (summary.true_positives != null && (summary.true_positives + summary.false_positives) > 0)
      ? parseFloat(((summary.true_positives / (summary.true_positives + summary.false_positives)) * 100).toFixed(1))
      : null,
  };

  /* Build bucket rows array for the table */
  const bucketRows = Object.entries(buckets).map(([key, data]) => ({
    key,
    label: data.label || key,
    count: data.count,
    pct: data.pct != null ? data.pct : data.percentage,
    actual_rto: data.actual_rto != null ? data.actual_rto : (data.rto ?? '--'),
    actual_delivered: data.actual_delivered != null ? data.actual_delivered : (data.delivered ?? '--'),
  }));

  return (
    <div className="backtest-results">
      <h3 className="subsection-heading">Backtest Results</h3>

      {/* Summary line */}
      <p className="backtest-summary">
        Backtest evaluated <strong>{total_orders ?? '--'}</strong> orders.
      </p>

      {/* Bucket breakdown table */}
      {bucketRows.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>Bucket</th>
              <th>Count</th>
              <th>Percentage</th>
              <th>Actual RTO</th>
              <th>Actual Delivered</th>
            </tr>
          </thead>
          <tbody>
            {bucketRows.map((row) => (
              <tr key={row.key}>
                <td>{row.label || row.key}</td>
                <td>{row.count ?? '--'}</td>
                <td>{row.pct != null ? `${row.pct}%` : '--'}</td>
                <td>{row.actual_rto ?? '--'}</td>
                <td>{row.actual_delivered ?? '--'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Financial summary cards */}
      {financials && (
        <div className="backtest-financials">
          <div className="backtest-fin-card backtest-fin-card--success">
            <span className="backtest-fin-label">Total Avoided RTO Cost</span>
            <span className="backtest-fin-value">
              Rs. {formatIndian(financials.avoided_rto_cost)}
            </span>
          </div>
          <div className="backtest-fin-card backtest-fin-card--warning">
            <span className="backtest-fin-label">Potential Lost Margin</span>
            <span className="backtest-fin-value">
              Rs. {formatIndian(financials.lost_margin)}
            </span>
          </div>
          <div
            className={`backtest-fin-card ${
              (financials.net_impact ?? 0) >= 0
                ? 'backtest-fin-card--success'
                : 'backtest-fin-card--danger'
            }`}
          >
            <span className="backtest-fin-label">Net Financial Impact</span>
            <span className="backtest-fin-value">
              Rs. {formatIndian(financials.net_impact)}
            </span>
          </div>
        </div>
      )}

      {/* Accuracy metrics */}
      {accuracy && (
        <div className="backtest-accuracy">
          <h4 className="subsection-heading">Accuracy Metrics</h4>
          {accuracy.hold_cancel_precision != null && (
            <p>
              Of orders flagged Hold/Cancel,{' '}
              <strong>{accuracy.hold_cancel_precision}%</strong> were actually
              RTO (correct).
            </p>
          )}
          {accuracy.confirmation_effectiveness != null && (
            <p>
              Confirmation flow effectiveness:{' '}
              <strong>{accuracy.confirmation_effectiveness}%</strong>.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default BacktestResults;
