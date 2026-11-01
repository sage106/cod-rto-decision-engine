/**
 * whatsappFlowService.js
 *
 * Service layer for managing WhatsApp conversation sessions.
 * Supports two flows:
 *
 *  1. Order Confirmation -- sends the delivery address to the customer for
 *     verification before shipping.
 *  2. Prepaid Nudge -- offers a discount to convert from COD to prepaid.
 *
 * This service manages the state machine transitions and generates
 * professional, no-emoji message templates.
 *
 * NOTE: This does not integrate with the WhatsApp Business API directly.
 * It provides the session management and message generation layer that
 * a real integration would sit on top of.
 */

const mongoose = require('mongoose');
const WhatsAppSession = require('../models/WhatsAppSession');
const { WA_SESSION_STATES, WA_FLOW_TYPES, PREPAID_DISCOUNT } = require('../utils/constants');

// ---------------------------------------------------------------------------
// Message Templates
// ---------------------------------------------------------------------------

/**
 * Generate the initial outbound message for an order confirmation flow.
 *
 * @param {Object} details - Order details.
 * @returns {string} The formatted message.
 */
function confirmationMessage(details) {
  const name = details.customer_name || 'Customer';
  const orderId = details.order_id || 'N/A';
  const items = details.items || 'Haircare Essentials';
  const value = details.order_value || 649;
  const address = details.address || 'Standard Delivery Address';
  const city = details.city || 'India';
  return (
    `Hello ${name}, your order #${orderId} ` +
    `for ${items} (Rs.${value}) has been received. ` +
    `Your delivery address is: ${address}, ${city}. ` +
    `Please reply: YES to confirm and ship, NO to cancel, or type your corrected address.`
  );
}

/**
 * Generate the reminder message sent after 12 hours of no response.
 *
 * @param {Object} details - Order details.
 * @returns {string} The formatted reminder.
 */
function reminderMessage(details) {
  const name = details.customer_name || 'Customer';
  const orderId = details.order_id || 'N/A';
  const value = details.order_value || 649;
  const city = details.city || 'your registered address';
  return (
    `Hello ${name}, we are awaiting your confirmation ` +
    `for order #${orderId} (Rs.${value}). ` +
    `Please reply YES to proceed with delivery to ${city}, ` +
    `or NO to cancel.`
  );
}

/**
 * Generate the initial outbound message for a prepaid nudge flow.
 *
 * @param {Object} details - Order details.
 * @returns {string} The formatted message.
 */
function prepaidNudgeMessage(details) {
  const name = details.customer_name || 'Customer';
  const orderId = details.order_id || 'N/A';
  const originalValue = details.order_value || 649;
  const discountedValue = originalValue - PREPAID_DISCOUNT;
  return (
    `Hello ${name}, complete your payment online for ` +
    `order #${orderId} and receive a flat Rs.${PREPAID_DISCOUNT} discount. ` +
    `Pay Rs.${discountedValue} instead of Rs.${originalValue}. ` +
    `This offer is valid for 2 hours. Reply YES to receive the payment link, ` +
    `or NO to continue with Cash on Delivery.`
  );
}

// ---------------------------------------------------------------------------
// Session Management
// ---------------------------------------------------------------------------

/**
 * Start a new WhatsApp session for an order.
 *
 * @param {string} orderId     - The order ID.
 * @param {string} flowType    - 'confirmation' or 'prepaid_nudge'.
 * @param {Object} orderDetails - Object with customer_name, order_id, items,
 *                                order_value, address, city.
 * @returns {Promise<Object>} The created session document.
 */
async function startSession(orderId, flowType, orderDetails) {
  // Determine the initial message based on flow type
  let initialMessage;
  if (flowType === WA_FLOW_TYPES.PREPAID_NUDGE) {
    initialMessage = prepaidNudgeMessage(orderDetails);
  } else {
    initialMessage = confirmationMessage(orderDetails);
  }

  // Calculate expiry based on flow type
  const now = new Date();
  let expiresAt;
  if (flowType === WA_FLOW_TYPES.PREPAID_NUDGE) {
    expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours
  } else {
    expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
  }

  const session = new WhatsAppSession({
    order_id: orderId,
    flow_type: flowType,
    state: WA_SESSION_STATES.SENT,
    messages: [
      {
        direction: 'outbound',
        content: initialMessage,
        timestamp: now,
      },
    ],
    expires_at: expiresAt,
  });

  await session.save();
  return session;
}

/**
 * Process a customer's reply to an active WhatsApp session.
 *
 * State transitions:
 *  - "yes" in confirmation flow  -> CONFIRMED
 *  - "no"  in confirmation flow  -> DECLINED
 *  - "yes" in prepaid nudge flow -> PREPAID_PAID
 *  - "no"  in prepaid nudge flow -> DECLINED
 *  - Any other text              -> state stays as-is (pending manual review)
 *
 * @param {string} sessionId - The MongoDB _id of the session.
 * @param {string} replyText - The raw text of the customer's reply.
 * @returns {Promise<Object>} The updated session document.
 */
