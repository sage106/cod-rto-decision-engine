/**
 * financialCalc.js
 *
 * Pure mathematical functions for unit economics calculations.
 * None of these functions touch the database or perform I/O -- they are
 * deterministic and side-effect-free, making them easy to test and reuse.
 *
 * All monetary values are in INR.
 */

const {
  GROSS_MARGIN_PER_ORDER,
  RTO_COST_PER_ORDER,
  BREAK_EVEN_DELIVERY_PROB,
  PREPAID_SAVINGS,
  PREPAID_NET_GAIN,
  GROSS_MARGIN_PCT,
  ACTIONS,
} = require('../utils/constants');

/**
 * Total cost incurred when an order becomes RTO.
 * Forward shipping + return shipping + packaging + damage.
 *
 * @returns {number} 169.40
 */
function rtoCostPerOrder() {
  return RTO_COST_PER_ORDER;
}

/**
 * Gross margin earned on a delivered order at the average order value.
 *
 * @returns {number} 402.38
 */
function grossMarginPerOrder() {
  return GROSS_MARGIN_PER_ORDER;
}

/**
 * Minimum delivery probability at which shipping breaks even.
 * Below this threshold, the expected value of shipping is negative.
 *
 * @returns {number} 0.2963
 */
function breakEvenDeliveryProb() {
  return BREAK_EVEN_DELIVERY_PROB;
}

/**
 * Total cost saved when a customer converts from COD to prepaid.
 * Includes avoided RTO logistics cost and COD collection fee.
 *
 * @returns {number} 70.65
 */
function prepaidSavings() {
  return PREPAID_SAVINGS;
}

/**
 * Net gain after offering the prepaid discount.
 * prepaidSavings() minus the discount amount.
 *
 * @returns {number} 20.65
 */
function prepaidNetGain() {
  return PREPAID_NET_GAIN;
}

/**
 * Calculate the expected value of shipping a single order given
 * the estimated probability that it will be delivered (not RTO).
 *
 * EV = P(deliver) * gross_margin - P(rto) * rto_cost
 *
 * @param {number} deliveryProbability - Probability of successful delivery (0 to 1).
 * @returns {number} Expected value in INR (positive = profitable to ship).
 */
function orderExpectedValue(deliveryProbability) {
  const p = Math.max(0, Math.min(1, deliveryProbability));
  return p * GROSS_MARGIN_PER_ORDER - (1 - p) * RTO_COST_PER_ORDER;
}

/**
 * Calculate the projected financial impact of a given engine action
 * on a specific order.
 *
 * @param {string} action     - One of the ACTIONS enum values.
 * @param {number} orderValue - The order value in INR.
 * @param {number} riskScore  - The computed risk score (0 to 1, higher = riskier).
 * @returns {{ expected_margin: number, expected_rto_cost: number, net_ev: number }}
 */
function calculateFinancialImpact(action, orderValue, riskScore) {
  const grossMargin = orderValue * GROSS_MARGIN_PCT;
  const deliveryProb = Math.max(0, 1 - riskScore);

  switch (action) {
    case ACTIONS.HOLD_CANCEL:
      // We do not ship, so we avoid both margin and RTO cost.
      // The "cost" is the lost margin on orders that would have delivered.
      return {
        expected_margin: 0,
        expected_rto_cost: 0,
        net_ev: -(deliveryProb * grossMargin), // opportunity cost
      };

    case ACTIONS.NUDGE_TO_PREPAID: {
      // If the customer converts, we save COD fees and RTO risk.
      // Assume ~30% conversion rate for estimation.
      const conversionRate = 0.3;
      const evIfConverted = grossMargin - 50; // after discount
      const evIfNotConverted = deliveryProb * grossMargin - (1 - deliveryProb) * RTO_COST_PER_ORDER;
      return {
        expected_margin: parseFloat((conversionRate * evIfConverted + (1 - conversionRate) * deliveryProb * grossMargin).toFixed(2)),
        expected_rto_cost: parseFloat(((1 - conversionRate) * (1 - deliveryProb) * RTO_COST_PER_ORDER).toFixed(2)),
        net_ev: parseFloat((conversionRate * evIfConverted + (1 - conversionRate) * evIfNotConverted).toFixed(2)),
      };
    }

    case ACTIONS.SHIP_AFTER_CONFIRMATION: {
      // Confirmation filters out ~40% of would-be RTOs (estimated).
      const adjustedDeliveryProb = Math.min(1, deliveryProb + (1 - deliveryProb) * 0.4);
      return {
        expected_margin: parseFloat((adjustedDeliveryProb * grossMargin).toFixed(2)),
        expected_rto_cost: parseFloat(((1 - adjustedDeliveryProb) * RTO_COST_PER_ORDER).toFixed(2)),
        net_ev: parseFloat((adjustedDeliveryProb * grossMargin - (1 - adjustedDeliveryProb) * RTO_COST_PER_ORDER).toFixed(2)),
      };
    }

    case ACTIONS.SHIP_AS_IS:
    default:
      return {
        expected_margin: parseFloat((deliveryProb * grossMargin).toFixed(2)),
        expected_rto_cost: parseFloat(((1 - deliveryProb) * RTO_COST_PER_ORDER).toFixed(2)),
        net_ev: parseFloat((deliveryProb * grossMargin - (1 - deliveryProb) * RTO_COST_PER_ORDER).toFixed(2)),
      };
  }
}

