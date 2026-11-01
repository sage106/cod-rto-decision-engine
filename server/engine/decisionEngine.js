/**
 * decisionEngine.js
 *
 * Core rule engine that evaluates a single COD order and returns a
 * structured decision: which action to take, why, and what the projected
 * financial impact is.
 *
 * The rules are applied in strict priority order.  The first matching rule
 * wins.  This ensures that the most dangerous signals (repeat RTO offenders,
 * gibberish addresses) are caught before softer nudges are considered.
 *
 * RULE PRIORITY
 * -------------
 *  1. HOLD_CANCEL   -- hard blocks (prior RTO >= max, fake name, gibberish,
 *                      zero value, invalid phone)
 *  2. NUDGE_TO_PREPAID -- risk mitigation via payment conversion
 *  3. SHIP_AFTER_CONFIRMATION -- moderate risk, verify before shipping
 *  4. SHIP_AS_IS    -- everything else (low risk)
 */

const { ACTIONS, ACTION_LABELS } = require('../utils/constants');
const { isFakeName, isValidPhone, isValidPincode } = require('../utils/validators');
const { evaluateAddress } = require('./addressEvaluator');
const { calculateFinancialImpact } = require('./financialCalc');
const defaultConfig = require('../config/rulesConfig');

/**
 * Calculate a composite risk score for an order based on weighted factors.
 * Returns a value between 0 (lowest risk) and 1 (highest risk).
 *
 * @param {Object} order      - The order document.
 * @param {Object} addressEval - Result from evaluateAddress().
 * @param {Object} config     - Engine configuration.
 * @returns {number} Risk score between 0 and 1.
 */
function calculateRiskScore(order, addressEval, config) {
  const cfg = config || defaultConfig;
  let score = 0;

  // --- Factor 1: Prior RTO history (weight: 0.30) ---
  const priorRTO = order.customer_prior_rto || 0;
  if (priorRTO >= cfg.max_prior_rto) {
    score += 0.30;
  } else if (priorRTO === 1) {
    score += 0.15;
  }

  // --- Factor 2: Address quality (weight: 0.25) ---
  if (addressEval.completeness === 'gibberish') {
    score += 0.25;
  } else if (addressEval.completeness === 'landmark_only') {
    score += 0.10;
  }

  // --- Factor 3: Geographic risk (weight: 0.20) ---
  const state = (order.state || '').trim();
  const city = (order.city || '').trim();
  if (cfg.high_rto_states.includes(state)) {
    score += 0.15;
  } else if (cfg.elevated_rto_states.includes(state)) {
    score += 0.08;
  }
  if (cfg.high_rto_cities.includes(city)) {
    score += 0.05;
  }

  // --- Factor 4: Customer newness (weight: 0.10) ---
  const priorOrders = order.customer_prior_orders || 0;
  if (priorOrders === 0) {
    score += 0.10;
  }

  // --- Factor 5: Traffic source (weight: 0.10) ---
  const source = (order.utm_source || '').toLowerCase().trim();
  if (source.includes('meta') || source === 'facebook' || source === 'instagram') {
    score += 0.10;
  }

  // --- Factor 6: Name / phone validity (weight: 0.05) ---
  if (isFakeName(order.customer_name)) {
    score += 0.05;
  }
  if (!isValidPhone(order.phone)) {
    score += 0.05;
  }

  return Math.min(1, parseFloat(score.toFixed(4)));
}

/**
 * Evaluate a single order and return the engine's decision.
 *
 * @param {Object} order  - The order object (matches Order schema).
 * @param {Object} [config] - Optional configuration overrides.
 * @returns {Promise<{
 *   order_id: string,
 *   action: string,
 *   action_label: string,
 *   risk_score: number,
 *   reason: string,
 *   rules_triggered: string[],
 *   address_evaluation: Object,
 *   financial_impact: Object,
 *   actual_status: string
 * }>}
 */
