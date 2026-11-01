/**
 * Config.js
 *
 * Mongoose model for a simple key-value configuration store.
 * Allows runtime updates to engine thresholds without redeployment.
 */

const mongoose = require('mongoose');

const configSchema = new mongoose.Schema(
  {
    /** Unique configuration key (e.g. "rulesConfig") */
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    /** Configuration value -- can be any JSON-serialisable structure */
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Config', configSchema);
