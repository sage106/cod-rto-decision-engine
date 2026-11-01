/**
 * apiClient.js — Centralized API helper layer.
 * Provides an Axios instance configured with the /api base URL
 * and exports named functions for every backend endpoint.
 */
import axios from 'axios';

/* Axios instance — the proxy in package.json forwards /api to localhost:5000 */
const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

/* ---- Dashboard analytics ---- */

/** Fetch aggregate dashboard statistics (buckets + totals). */
export const fetchDashboardStats = () =>
  api.get('/dashboard/stats').then((r) => r.data);

/** Fetch per-state order counts and RTO rates. */
export const fetchRegionalData = () =>
  api.get('/dashboard/regional').then((r) => r.data);

/** Fetch UTM-source level breakdown. */
export const fetchSourceBreakdown = () =>
  api.get('/dashboard/source-breakdown').then((r) => r.data);

/** Fetch courier-level breakdown. */
export const fetchCourierBreakdown = () =>
  api.get('/dashboard/courier-breakdown').then((r) => r.data);

/* ---- Order evaluation ---- */

/** Submit an order for real-time risk evaluation. */
export const evaluateOrder = (orderData) =>
  api.post('/orders/evaluate', orderData).then((r) => r.data);

/* ---- Configuration ---- */

/** Retrieve the current rule-engine configuration. */
export const fetchConfig = () =>
  api.get('/config').then((r) => r.data);

/** Persist updated configuration to the backend. */
export const updateConfig = (config) =>
  api.put('/config', config).then((r) => r.data);

/* ---- Backtesting ---- */

/** Run a backtest using the supplied configuration object. */
export const runBacktest = (config) =>
  api.post('/backtest', { config }).then((r) => r.data);

/* ---- WhatsApp simulation ---- */

/** Start a new WhatsApp confirmation/nudge session for an order. */
export const startWhatsAppSession = (orderId, flowType, orderDetails) =>
  api.post('/whatsapp/start', {
    order_id: orderId,
    flow_type: flowType,
    order_details: orderDetails,
  }).then((r) => r.data);

/** Send a customer reply into an active WhatsApp session. */
export const sendWhatsAppReply = (orderId, reply) =>
  api.post('/whatsapp/reply', { order_id: orderId, reply }).then((r) => r.data);

/** Simulate a timeout event (12h or 24h) on an active session. */
export const simulateTimeout = (orderId, timeoutType) =>
  api.post('/whatsapp/timeout', {
    order_id: orderId,
    timeout_type: timeoutType,
  }).then((r) => r.data);

/** Retrieve the current session state for a given order. */
export const getWhatsAppSession = (orderId) =>
  api.get(`/whatsapp/session/${orderId}`).then((r) => r.data);

export default api;