async function evaluateOrder(order, config) {
  const cfg = { ...defaultConfig, ...(config || {}) };

  // Step 1: Evaluate the address
  const addressEval = await evaluateAddress(order.address, cfg);

  // Step 2: Calculate risk score
  const riskScore = calculateRiskScore(order, addressEval, cfg);

  // Collect triggered rules
  const rulesFired = [];

  // Helper variables
  const priorRTO = order.customer_prior_rto || 0;
  const priorOrders = order.customer_prior_orders || 0;
  const orderValue = order.order_value || 0;
  const state = (order.state || '').trim();
  const city = (order.city || '').trim();
  const source = (order.utm_source || '').toLowerCase().trim();
  const isNewCustomer = priorOrders === 0;
  const isMetaAds = source.includes('meta') || source === 'facebook' || source === 'instagram';

  // =====================================================================
  // RULE GROUP 1: HOLD_CANCEL
  // Hard blocks for the highest-risk signals.
  // =====================================================================

  // Rule 1.1: Repeat RTO offender
  if (priorRTO >= cfg.max_prior_rto) {
    rulesFired.push('PRIOR_RTO_EXCEEDS_MAX');
    return buildDecision(
      order,
      ACTIONS.HOLD_CANCEL,
      riskScore,
      `Order held: Customer has ${priorRTO} prior RTO returns, indicating a pattern of non-delivery.`,
      rulesFired,
      addressEval,
      cfg
    );
  }

  // Rule 1.2: Fake / test name
  if (isFakeName(order.customer_name)) {
    rulesFired.push('FAKE_NAME_DETECTED');
    return buildDecision(
      order,
      ACTIONS.HOLD_CANCEL,
      riskScore,
      `Order held: Customer name "${order.customer_name}" appears to be fake or a test entry.`,
      rulesFired,
      addressEval,
      cfg
    );
  }

  // Rule 1.3: Gibberish address
  if (addressEval.completeness === 'gibberish') {
    rulesFired.push('GIBBERISH_ADDRESS');
    return buildDecision(
      order,
      ACTIONS.HOLD_CANCEL,
      riskScore,
      `Order held: Address "${order.address}" is a placeholder or gibberish and cannot be delivered.`,
      rulesFired,
      addressEval,
      cfg
    );
  }

  // Rule 1.4: Zero or negative order value
  if (orderValue <= 0) {
    rulesFired.push('ZERO_ORDER_VALUE');
    return buildDecision(
      order,
      ACTIONS.HOLD_CANCEL,
      riskScore,
      'Order held: Order value is zero or negative, suggesting a test or fraudulent order.',
      rulesFired,
      addressEval,
      cfg
    );
  }

  // Rule 1.5: Invalid phone number
  if (!isValidPhone(order.phone)) {
    rulesFired.push('INVALID_PHONE');
    return buildDecision(
      order,
      ACTIONS.HOLD_CANCEL,
      riskScore,
      `Order held: Phone number "${order.phone}" is not a valid 10-digit Indian mobile number.`,
      rulesFired,
      addressEval,
      cfg
    );
  }

  // =====================================================================
  // RULE GROUP 2: NUDGE_TO_PREPAID
  // Medium-high risk orders where converting to prepaid mitigates loss.
  // =====================================================================

  // Rule 2.1: High-value order from a new customer
  if (orderValue >= cfg.high_value_threshold && isNewCustomer) {
    rulesFired.push('HIGH_VALUE_NEW_CUSTOMER');
    return buildDecision(
      order,
      ACTIONS.NUDGE_TO_PREPAID,
      riskScore,
      `Prepaid nudge recommended: High-value order (Rs.${orderValue}) from a first-time customer.`,
      rulesFired,
      addressEval,
      cfg
    );
  }

  // Rule 2.2: Mid-value order from a high-RTO city
  if (orderValue >= cfg.mid_value_threshold && cfg.high_rto_cities.includes(city)) {
    rulesFired.push('MID_VALUE_HIGH_RTO_CITY');
    return buildDecision(
      order,
      ACTIONS.NUDGE_TO_PREPAID,
      riskScore,
      `Prepaid nudge recommended: Order value Rs.${orderValue} shipping to ${city}, a high-RTO city.`,
      rulesFired,
      addressEval,
      cfg
    );
  }

  // Rule 2.3: Repeat customer with exactly 1 prior RTO
  if (!isNewCustomer && priorRTO === 1) {
    rulesFired.push('REPEAT_CUSTOMER_ONE_PRIOR_RTO');
    return buildDecision(
      order,
      ACTIONS.NUDGE_TO_PREPAID,
      riskScore,
      `Prepaid nudge recommended: Returning customer with 1 prior RTO. Prepaid reduces risk for both parties.`,
      rulesFired,
      addressEval,
      cfg
    );
  }

  // =====================================================================
  // RULE GROUP 3: SHIP_AFTER_CONFIRMATION
  // Moderate risk -- verify order intent before dispatching.
  // =====================================================================

  // Rule 3.1: New customer from Meta Ads in a high-RTO state
  if (isNewCustomer && isMetaAds && cfg.high_rto_states.includes(state)) {
    rulesFired.push('NEW_META_ADS_HIGH_RTO_STATE');
    return buildDecision(
      order,
      ACTIONS.SHIP_AFTER_CONFIRMATION,
      riskScore,
      `Confirmation required: New customer from Meta Ads in ${state}, a high-RTO state.`,
      rulesFired,
      addressEval,
      cfg
    );
  }

  // Rule 3.2: Landmark-only address (needs confirmation the address is reachable)
  if (addressEval.completeness === 'landmark_only') {
    rulesFired.push('LANDMARK_ONLY_ADDRESS');
    return buildDecision(
      order,
      ACTIONS.SHIP_AFTER_CONFIRMATION,
      riskScore,
      `Confirmation required: Address uses landmark-based directions only. Verifying deliverability with customer.`,
      rulesFired,
      addressEval,
      cfg
    );
  }

  // Rule 3.3: Elevated-RTO state + new customer
  if (isNewCustomer && cfg.elevated_rto_states.includes(state)) {
    rulesFired.push('NEW_CUSTOMER_ELEVATED_RTO_STATE');
    return buildDecision(
      order,
      ACTIONS.SHIP_AFTER_CONFIRMATION,
      riskScore,
      `Confirmation required: First-time customer in ${state}, which has an elevated RTO rate.`,
      rulesFired,
      addressEval,
      cfg
    );
  }

  // =====================================================================
  // RULE GROUP 4: SHIP_AS_IS
  // Low risk -- ship immediately.
  // =====================================================================

  rulesFired.push('DEFAULT_SHIP');
  const priorOrdersDesc = priorOrders > 0
    ? `Repeat customer with ${priorOrders} prior orders, ${priorRTO} returns`
    : 'New customer with no risk signals detected';
  const addressDesc = addressEval.completeness === 'complete' ? 'a complete address' : 'an acceptable address';
  const cityDesc = city || 'unknown city';

  return buildDecision(
    order,
    ACTIONS.SHIP_AS_IS,
    riskScore,
    `Ship as-is: ${priorOrdersDesc}, and ${addressDesc} in ${cityDesc}.`,
    rulesFired,
    addressEval,
    cfg
  );
}

/**
 * Assemble the final decision object with financial impact calculation.
 *
 * @param {Object}   order       - The order document.
 * @param {string}   action      - One of the ACTIONS enum values.
 * @param {number}   riskScore   - Composite risk score.
 * @param {string}   reason      - Plain English explanation.
 * @param {string[]} rules       - List of triggered rule identifiers.
 * @param {Object}   addressEval - Address evaluation result.
 * @param {Object}   cfg         - Engine configuration.
 * @returns {Object} Complete decision object.
 */
function buildDecision(order, action, riskScore, reason, rules, addressEval, cfg) {
  const financialImpact = calculateFinancialImpact(
    action,
    order.order_value || 0,
    riskScore
  );

  return {
    order_id: order.order_id,
    action,
    action_label: ACTION_LABELS[action],
    bucket: ACTION_LABELS[action],
    risk_score: riskScore,
    reason,
    rules_triggered: rules,
    address_evaluation: addressEval,
    financial_impact: financialImpact,
    actual_status: order.final_status || '',
  };
}

module.exports = {
  evaluateOrder,
  calculateRiskScore,
};
