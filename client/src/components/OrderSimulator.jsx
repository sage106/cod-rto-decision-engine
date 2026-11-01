/**
 * OrderSimulator.jsx — Interactive order evaluation form.
 * Lets the user enter order details (or load a pre-built sample),
 * submit them to the /api/orders/evaluate endpoint, and view the
 * resulting risk decision, score bar, reason, and financial breakdown.
 */
import React, { useState } from 'react';
import { evaluateOrder } from '../api/apiClient';

/* List of states available in the dataset */
const STATES = [
  'Maharashtra', 'Delhi', 'Karnataka', 'Uttar Pradesh', 'Telangana',
  'Rajasthan', 'Tamil Nadu', 'Bihar', 'West Bengal', 'Madhya Pradesh', 'Assam',
];

/* UTM source options */
const UTM_SOURCES = [
  'direct', 'google_ads', 'influencer', 'instagram_organic', 'meta_ads', 'whatsapp_broadcast',
];

/* Pre-filled sample orders for quick testing */
const SAMPLE_HIGH_RISK = {
  customer_name: 'test user',
  phone: '12345',
  address: '.',
  city: 'Gorakhpur',
  state: 'Uttar Pradesh',
  pincode: '273001',
  order_value: 0,
  num_items: 1,
  prior_orders: 0,
  prior_rto: 2,
  utm_source: 'meta_ads',
};

const SAMPLE_SAFE = {
  customer_name: 'Priya Sharma',
  phone: '9876543210',
  address: 'Flat 302, Sunrise Apartments, MG Road, Koramangala',
  city: 'Bengaluru',
  state: 'Karnataka',
  pincode: '560034',
  order_value: 899,
  num_items: 2,
  prior_orders: 3,
  prior_rto: 0,
  utm_source: 'direct',
};

/* Blank form state */
const EMPTY_FORM = {
  customer_name: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  order_value: '',
  num_items: 1,
  prior_orders: 0,
  prior_rto: 0,
  utm_source: 'direct',
};

/** Colour for an action label badge. */
function actionColor(action) {
  switch (action) {
    case 'SHIP_AS_IS':     return 'badge--success';
    case 'CONFIRM_VIA_WA': return 'badge--primary';
    case 'PREPAID_NUDGE':  return 'badge--warning';
    case 'HOLD_CANCEL':    return 'badge--danger';
    default:               return 'badge--neutral';
  }
}

