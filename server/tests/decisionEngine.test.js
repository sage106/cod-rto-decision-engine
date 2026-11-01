/**
 * decisionEngine.test.js
 *
 * Unit tests for the core COD RTO decision engine logic.
 */

const { evaluateOrder } = require('../engine/decisionEngine');
const defaultConfig = require('../config/rulesConfig');
const { ACTIONS } = require('../utils/constants');

describe('Decision Engine - Order Evaluation', () => {
  test('Hard block: customer with 2 or more prior RTOs gets HOLD_CANCEL', async () => {
    const order = {
      order_id: 'TEST_001',
      customer_name: 'Rahul Sharma',
      phone: '9876543210',
      address: 'Flat 102, Green Park Apartments, Sector 15',
      city: 'Delhi',
      state: 'Delhi',
      pincode: '110016',
      order_value: 649,
      customer_prior_orders: 3,
      customer_prior_rto: 2,
    };

    const decision = await evaluateOrder(order, defaultConfig);
    expect(decision.action).toBe(ACTIONS.HOLD_CANCEL);
    expect(decision.rules_triggered).toContain('PRIOR_RTO_EXCEEDS_MAX');
  });

  test('Hard block: fake customer name gets HOLD_CANCEL', async () => {
    const order = {
      order_id: 'TEST_002',
      customer_name: 'test',
      phone: '9876543210',
      address: 'Flat 102, Green Park Apartments',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      order_value: 649,
      customer_prior_orders: 0,
      customer_prior_rto: 0,
    };

    const decision = await evaluateOrder(order, defaultConfig);
    expect(decision.action).toBe(ACTIONS.HOLD_CANCEL);
    expect(decision.rules_triggered).toContain('FAKE_NAME_DETECTED');
  });

  test('Hard block: gibberish address gets HOLD_CANCEL', async () => {
    const order = {
      order_id: 'TEST_003',
      customer_name: 'Amit Verma',
      phone: '9876543210',
      address: '...',
      city: 'Patna',
      state: 'Bihar',
      pincode: '800001',
      order_value: 649,
      customer_prior_orders: 0,
      customer_prior_rto: 0,
    };

    const decision = await evaluateOrder(order, defaultConfig);
    expect(decision.action).toBe(ACTIONS.HOLD_CANCEL);
    expect(decision.rules_triggered).toContain('GIBBERISH_ADDRESS');
  });

  test('Prepaid Nudge: Returning customer with 1 prior RTO gets NUDGE_TO_PREPAID', async () => {
    const order = {
      order_id: 'TEST_004',
      customer_name: 'Suresh Raina',
      phone: '9876543210',
      address: 'Flat 12, Gandhi Nagar, Road 4',
      city: 'Jaipur',
      state: 'Rajasthan',
      pincode: '302015',
      order_value: 649,
      customer_prior_orders: 2,
      customer_prior_rto: 1,
    };

    const decision = await evaluateOrder(order, defaultConfig);
    expect(decision.action).toBe(ACTIONS.NUDGE_TO_PREPAID);
    expect(decision.rules_triggered).toContain('REPEAT_CUSTOMER_ONE_PRIOR_RTO');
  });

  test('Ship After Confirmation: First-time customer from Meta Ads in Bihar gets SHIP_AFTER_CONFIRMATION', async () => {
    const order = {
      order_id: 'TEST_005',
      customer_name: 'Pooja Kumari',
      phone: '9876543210',
      address: 'Flat 104, Kali Enclave, Boring Road',
      city: 'Patna',
      state: 'Bihar',
      pincode: '800001',
      order_value: 649,
      customer_prior_orders: 0,
      customer_prior_rto: 0,
      utm_source: 'meta_ads',
    };

    const decision = await evaluateOrder(order, defaultConfig);
    expect(decision.action).toBe(ACTIONS.SHIP_AFTER_CONFIRMATION);
    expect(decision.rules_triggered).toContain('NEW_META_ADS_HIGH_RTO_STATE');
  });

  test('Ship After Confirmation: Landmark-only address gets SHIP_AFTER_CONFIRMATION', async () => {
    const order = {
      order_id: 'TEST_006',
      customer_name: 'Vikas Kumar',
      phone: '9876543210',
      address: 'ph krke aana Govt School ke paas',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411001',
      order_value: 599,
      customer_prior_orders: 1,
      customer_prior_rto: 0,
    };

    const decision = await evaluateOrder(order, defaultConfig);
    expect(decision.action).toBe(ACTIONS.SHIP_AFTER_CONFIRMATION);
    expect(decision.rules_triggered).toContain('LANDMARK_ONLY_ADDRESS');
  });

  test('Ship As-Is: Structured address with repeat clean customer ships immediately', async () => {
    const order = {
      order_id: 'TEST_007',
      customer_name: 'Deepak Chopra',
      phone: '9876543210',
      address: 'Flat 401, Palms Residency, Bandra West, Road 14',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400050',
      order_value: 649,
      customer_prior_orders: 2,
      customer_prior_rto: 0,
    };

    const decision = await evaluateOrder(order, defaultConfig);
    expect(decision.action).toBe(ACTIONS.SHIP_AS_IS);
    expect(decision.rules_triggered).toContain('DEFAULT_SHIP');
  });

  test('Financial impact calculation delivers positive EV for low-risk orders', async () => {
    const order = {
      order_id: 'TEST_008',
      customer_name: 'Deepak Chopra',
      phone: '9876543210',
      address: 'Flat 401, Palms Residency, Bandra West',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400050',
      order_value: 649,
      customer_prior_orders: 2,
      customer_prior_rto: 0,
    };

    const decision = await evaluateOrder(order, defaultConfig);
    expect(decision.financial_impact).toBeDefined();
    expect(decision.financial_impact.expected_margin).toBeGreaterThan(0);
    expect(decision.financial_impact.net_ev).toBeGreaterThan(0);
  });
});
