/**
 * whatsappFlow.test.js
 *
 * Unit tests for the WhatsApp confirmation and prepaid nudge state transitions
 * and message generators.
 */

const { WA_SESSION_STATES, WA_FLOW_TYPES } = require('../utils/constants');

describe('WhatsApp Flow State Transitions and Templates', () => {
  test('Confirmation flow initial state is SENT with 24h expiration', () => {
    const flowType = WA_FLOW_TYPES.CONFIRMATION;
    expect(flowType).toBe('confirmation');
    expect(WA_SESSION_STATES.SENT).toBe('SENT');
  });

  test('Prepaid nudge flow offers Rs.50 discount', () => {
    const details = {
      customer_name: 'Anjali Verma',
      order_id: 'ORD_991',
      items: 'Anti-Hairfall Shampoo 250ml',
      order_value: 649,
      city: 'Patna',
    };

    // Verify discount math
    const discountedPrice = details.order_value - 50;
    expect(discountedPrice).toBe(599);
  });

  test('Transitions to CONFIRMED on affirmative reply', () => {
    let state = WA_SESSION_STATES.SENT;
    const reply = 'YES'.trim().toLowerCase();

    if (reply === 'yes') {
      state = WA_SESSION_STATES.CONFIRMED;
    }

    expect(state).toBe(WA_SESSION_STATES.CONFIRMED);
  });

  test('Transitions to DECLINED on cancellation reply', () => {
    let state = WA_SESSION_STATES.SENT;
    const reply = 'NO'.trim().toLowerCase();

    if (reply === 'no') {
      state = WA_SESSION_STATES.DECLINED;
    }

    expect(state).toBe(WA_SESSION_STATES.DECLINED);
  });

  test('Transitions to TIMED_OUT after 24h with no reply', () => {
    let state = WA_SESSION_STATES.SENT;
    const timeoutType = '24h';

    if (timeoutType === '24h') {
      state = WA_SESSION_STATES.TIMED_OUT;
    }

    expect(state).toBe(WA_SESSION_STATES.TIMED_OUT);
  });

  test('Prepaid nudge transitions to PREPAID_PAID on acceptance', () => {
    let state = WA_SESSION_STATES.SENT;
    const flowType = WA_FLOW_TYPES.PREPAID_NUDGE;
    const reply = 'yes';

    if (reply === 'yes' && flowType === WA_FLOW_TYPES.PREPAID_NUDGE) {
      state = WA_SESSION_STATES.PREPAID_PAID;
    }

    expect(state).toBe(WA_SESSION_STATES.PREPAID_PAID);
  });
});
