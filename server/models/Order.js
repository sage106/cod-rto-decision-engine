/**
 * Order.js
 *
 * Mongoose model for COD orders.  The schema mirrors the columns in the
 * orders_sample.csv dataset.  Each document represents a single Cash on
 * Delivery order with its associated metadata and outcome.
 */

const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    /** Unique order identifier from the source system */
    order_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    /** ISO timestamp of when the order was placed */
    order_datetime: {
      type: Date,
      required: true,
    },

    /** Full name of the customer */
    customer_name: {
      type: String,
      required: true,
    },

    /** Customer phone number (10-digit Indian mobile) */
    phone: {
      type: String,
      required: true,
    },

    /** Delivery address as entered by the customer */
    address: {
      type: String,
      required: true,
    },

    /** Delivery city */
    city: {
      type: String,
      required: true,
    },

    /** Delivery state */
    state: {
      type: String,
      required: true,
    },

    /** 6-digit Indian pincode */
    pincode: {
      type: String,
      required: true,
    },

    /** Order value in INR */
    order_value: {
      type: Number,
      required: true,
    },

    /** Comma-separated list of item names */
    items: {
      type: String,
      default: '',
    },

    /** Number of items in the order */
    num_items: {
      type: Number,
      default: 1,
    },

    /** Number of prior orders placed by this customer */
    customer_prior_orders: {
      type: Number,
      default: 0,
    },

    /** Number of prior RTO returns by this customer */
    customer_prior_rto: {
      type: Number,
      default: 0,
    },

    /** Traffic source that acquired this customer (e.g. Meta Ads, Google, Direct) */
    utm_source: {
      type: String,
      default: '',
    },

    /** Courier partner assigned to this order */
    courier: {
      type: String,
      default: '',
    },

    /** Payment method (always COD in this dataset) */
    payment_method: {
      type: String,
      default: 'COD',
    },

    /** Actual outcome: DELIVERED or RTO */
    final_status: {
      type: String,
      enum: ['DELIVERED', 'RTO', ''],
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Order', orderSchema);
