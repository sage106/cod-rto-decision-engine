/**
 * rulesConfig.js
 *
 * Default configuration for the decision engine's rule thresholds.
 * These values can be overridden at runtime via the Config API
 * (stored in MongoDB) or passed directly into the backtest endpoint.
 *
 * Every threshold here is calibrated against the 2,018-order dataset.
 */

const defaultConfig = {
  /** Maximum prior RTOs before an order is held/cancelled */
  max_prior_rto: 2,

  /** Order value (INR) above which prepaid nudge is triggered for new customers */
  high_value_threshold: 1800,

  /** Order value (INR) above which prepaid nudge is triggered for high-RTO cities */
  mid_value_threshold: 1200,

  /** States with RTO rates significantly above the 28.41% baseline */
  high_rto_states: ['Bihar', 'Uttar Pradesh'],

  /** Cities with RTO rates above 45% */
  high_rto_cities: ['Gorakhpur', 'Bareilly', 'Darbhanga', 'Sagar', 'Patna', 'Madhubani'],

  /** States with moderately elevated RTO rates (35-40%) */
  elevated_rto_states: ['Madhya Pradesh', 'Assam'],

  /**
   * Words and phrases that indicate a fake / placeholder address.
   * Hinglish landmarks are deliberately excluded.
   */
  gibberish_words: ['.', 'xyz', 'home', 'call me', 'near station', 'na', 'test', 'abc', 'address'],

  /** Minimum acceptable address length in characters */
  min_address_length: 5,

  /** Discount (INR) offered when nudging towards prepaid */
  prepaid_discount: 50,

  /** Hours to wait for address/order confirmation before timeout */
  confirmation_timeout_hours: 24,

  /** Hours to wait for prepaid payment before falling back to COD */
  prepaid_nudge_timeout_hours: 2,

  /** Whether to use LLM-based address evaluation (false = deterministic only) */
  llm_enabled: false,
};

module.exports = defaultConfig;
