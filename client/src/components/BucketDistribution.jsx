/**
 * BucketDistribution.jsx — Visualizes order counts per decision bucket.
 * Renders a Recharts horizontal bar chart with colour-coded bars,
 * plus a summary table below with bucket name, count, and percentage.
 *
 * Colour scheme:
 *   SHIP_AS_IS      -> green  (#059669)
 *   CONFIRM_VIA_WA  -> blue   (#1a56db)
 *   PREPAID_NUDGE   -> amber  (#d97706)
 *   HOLD_CANCEL     -> red    (#dc2626)
 */
import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ResponsiveContainer,
  LabelList,
} from 'recharts';

/* Human-readable labels, matching action keys, and colours */
const BUCKET_DEFINITIONS = [
  { key: 'SHIP_AS_IS', label: 'Ship As-Is', color: '#059669', altKeys: ['Ship As-Is'] },
  { key: 'SHIP_AFTER_CONFIRMATION', label: 'Ship After Confirmation', color: '#1a56db', altKeys: ['CONFIRM_VIA_WA', 'Ship After Confirmation'] },
  { key: 'NUDGE_TO_PREPAID', label: 'Nudge to Prepaid', color: '#d97706', altKeys: ['PREPAID_NUDGE', 'Nudge to Prepaid'] },
  { key: 'HOLD_CANCEL', label: 'Hold / Cancel', color: '#dc2626', altKeys: ['Hold / Cancel'] },
];

function BucketDistribution({ buckets }) {
  if (!buckets) return null;

  // Normalize buckets whether it's an Array from MongoDB or an Object
  let totalOrders = 0;
  const counts = {};

  if (Array.isArray(buckets)) {
    buckets.forEach((b) => {
      const count = b.count || 0;
      totalOrders += count;
      counts[b.action] = count;
      if (b.action_label) counts[b.action_label] = count;
    });
  } else if (typeof buckets === 'object') {
    Object.entries(buckets).forEach(([k, v]) => {
      const count = typeof v === 'number' ? v : (v?.count || v?.total || 0);
      totalOrders += count;
      counts[k] = count;
    });
  }

  /* Transform into a flat array for Recharts */
  const chartData = BUCKET_DEFINITIONS.map((def) => {
    let count = counts[def.key] ?? 0;
    if (count === 0 && def.altKeys) {
      for (const alt of def.altKeys) {
        if (counts[alt] != null) {
          count = counts[alt];
          break;
        }
      }
    }
    const pct = totalOrders > 0 ? parseFloat(((count / totalOrders) * 100).toFixed(1)) : 0;
    return {
      name: def.label,
      count,
      pct,
      color: def.color,
    };
  });

  return (
    <div className="card bucket-distribution">
      {/* Horizontal bar chart */}
      <div className="bucket-distribution__chart">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 40, left: 10, bottom: 5 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              tick={{ fontSize: 13, fill: '#374151' }}
            />
            <Tooltip
              formatter={(value, _name, props) => [
                `${value} orders (${props.payload.pct}%)`,
                'Count',
              ]}
            />
            <Bar dataKey="count" barSize={28} radius={[0, 4, 4, 0]}>
              {chartData.map((entry, idx) => (
                <Cell key={idx} fill={entry.color} />
              ))}
              <LabelList
                dataKey="count"
                position="right"
                style={{ fontSize: 12, fill: '#374151' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary table */}
      <table className="table bucket-distribution__table">
        <thead>
          <tr>
            <th>Bucket</th>
            <th>Count</th>
            <th>Percentage</th>
          </tr>
        </thead>
        <tbody>
          {chartData.map((row) => (
            <tr key={row.name}>
              <td>
                <span
                  className="color-dot"
                  style={{ backgroundColor: row.color }}
                />
                {row.name}
              </td>
              <td>{row.count}</td>
              <td>{row.pct}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default BucketDistribution;