/**
 * Compute aggregate financial summary from an array of decision documents.
 * Used by the backtest endpoint to report overall impact.
 *
 * @param {Array<Object>} decisions - Array of decision objects with financial_impact and actual_status fields.
 * @returns {Object} Aggregated summary with totals, averages, and accuracy metrics.
 */
function calculateBacktestSummary(decisions) {
  const summary = {
    total_orders: decisions.length,
    bucket_distribution: {},
    total_expected_margin: 0,
    total_expected_rto_cost: 0,
    total_net_ev: 0,
    true_positives: 0,   // HOLD_CANCEL that were actually RTO
    false_positives: 0,  // HOLD_CANCEL that were actually DELIVERED
    true_negatives: 0,   // SHIP_AS_IS that were actually DELIVERED
    false_negatives: 0,  // SHIP_AS_IS that were actually RTO
    estimated_savings: 0,
    estimated_losses: 0,
    net_impact: 0,
  };

  for (const d of decisions) {
    // Count bucket distribution
    if (!summary.bucket_distribution[d.action]) {
      summary.bucket_distribution[d.action] = { count: 0, percentage: 0 };
    }
    summary.bucket_distribution[d.action].count += 1;

    // Sum financial impacts
    if (d.financial_impact) {
      summary.total_expected_margin += d.financial_impact.expected_margin || 0;
      summary.total_expected_rto_cost += d.financial_impact.expected_rto_cost || 0;
      summary.total_net_ev += d.financial_impact.net_ev || 0;
    }

    const wasRTO = d.actual_status === 'RTO';
    const wasDelivered = d.actual_status === 'DELIVERED';

    // Accuracy metrics (HOLD_CANCEL as positive prediction, i.e. "predicted RTO")
    if (d.action === 'HOLD_CANCEL') {
      if (wasRTO) {
        summary.true_positives += 1;
        // Saved the RTO cost by not shipping
        summary.estimated_savings += RTO_COST_PER_ORDER;
      } else if (wasDelivered) {
        summary.false_positives += 1;
        // Lost margin by blocking a good order
        const margin = (d.financial_impact && d.financial_impact.expected_margin)
          ? d.financial_impact.expected_margin
          : GROSS_MARGIN_PER_ORDER;
        summary.estimated_losses += margin;
      }
    } else if (d.action === 'SHIP_AS_IS') {
      if (wasDelivered) {
        summary.true_negatives += 1;
      } else if (wasRTO) {
        summary.false_negatives += 1;
      }
    }
  }

  // Calculate percentages
  for (const action of Object.keys(summary.bucket_distribution)) {
    summary.bucket_distribution[action].percentage = parseFloat(
      ((summary.bucket_distribution[action].count / summary.total_orders) * 100).toFixed(2)
    );
  }

  // Round financial totals
  summary.total_expected_margin = parseFloat(summary.total_expected_margin.toFixed(2));
  summary.total_expected_rto_cost = parseFloat(summary.total_expected_rto_cost.toFixed(2));
  summary.total_net_ev = parseFloat(summary.total_net_ev.toFixed(2));
  summary.estimated_savings = parseFloat(summary.estimated_savings.toFixed(2));
  summary.estimated_losses = parseFloat(summary.estimated_losses.toFixed(2));
  summary.net_impact = parseFloat((summary.estimated_savings - summary.estimated_losses).toFixed(2));

  return summary;
}

module.exports = {
  rtoCostPerOrder,
  grossMarginPerOrder,
  breakEvenDeliveryProb,
  prepaidSavings,
  prepaidNetGain,
  orderExpectedValue,
  calculateFinancialImpact,
  calculateBacktestSummary,
};
