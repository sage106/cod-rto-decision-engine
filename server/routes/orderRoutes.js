/**
 * orderRoutes.js
 *
 * REST endpoints for order evaluation and retrieval.
 *
 * Routes:
 *  POST /api/orders/evaluate -- evaluate a single order through the engine
 *  GET  /api/orders/:id      -- fetch an order and its decision
 *  GET  /api/orders          -- list orders with optional filters
 */

const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Decision = require('../models/Decision');
const Config = require('../models/Config');
const { evaluateOrder } = require('../engine/decisionEngine');
const defaultConfig = require('../config/rulesConfig');

/**
 * POST /api/orders/evaluate
 *
 * Accepts an order JSON body, runs it through the decision engine,
 * stores both the order and the decision, and returns the result.
 */
router.post('/evaluate', async (req, res, next) => {
  try {
    const orderData = req.body || {};

    if (!orderData.order_id) {
      orderData.order_id = `SIM_${Date.now()}`;
    }

    // Normalize field aliases
    if (orderData.customer_prior_rto === undefined && orderData.prior_rto !== undefined) {
      orderData.customer_prior_rto = Number(orderData.prior_rto);
    }
    if (orderData.customer_prior_orders === undefined && orderData.prior_orders !== undefined) {
      orderData.customer_prior_orders = Number(orderData.prior_orders);
    }

    // Load runtime config from DB (fall back to defaults)
    let config = defaultConfig;
    try {
      const dbConfig = await Config.findOne({ key: 'rulesConfig' });
      if (dbConfig && dbConfig.value) {
        config = { ...defaultConfig, ...dbConfig.value };
      }
    } catch (e) {
      // Use defaultConfig if DB is offline
    }

    // Run the decision engine
    const decision = await evaluateOrder(orderData, config);

    // Save order & decision to DB if available
    try {
      await Order.findOneAndUpdate(
        { order_id: orderData.order_id },
        orderData,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      await Decision.findOneAndUpdate(
        { order_id: decision.order_id },
        decision,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (dbErr) {
      // Log DB persistence warning without failing response
    }

    res.status(200).json({ success: true, data: decision, decision });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/orders/:id
 *
 * Fetch a single order by order_id along with its engine decision.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const order = await Order.findOne({ order_id: req.params.id });
    if (!order) {
      return res.status(404).json({
        success: false,
        error: `Order not found: ${req.params.id}`,
      });
    }

    const decision = await Decision.findOne({ order_id: req.params.id });

    res.status(200).json({
      success: true,
      data: { order, decision },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/orders
 *
 * List orders with optional query filters.
 * Supported filters: action, city, state, utm_source
 * Pagination: page (default 1), limit (default 50)
 */
router.get('/', async (req, res, next) => {
  try {
    const { action, city, state, utm_source, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    // Build order query
    const orderQuery = {};
    if (city) orderQuery.city = new RegExp(city, 'i');
    if (state) orderQuery.state = new RegExp(state, 'i');
    if (utm_source) orderQuery.utm_source = new RegExp(utm_source, 'i');

    // If filtering by action, we need to find matching order_ids from decisions first
    let orderIdFilter = null;
    if (action) {
      const matchingDecisions = await Decision.find({ action }, 'order_id').lean();
      orderIdFilter = matchingDecisions.map((d) => d.order_id);
      orderQuery.order_id = { $in: orderIdFilter };
    }

    const [orders, total] = await Promise.all([
      Order.find(orderQuery)
        .sort({ order_datetime: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .lean(),
      Order.countDocuments(orderQuery),
    ]);

    // Fetch decisions for the returned orders
    const orderIds = orders.map((o) => o.order_id);
    const decisions = await Decision.find({ order_id: { $in: orderIds } }).lean();
    const decisionMap = {};
    for (const d of decisions) {
      decisionMap[d.order_id] = d;
    }

    const results = orders.map((o) => ({
      order: o,
      decision: decisionMap[o.order_id] || null,
    }));

    res.status(200).json({
      success: true,
      data: results,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / parseInt(limit, 10)),
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
