/**
 * Decision.js
 *
 * Mongoose model for engine decisions.  Each document records the action
 * assigned to an order, the risk score, every rule that fired, the address
 * evaluation result, and the projected financial impact.  The actual
 * final_status is stored alongside for backtest comparison.
 */

const mongoose = require('mongoose');
const { ACTIONS } = require('../utils/constants');

const decisionSchema = new mongoose.Schema(
  {
    /** Reference to the evaluated order */
    order_id: {
      type: String,
      required: true,
      index: true,
    },

    /** Engine-assigned action */
    action: {
      type: String,
      enum: Object.values(ACTIONS),
      required: true,
    },

    /** Human-readable label for the action */
    action_label: {
      type: String,
      required: true,
    },

    /** Composite risk score between 0 (safe) and 1 (high risk) */
    risk_score: {
      type: Number,
      min: 0,
      max: 1,
      required: true,
    },

    /** Plain English explanation of the decision */
    reason: {
      type: String,
      required: true,
    },

    /** List of rule identifiers that contributed to this decision */
    rules_triggered: {
      type: [String],
      default: [],
    },

    /** Detailed address evaluation result */
    address_evaluation: {
      /** Method used: 'deterministic' or 'llm' */
      method: { type: String, default: 'deterministic' },

      /** Whether the address is considered valid for delivery */
      is_valid: { type: Boolean, default: true },

      /** Address completeness classification */
      completeness: {
        type: String,
        enum: ['complete', 'landmark_only', 'gibberish'],
        default: 'complete',
      },

      /** Whether a landmark reference was detected */
      has_landmark: { type: Boolean, default: false },

      /** Free-text detail about the evaluation */
      detail: { type: String, default: '' },
    },

    /** Projected financial impact of the chosen action */
    financial_impact: {
      /** Expected gross margin if delivered */
      expected_margin: { type: Number, default: 0 },

      /** Expected cost if the order becomes RTO */
      expected_rto_cost: { type: Number, default: 0 },

      /** Net expected value of shipping the order under this action */
      net_ev: { type: Number, default: 0 },
    },

    /** Actual final status from the dataset (for backtest comparison) */
    actual_status: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Decision', decisionSchema);
