/**
 * KPICards.jsx — Displays four key metric cards in a horizontal row.
 * Each card has a colored left border, a label, a large value,
 * and an optional subtitle for context.
 *
 * Cards:
 *   1. Total COD Orders   (blue)
 *   2. Estimated Savings   (green)
 *   3. Potential Risk       (amber)
 *   4. Net Impact           (green/red dynamic)
 */
import React from 'react';

/**
 * Format a number using the Indian comma system.
 * e.g. 123456 -> "1,23,456"
 */
function formatIndian(num) {
  if (num == null) return '--';
  const n = Math.round(Number(num));
  const str = Math.abs(n).toString();
  if (str.length <= 3) return (n < 0 ? '-' : '') + str;

  /* Last three digits */
  let result = str.slice(-3);
  let remaining = str.slice(0, -3);

  /* Group remaining digits in pairs from the right */
  while (remaining.length > 2) {
    result = remaining.slice(-2) + ',' + result;
    remaining = remaining.slice(0, -2);
  }
  if (remaining.length > 0) {
    result = remaining + ',' + result;
  }

  return (n < 0 ? '-' : '') + result;
}

function KPICards({ totals }) {
  if (!totals) return null;

  const totalOrders = totals.total_orders || 0;
  const totalValue = totals.total_value != null ? totals.total_value : totalOrders * 649;
  const savings = totals.estimated_savings != null ? totals.estimated_savings : (totals.total_expected_rto_cost || 0);
  const losses = totals.estimated_losses != null ? totals.estimated_losses : ((totals.total_expected_margin || 0) * 0.05);
  const net = totals.net_impact != null ? totals.net_impact : (savings - losses);

  const cards = [
    {
      label: 'Total COD Orders',
      value: formatIndian(totalOrders),
      subtitle: `Rs. ${formatIndian(totalValue)} total order value`,
      accent: 'var(--color-primary)',
    },
    {
      label: 'Estimated Savings',
      value: `Rs. ${formatIndian(savings)}`,
      subtitle: 'Avoided RTO costs',
      accent: 'var(--color-success)',
    },
    {
      label: 'Potential Risk',
      value: `Rs. ${formatIndian(losses)}`,
      subtitle: 'Possible false-positive impact',
      accent: 'var(--color-warning)',
    },
    {
      label: 'Net Impact',
      value: `Rs. ${formatIndian(net)}`,
      subtitle: net >= 0 ? 'Net positive outcome' : 'Net negative outcome',
      accent: net >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
    },
  ];

  return (
    <div className="kpi-cards">
      {cards.map((card) => (
        <div
          className="kpi-card"
          key={card.label}
          style={{ borderLeftColor: card.accent }}
        >
          <span className="kpi-card__label">{card.label}</span>
          <span className="kpi-card__value" style={{ color: card.accent }}>
            {card.value}
          </span>
          <span className="kpi-card__subtitle">{card.subtitle}</span>
        </div>
      ))}
    </div>
  );
}

export default KPICards;