function OrderSimulator() {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /** Generic field change handler. */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  /** Submit the order for evaluation. */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const payload = {
        ...form,
        order_value: Number(form.order_value),
        num_items: Number(form.num_items),
        prior_orders: Number(form.prior_orders),
        prior_rto: Number(form.prior_rto),
        payment_method: 'COD',
      };
      const res = await evaluateOrder(payload);
      setResult(res.decision || res);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card order-simulator">
      {/* Sample-loading buttons */}
      <div className="order-simulator__samples">
        <button
          type="button"
          className="btn btn--outline btn--small"
          onClick={() => { setForm({ ...SAMPLE_HIGH_RISK }); setResult(null); }}
        >
          Load Sample High-Risk Order
        </button>
        <button
          type="button"
          className="btn btn--outline btn--small"
          onClick={() => { setForm({ ...SAMPLE_SAFE }); setResult(null); }}
        >
          Load Sample Safe Order
        </button>
      </div>

      {/* Order input form */}
      <form className="order-simulator__form" onSubmit={handleSubmit}>
        <div className="form-grid">
          {/* Customer Name */}
          <label className="form-field">
            <span className="form-field__label">Customer Name</span>
            <input
              type="text" name="customer_name" value={form.customer_name}
              onChange={handleChange} required
            />
          </label>

          {/* Phone */}
          <label className="form-field">
            <span className="form-field__label">Phone</span>
            <input
              type="text" name="phone" value={form.phone}
              onChange={handleChange} required
            />
          </label>

          {/* Address */}
          <label className="form-field form-field--full">
            <span className="form-field__label">Address</span>
            <textarea
              name="address" value={form.address}
              onChange={handleChange} rows={2} required
            />
          </label>

          {/* City */}
          <label className="form-field">
            <span className="form-field__label">City</span>
            <input
              type="text" name="city" value={form.city}
              onChange={handleChange} required
            />
          </label>

          {/* State */}
          <label className="form-field">
            <span className="form-field__label">State</span>
            <select name="state" value={form.state} onChange={handleChange} required>
              <option value="">-- Select --</option>
              {STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>

          {/* Pincode */}
          <label className="form-field">
            <span className="form-field__label">Pincode</span>
            <input
              type="text" name="pincode" value={form.pincode}
              onChange={handleChange} required
            />
          </label>

          {/* Order Value */}
          <label className="form-field">
            <span className="form-field__label">Order Value (Rs.)</span>
            <input
              type="number" name="order_value" min="0"
              value={form.order_value} onChange={handleChange} required
            />
          </label>

          {/* Number of Items */}
          <label className="form-field">
            <span className="form-field__label">Number of Items</span>
            <input
              type="number" name="num_items" min="1" max="4"
              value={form.num_items} onChange={handleChange}
            />
          </label>

          {/* Prior Orders */}
          <label className="form-field">
            <span className="form-field__label">Prior Orders</span>
            <input
              type="number" name="prior_orders" min="0" max="5"
              value={form.prior_orders} onChange={handleChange}
            />
          </label>

          {/* Prior RTOs */}
          <label className="form-field">
            <span className="form-field__label">Prior RTOs</span>
            <input
              type="number" name="prior_rto" min="0" max="2"
              value={form.prior_rto} onChange={handleChange}
            />
          </label>

          {/* UTM Source */}
          <label className="form-field">
            <span className="form-field__label">UTM Source</span>
            <select name="utm_source" value={form.utm_source} onChange={handleChange}>
              {UTM_SOURCES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>

          {/* Payment Method (locked to COD) */}
          <label className="form-field">
            <span className="form-field__label">Payment Method</span>
            <input type="text" value="COD" disabled />
          </label>
        </div>

        <button
          type="submit" className="btn btn--primary"
          disabled={loading} style={{ marginTop: 16 }}
        >
          {loading ? 'Evaluating...' : 'Run Evaluation'}
        </button>
      </form>

      {/* Error message */}
      {error && <div className="alert alert--danger" style={{ marginTop: 16 }}>{error}</div>}

      {/* Evaluation result card */}
      {result && (
        <div className="order-simulator__result" style={{ marginTop: 20 }}>
          <h3 className="subsection-heading">Evaluation Result</h3>

          {/* Action badge */}
          <div style={{ marginBottom: 12 }}>
            <span className={`badge ${actionColor(result.action)}`}>
              {result.action_label || result.action}
            </span>
          </div>

          {/* Risk score bar */}
          <div className="risk-bar-container">
            <span className="risk-bar-label">Risk Score</span>
            <div className="risk-bar">
              <div
                className="risk-bar__fill"
                style={{
                  width: `${Math.min(result.risk_score ?? 0, 100)}%`,
                  backgroundColor:
                    result.risk_score > 70
                      ? 'var(--color-danger)'
                      : result.risk_score > 40
                      ? 'var(--color-warning)'
                      : 'var(--color-success)',
                }}
              />
            </div>
            <span className="risk-bar-value">{result.risk_score ?? 0}%</span>
          </div>

          {/* Plain English reason — the most prominent element */}
          <div className="result-reason">
            <strong>Operations Reason:</strong> {result.reason}
          </div>

          {/* Address Evaluation Detail */}
          {result.address_evaluation && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--color-bg-secondary, #f8fafc)', borderRadius: 6, border: '1px solid var(--color-border, #e2e8f0)', fontSize: '0.9rem' }}>
              <div style={{ fontWeight: 600, color: 'var(--color-text, #1e293b)', marginBottom: 4 }}>
                Address Assessment ({result.address_evaluation.method === 'llm' ? 'LLM Semantic Analysis' : 'Deterministic Fast-Path'})
              </div>
              <div style={{ color: 'var(--color-text-muted, #64748b)' }}>
                Status: <strong>{result.address_evaluation.completeness}</strong> {result.address_evaluation.has_landmark ? '(Hinglish landmark detected)' : ''} &bull; {result.address_evaluation.detail}
              </div>
            </div>
          )}

          {/* Financial impact breakdown */}
          {result.financial_impact && (
            <div className="result-financials">
              <div className="result-financial-item">
                <span className="result-financial-label">Expected Margin</span>
                <span className="result-financial-value">
                  Rs. {result.financial_impact.expected_margin}
                </span>
              </div>
              <div className="result-financial-item">
                <span className="result-financial-label">Expected RTO Cost</span>
                <span className="result-financial-value">
                  Rs. {result.financial_impact.expected_rto_cost}
                </span>
              </div>
              <div className="result-financial-item">
                <span className="result-financial-label">Net Expected Value</span>
                <span
                  className="result-financial-value"
                  style={{
                    color: result.financial_impact.net_expected_value >= 0
                      ? 'var(--color-success)'
                      : 'var(--color-danger)',
                  }}
                >
                  Rs. {result.financial_impact.net_expected_value}
                </span>
              </div>
            </div>
          )}

          {/* Rules triggered */}
          {result.rules_triggered && result.rules_triggered.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h4 className="subsection-heading">Rules Triggered</h4>
              <ul className="rules-list">
                {result.rules_triggered.map((rule, i) => (
                  <li key={i}>{rule}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default OrderSimulator;
