/**
 * backtestRoutes.js
 *
 * REST endpoint for backtesting the decision engine against the full
 * historical dataset. Accepts optional configuration overrides so
 * operators can experiment with different threshold settings.
 *
 * Routes:
 *  POST /api/backtest -- run backtest with optional config overrides
 */

const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Decision = require('../models/Decision');
const Config = require('../models/Config');
const { evaluateOrder } = require('../engine/decisionEngine');
const { calculateBacktestSummary } = require('../engine/financialCalc');
const defaultConfig = require('../config/rulesConfig');
const { getCachedOrders, hasMongoOrders } = require('../services/dashboardDataService');

/**
 * POST /api/backtest
 */
router.post('/', async (req, res, next) => {
  try {
    const { config: configOverrides, filter } = req.body || {};

    // Build the effective config: defaults < DB config < request overrides
    let config = { ...defaultConfig };
    try {
      const dbConfig = await Config.findOne({ key: 'rulesConfig' });
      if (dbConfig && dbConfig.value) {
        config = { ...config, ...dbConfig.value };
      }
    } catch (e) {}

    if (configOverrides && typeof configOverrides === 'object') {
      config = { ...config, ...configOverrides };
    }

    let orders = [];
    const isMongoReady = await hasMongoOrders();
    if (isMongoReady) {
      try {
        const query = {};
        if (filter) {
          if (filter.state) query.state = new RegExp(filter.state, 'i');
          if (filter.city) query.city = new RegExp(filter.city, 'i');
          if (filter.utm_source) query.utm_source = new RegExp(filter.utm_source, 'i');
        }
        orders = await Order.find(query).lean();
      } catch (e) {}
    }

    if (!orders || orders.length === 0) {
      const allOrders = await getCachedOrders();
      orders = allOrders.filter((o) => {
        if (!filter) return true;
        if (filter.state && !new RegExp(filter.state, 'i').test(o.state)) return false;
        if (filter.city && !new RegExp(filter.city, 'i').test(o.city)) return false;
        if (filter.utm_source && !new RegExp(filter.utm_source, 'i').test(o.utm_source)) return false;
        return true;
      });
    }

    if (orders.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          summary: { total_orders: 0, message: 'No orders found matching the filter.' },
          sample_decisions: [],
        },
      });
    }

    // Run the engine on every order
    const decisions = [];
    for (const order of orders) {
      const decision = await evaluateOrder(order, config);
      decisions.push(decision);
    }

    // Store decisions to MongoDB if available
    try {
      const bulkOps = decisions.map((d) => ({
        updateOne: {
          filter: { order_id: d.order_id },
          update: d,
          upsert: true,
        },
      }));
      if (bulkOps.length > 0 && mongoose.connection.readyState === 1) {
        await Decision.bulkWrite(bulkOps);
      }
    } catch (e) {}

    // Calculate backtest summary
    const summary = calculateBacktestSummary(decisions);

    // Return a sample of decisions (first 20) for inspection
    const sampleDecisions = decisions.slice(0, 20).map((d) => ({
      order_id: d.order_id,
      action: d.action,
      action_label: d.action_label,
      risk_score: d.risk_score,
      reason: d.reason,
      actual_status: d.actual_status,
      financial_impact: d.financial_impact,
    }));

    res.status(200).json({
      success: true,
      data: {
        summary,
        config_used: config,
        sample_decisions: sampleDecisions,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