async function processReply(sessionId, replyText) {
  let session = null;
  if (mongoose.Types.ObjectId.isValid(sessionId)) {
    session = await WhatsAppSession.findById(sessionId);
  }
  if (!session) {
    session = await WhatsAppSession.findOne({ order_id: sessionId }).sort({ createdAt: -1 });
  }
  if (!session) {
    throw new Error(`WhatsApp session not found: ${sessionId}`);
  }

  const normalised = (replyText || '').trim().toLowerCase();

  // Record the inbound message
  session.messages.push({
    direction: 'inbound',
    content: replyText,
    timestamp: new Date(),
  });

  if (normalised === 'yes') {
    if (session.flow_type === WA_FLOW_TYPES.PREPAID_NUDGE) {
      session.state = WA_SESSION_STATES.PREPAID_PAID;
      session.messages.push({
        direction: 'outbound',
        content: `Thank you. Your payment link for order #${session.order_id} has been sent. ` +
                 `Please complete payment within 30 minutes to avail the discount.`,
        timestamp: new Date(),
      });
    } else {
      session.state = WA_SESSION_STATES.CONFIRMED;
      session.messages.push({
        direction: 'outbound',
        content: `Thank you for confirming order #${session.order_id}. ` +
                 `Your order will be dispatched shortly.`,
        timestamp: new Date(),
      });
    }
  } else if (normalised === 'no') {
    session.state = WA_SESSION_STATES.DECLINED;
    session.messages.push({
      direction: 'outbound',
      content: `Order #${session.order_id} has been cancelled as per your request. ` +
               `If this was a mistake, please place a new order.`,
      timestamp: new Date(),
    });
  } else {
    // Unrecognised reply -- could be an address update or random text.
    // In a confirmation flow, treat long-ish text as a potential address update.
    if (session.flow_type === WA_FLOW_TYPES.CONFIRMATION && normalised.length >= 10) {
      session.state = WA_SESSION_STATES.ADDRESS_UPDATED;
      session.messages.push({
        direction: 'outbound',
        content: `Thank you. We have noted your updated address for order #${session.order_id}. ` +
                 `Our team will review and proceed with dispatch.`,
        timestamp: new Date(),
      });
    }
    // For short / unclear replies, keep state unchanged (will need manual review)
    // No outbound message is sent to avoid confusing the customer.
  }

  await session.save();
  return session;
}

/**
 * Process a timeout event for a WhatsApp session.
 *
 * Timeout types:
 *  - '12h' -- sends a reminder (confirmation flow only)
 *  - '24h' -- times out the session (confirmation flow)
 *  - '2h'  -- times out the session (prepaid nudge flow, falls back to COD)
 *
 * @param {string} sessionId   - The MongoDB _id of the session.
 * @param {string} timeoutType - One of '12h', '24h', '2h'.
 * @returns {Promise<Object>} The updated session document.
 */
async function processTimeout(sessionId, timeoutType) {
  let session = null;
  if (mongoose.Types.ObjectId.isValid(sessionId)) {
    session = await WhatsAppSession.findById(sessionId);
  }
  if (!session) {
    session = await WhatsAppSession.findOne({ order_id: sessionId }).sort({ createdAt: -1 });
  }
  if (!session) {
    throw new Error(`WhatsApp session not found: ${sessionId}`);
  }

  switch (timeoutType) {
    case '12h':
      // Send a reminder -- only if the session is still in SENT state
      if (session.state === WA_SESSION_STATES.SENT) {
        session.state = WA_SESSION_STATES.REMINDER_SENT;
        session.messages.push({
          direction: 'outbound',
          content: `This is a reminder regarding your order #${session.order_id}. ` +
                   `Please reply YES to confirm or NO to cancel. ` +
                   `If we do not hear from you within 12 hours, the order will be automatically cancelled.`,
          timestamp: new Date(),
        });
      }
      break;

    case '24h':
      // Full timeout -- cancel the order
      if (
        session.state === WA_SESSION_STATES.SENT ||
        session.state === WA_SESSION_STATES.REMINDER_SENT
      ) {
        session.state = WA_SESSION_STATES.TIMED_OUT;
        session.messages.push({
          direction: 'outbound',
          content: `Order #${session.order_id} has been cancelled due to no response within 24 hours. ` +
                   `Please place a new order if you still wish to purchase.`,
          timestamp: new Date(),
        });
      }
      break;

    case '2h':
      // Prepaid nudge timeout -- fall back to COD
      if (session.state === WA_SESSION_STATES.SENT || session.state === WA_SESSION_STATES.REMINDER_SENT) {
        session.state = WA_SESSION_STATES.TIMED_OUT;
        session.messages.push({
          direction: 'outbound',
          content: `The prepaid discount offer for order #${session.order_id} has expired. ` +
                   `Your order will proceed as Cash on Delivery at the original price.`,
          timestamp: new Date(),
        });
      }
      break;

    default:
      throw new Error(`Unknown timeout type: ${timeoutType}`);
  }

  await session.save();
  return session;
}

/**
 * Retrieve the full session (including messages) for an order.
 *
 * @param {string} orderId - The order ID.
 * @returns {Promise<Object|null>} The session document, or null if not found.
 */
async function getSession(orderId) {
  return WhatsAppSession.findOne({ order_id: orderId }).sort({ createdAt: -1 });
}

module.exports = {
  startSession,
  processReply,
  processTimeout,
  getSession,
};
