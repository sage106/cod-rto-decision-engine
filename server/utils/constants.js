/**
 * constants.js
 *
 * Central repository for all unit-economics figures, enums, and reference
 * lists used across the COD RTO Decision Engine.  Every number here is
 * derived from the dataset analysis (2,018 COD orders, 28.41% overall RTO).
 */

// ---------------------------------------------------------------------------
// Unit Economics (all values in INR unless noted)
// ---------------------------------------------------------------------------

/** Average Order Value */
const AOV = 649;

/** Gross margin percentage on every order */
const GROSS_MARGIN_PCT = 0.62;

/** Gross margin in rupees per order (AOV * GROSS_MARGIN_PCT) */
const GROSS_MARGIN_PER_ORDER = 402.38;

/** Forward shipping cost incurred on every dispatched order */
const FORWARD_SHIPPING_COST = 65;

/** Return shipping cost when an order is returned (RTO) */
const RETURN_SHIPPING_COST = 65;

/** Packaging cost per order */
const PACKAGING_COST = 25;

/** Average damage/depreciation cost per RTO return */
const DAMAGE_COST = 14.40;

/** Total cost incurred on every RTO order */
const RTO_COST_PER_ORDER = FORWARD_SHIPPING_COST + RETURN_SHIPPING_COST + PACKAGING_COST + DAMAGE_COST; // 169.40

/** Delivery probability below which shipping the order is EV-negative */
const BREAK_EVEN_DELIVERY_PROB = 0.2963;

/** COD collection fee charged by the payment gateway / courier */
const COD_COLLECTION_FEE = 30;

/** Discount offered to nudge the customer towards prepaid */
const PREPAID_DISCOUNT = 50;

/** Cost saved when a customer converts from COD to prepaid (RTO-cost saving + COD fee) */
const PREPAID_SAVINGS = 70.65;

/** Net gain after subtracting the discount from savings */
const PREPAID_NET_GAIN = 20.65;

/** Customer acquisition cost via Meta Ads */
const META_CAC = 300;

// ---------------------------------------------------------------------------
// Action Enums
// ---------------------------------------------------------------------------

/** Possible actions the engine can assign to an order */
const ACTIONS = Object.freeze({
  SHIP_AS_IS: 'SHIP_AS_IS',
  SHIP_AFTER_CONFIRMATION: 'SHIP_AFTER_CONFIRMATION',
  NUDGE_TO_PREPAID: 'NUDGE_TO_PREPAID',
  HOLD_CANCEL: 'HOLD_CANCEL',
});

/** Human-readable labels for each action */
const ACTION_LABELS = Object.freeze({
  [ACTIONS.SHIP_AS_IS]: 'Ship As-Is',
  [ACTIONS.SHIP_AFTER_CONFIRMATION]: 'Ship After Confirmation',
  [ACTIONS.NUDGE_TO_PREPAID]: 'Nudge to Prepaid',
  [ACTIONS.HOLD_CANCEL]: 'Hold / Cancel',
});

// ---------------------------------------------------------------------------
// Order Status Enums
// ---------------------------------------------------------------------------

/** Possible final statuses an order can have in the dataset */
const ORDER_STATUS = Object.freeze({
  DELIVERED: 'DELIVERED',
  RTO: 'RTO',
});

// ---------------------------------------------------------------------------
// WhatsApp Session State Enums
// ---------------------------------------------------------------------------

const WA_SESSION_STATES = Object.freeze({
  PENDING: 'PENDING',
  SENT: 'SENT',
  CONFIRMED: 'CONFIRMED',
  DECLINED: 'DECLINED',
  ADDRESS_UPDATED: 'ADDRESS_UPDATED',
  PREPAID_PAID: 'PREPAID_PAID',
  TIMED_OUT: 'TIMED_OUT',
  REMINDER_SENT: 'REMINDER_SENT',
  ESCALATED: 'ESCALATED',
});

const WA_FLOW_TYPES = Object.freeze({
  CONFIRMATION: 'confirmation',
  PREPAID_NUDGE: 'prepaid_nudge',
});

// ---------------------------------------------------------------------------
// High-RTO Geographic Lists (derived from dataset)
// ---------------------------------------------------------------------------

/**
 * States with the highest RTO rates.
 * Bihar: 53.42%, Uttar Pradesh: 44.67%
 */
const HIGH_RTO_STATES = ['Bihar', 'Uttar Pradesh'];

/**
 * States with elevated (but not extreme) RTO rates.
 * Madhya Pradesh: 38.46%, Assam: ~35%
 */
const ELEVATED_RTO_STATES = ['Madhya Pradesh', 'Assam'];

/**
 * Cities with significantly above-average RTO rates.
 * Gorakhpur: 63%, Bareilly: 60.6%, Darbhanga: 58%,
 * Sagar: 50.9%, Patna: 47.5%, Madhubani: ~50%
 */
const HIGH_RTO_CITIES = [
  'Gorakhpur',
  'Bareilly',
  'Darbhanga',
  'Sagar',
  'Patna',
  'Madhubani',
];

// ---------------------------------------------------------------------------
// Gibberish / Placeholder Address Tokens
// ---------------------------------------------------------------------------

/**
 * Words and phrases commonly found in fake or placeholder addresses.
 * These addresses have a 63.69% RTO rate in the dataset.
 * NOTE: Hinglish landmark phrases ("ke paas", "mandir ke saamne") are NOT
 *       considered gibberish -- they are valid delivery instructions.
 */
const GIBBERISH_ADDRESS_WORDS = [
  '.',
  'xyz',
  'home',
  'call me',
  'near station',
  'na',
  'test',
  'abc',
  'address',
];

module.exports = {
  AOV,
  GROSS_MARGIN_PCT,
  GROSS_MARGIN_PER_ORDER,
  FORWARD_SHIPPING_COST,
  RETURN_SHIPPING_COST,
  PACKAGING_COST,
  DAMAGE_COST,
  RTO_COST_PER_ORDER,
  BREAK_EVEN_DELIVERY_PROB,
  COD_COLLECTION_FEE,
  PREPAID_DISCOUNT,
  PREPAID_SAVINGS,
  PREPAID_NET_GAIN,
  META_CAC,
  ACTIONS,
  ACTION_LABELS,
  ORDER_STATUS,
  WA_SESSION_STATES,
  WA_FLOW_TYPES,
  HIGH_RTO_STATES,
  ELEVATED_RTO_STATES,
  HIGH_RTO_CITIES,
  GIBBERISH_ADDRESS_WORDS,
};
