/**
 * whatsappRoutes.js
 *
 * REST endpoints for managing WhatsApp conversation sessions.
 * These simulate the WhatsApp Business API integration for order
 * confirmation and prepaid nudge flows.
 *
 * Routes:
 *  POST /api/whatsapp/start             -- start a new session
 *  POST /api/whatsapp/reply             -- process a customer reply
 *  POST /api/whatsapp/timeout           -- simulate a timeout event
 *  GET  /api/whatsapp/session/:orderId  -- retrieve session details
 */

const express = require('express');
const router = express.Router();
const whatsappService = require('../services/whatsappFlowService');

/**
 * POST /api/whatsapp/start
 *
 * Start a new WhatsApp session for an order.
 * Body: { order_id, flow_type, order_details: { customer_name, items, order_value, address, city } }
 */
router.post('/start', async (req, res, next) => {
  try {
    const { order_id, flow_type, order_details } = req.body;

    if (!order_id || !flow_type || !order_details) {
      return res.status(400).json({
        success: false,
        error: 'Required fields: order_id, flow_type, order_details.',
      });
    }

    // Ensure order_details includes the order_id for message templates
    const details = { ...order_details, order_id };

    const session = await whatsappService.startSession(order_id, flow_type, details);

    res.status(201).json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/whatsapp/reply
 *
 * Process a customer's reply to an active session.
 * Body: { session_id, reply_text }
 */
router.post('/reply', async (req, res, next) => {
  try {
    const sessionId = req.body.session_id || req.body.order_id;
    const replyText = req.body.reply_text !== undefined ? req.body.reply_text : req.body.reply;

    if (!sessionId || replyText === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Required fields: session_id (or order_id) and reply_text (or reply).',
      });
    }

    const session = await whatsappService.processReply(sessionId, replyText);

    res.status(200).json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/whatsapp/timeout
 *
 * Simulate a timeout event for an active session.
 * Body: { session_id, timeout_type } where timeout_type is '12h', '24h', or '2h'
 */
router.post('/timeout', async (req, res, next) => {
  try {
    const sessionId = req.body.session_id || req.body.order_id;
    const timeoutType = req.body.timeout_type || req.body.timeoutType;

    if (!sessionId || !timeoutType) {
      return res.status(400).json({
        success: false,
        error: 'Required fields: session_id (or order_id) and timeout_type.',
      });
    }

    const session = await whatsappService.processTimeout(sessionId, timeoutType);

    res.status(200).json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/whatsapp/session/:orderId
 *
 * Retrieve the most recent WhatsApp session for an order.
 */
router.get('/session/:orderId', async (req, res, next) => {
  try {
    const session = await whatsappService.getSession(req.params.orderId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: `No WhatsApp session found for order: ${req.params.orderId}`,
      });
    }

    res.status(200).json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
