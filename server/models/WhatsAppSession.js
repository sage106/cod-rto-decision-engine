/**
 * WhatsAppSession.js
 *
 * Mongoose model for WhatsApp conversation sessions.  Each session tracks
 * the state machine for either order confirmation or prepaid nudge flows,
 * along with the full message history.
 */

const mongoose = require('mongoose');
const { WA_SESSION_STATES, WA_FLOW_TYPES } = require('../utils/constants');

const messageSchema = new mongoose.Schema(
  {
    /** Direction of the message relative to the system */
    direction: {
      type: String,
      enum: ['outbound', 'inbound'],
      required: true,
    },

    /** Message body */
    content: {
      type: String,
      required: true,
    },

    /** When the message was sent or received */
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const whatsAppSessionSchema = new mongoose.Schema(
  {
    /** The order this session relates to */
    order_id: {
      type: String,
      required: true,
      index: true,
    },

    /** Type of conversational flow */
    flow_type: {
      type: String,
      enum: Object.values(WA_FLOW_TYPES),
      required: true,
    },

    /** Current state machine position */
    state: {
      type: String,
      enum: Object.values(WA_SESSION_STATES),
      default: WA_SESSION_STATES.PENDING,
    },

    /** Ordered list of messages exchanged in this session */
    messages: {
      type: [messageSchema],
      default: [],
    },

    /** When this session expires if no customer response is received */
    expires_at: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('WhatsAppSession', whatsAppSessionSchema);
