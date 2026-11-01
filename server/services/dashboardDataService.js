/**
 * dashboardDataService.js
 *
 * Provides aggregated analytics for the founder dashboard.
 * Queries MongoDB when connected and seeded; otherwise falls back to
 * direct computation on orders_sample.csv so the dashboard functions
 * immediately without requiring database initialization.
 */

const path = require('path');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Decision = require('../models/Decision');
const { importCSV } = require('./csvImportService');
const { evaluateOrder } = require('../engine/decisionEngine');
const defaultConfig = require('../config/rulesConfig');

let cachedCSVOrders = null;
let cachedCSVDecisions = null;

async function getCachedOrders() {
  if (cachedCSVOrders) return cachedCSVOrders;
  const csvPath = path.resolve(__dirname, '..', '..', 'data', 'orders_sample.csv');
  cachedCSVOrders = await importCSV(csvPath);
  return cachedCSVOrders;
}

async function getCachedDecisions(config = defaultConfig) {
  if (cachedCSVDecisions) return cachedCSVDecisions;
  const orders = await getCachedOrders();
  cachedCSVDecisions = [];
  for (const order of orders) {
    const decision = await evaluateOrder(order, config);
    cachedCSVDecisions.push(decision);
  }
  return cachedCSVDecisions;
}

async function hasMongoOrders() {
  if (mongoose.connection.readyState !== 1) return false;
  try {
    const count = await Order.countDocuments();
    return count > 0;
  } catch (err) {
    return false;
  }
}

/**
 * Returns overall statistics and bucket counts.
 */
async function getStats(config = defaultConfig) {
  const isMongoReady = await hasMongoOrders();
  if (isMongoReady) {
    try {
      const bucketPipeline = [
        {
          $group: {
            _id: '$action',
            count: { $sum: 1 },
            action_label: { $first: '$action_label' },
            total_expected_margin: { $sum: '$financial_impact.expected_margin' },
            total_expected_rto_cost: { $sum: '$financial_impact.expected_rto_cost' },
            total_net_ev: { $sum: '$financial_impact.net_ev' },
          },
        },
        { $sort: { count: -1 } },
      ];
      const buckets = await Decision.aggregate(bucketPipeline);

      const totalPipeline = [
        {
          $group: {
            _id: null,
            total_orders: { $sum: 1 },
            total_expected_margin: { $sum: '$financial_impact.expected_margin' },
            total_expected_rto_cost: { $sum: '$financial_impact.expected_rto_cost' },
            total_net_ev: { $sum: '$financial_impact.net_ev' },
            avg_risk_score: { $avg: '$risk_score' },
          },
        },
      ];
      const totals = await Decision.aggregate(totalPipeline);
      const rawTotal = totals[0] || {};
      const totalOrders = rawTotal.total_orders || 0;
      const totalValue = totalOrders * 649;
      const estimatedSavings = parseFloat((rawTotal.total_expected_rto_cost || 0).toFixed(2));
      const estimatedLosses = parseFloat(((rawTotal.total_expected_margin || 0) * 0.05).toFixed(2));
      const netImpact = parseFloat((estimatedSavings - estimatedLosses).toFixed(2));

      return {
        buckets: buckets.map((b) => ({
          action: b._id,
          action_label: b.action_label,
          count: b.count,
          total_expected_margin: parseFloat((b.total_expected_margin || 0).toFixed(2)),
          total_expected_rto_cost: parseFloat((b.total_expected_rto_cost || 0).toFixed(2)),
          total_net_ev: parseFloat((b.total_net_ev || 0).toFixed(2)),
        })),
        totals: {
          ...rawTotal,
          total_value: totalValue,
          estimated_savings: estimatedSavings,
          estimated_losses: estimatedLosses,
          net_impact: netImpact,
        },
      };
    } catch (e) {
      // Fallback to CSV computation below
    }
  }

  // Compute from CSV
  const decisions = await getCachedDecisions(config);
  const bucketsMap = {};
  let totalMargin = 0;
  let totalRtoCost = 0;
  let totalNetEv = 0;
  let totalRiskScore = 0;

  for (const d of decisions) {
    if (!bucketsMap[d.action]) {
      bucketsMap[d.action] = {
        action: d.action,
        action_label: d.action_label,
        count: 0,
        total_expected_margin: 0,
        total_expected_rto_cost: 0,
        total_net_ev: 0,
      };
    }
    bucketsMap[d.action].count += 1;
    if (d.financial_impact) {
      bucketsMap[d.action].total_expected_margin += d.financial_impact.expected_margin || 0;
      bucketsMap[d.action].total_expected_rto_cost += d.financial_impact.expected_rto_cost || 0;
      bucketsMap[d.action].total_net_ev += d.financial_impact.net_ev || 0;

      totalMargin += d.financial_impact.expected_margin || 0;
      totalRtoCost += d.financial_impact.expected_rto_cost || 0;
      totalNetEv += d.financial_impact.net_ev || 0;
    }
    totalRiskScore += d.risk_score || 0;
  }

  const buckets = Object.values(bucketsMap).map((b) => ({
    ...b,
    total_expected_margin: parseFloat(b.total_expected_margin.toFixed(2)),
    total_expected_rto_cost: parseFloat(b.total_expected_rto_cost.toFixed(2)),
    total_net_ev: parseFloat(b.total_net_ev.toFixed(2)),
  }));

  const totalOrders = decisions.length;
  const totalValue = totalOrders * 649;
  const estimatedSavings = parseFloat(totalRtoCost.toFixed(2));
  const estimatedLosses = parseFloat((totalMargin * 0.05).toFixed(2));
  const netImpact = parseFloat((estimatedSavings - estimatedLosses).toFixed(2));

  return {
    buckets,
    totals: {
      total_orders: totalOrders,
      total_expected_margin: parseFloat(totalMargin.toFixed(2)),
      total_expected_rto_cost: parseFloat(totalRtoCost.toFixed(2)),
      total_net_ev: parseFloat(totalNetEv.toFixed(2)),
      avg_risk_score: totalOrders > 0 ? parseFloat((totalRiskScore / totalOrders).toFixed(3)) : 0,
      total_value: totalValue,
      estimated_savings: estimatedSavings,
      estimated_losses: estimatedLosses,
      net_impact: netImpact,
    },
  };
}

/**
 * Returns state-level breakdown.
 */
async function getRegional() {
  const isMongoReady = await hasMongoOrders();
  if (isMongoReady) {
    try {
      const pipeline = [
        {
          $group: {
            _id: '$state',
            total: { $sum: 1 },
            rto_count: { $sum: { $cond: [{ $eq: ['$final_status', 'RTO'] }, 1, 0] } },
            delivered_count: { $sum: { $cond: [{ $eq: ['$final_status', 'DELIVERED'] }, 1, 0] } },
          },
        },
        {
          $project: {
            state: '$_id',
            total: 1,
            rto_count: 1,
            delivered_count: 1,
            rto_rate: {
              $cond: [
                { $gt: ['$total', 0] },
                { $multiply: [{ $divide: ['$rto_count', '$total'] }, 100] },
                0,
              ],
            },
          },
        },
        { $sort: { rto_rate: -1 } },
      ];
      const results = await Order.aggregate(pipeline);
      return results.map((r) => ({
        state: r.state,
        total: r.total,
        rto_count: r.rto_count,
        delivered_count: r.delivered_count,
        rto_rate: parseFloat(r.rto_rate.toFixed(2)),
      }));
    } catch (e) {}
  }

  const orders = await getCachedOrders();
  const stateMap = {};
  for (const o of orders) {
    const state = o.state || 'Unknown';
    if (!stateMap[state]) {
      stateMap[state] = { state, total: 0, rto_count: 0, delivered_count: 0 };
    }
    stateMap[state].total += 1;
    if (o.final_status === 'RTO') stateMap[state].rto_count += 1;
    else stateMap[state].delivered_count += 1;
  }
  return Object.values(stateMap)
    .map((s) => ({
      ...s,
      rto_rate: parseFloat(((s.rto_count / s.total) * 100).toFixed(2)),
    }))
    .sort((a, b) => b.rto_rate - a.rto_rate);
}

/**
 * Returns UTM source breakdown.
 */
async function getSourceBreakdown() {
  const isMongoReady = await hasMongoOrders();
  if (isMongoReady) {
    try {
      const pipeline = [
        {
          $group: {
            _id: '$utm_source',
            total: { $sum: 1 },
            rto_count: { $sum: { $cond: [{ $eq: ['$final_status', 'RTO'] }, 1, 0] } },
          },
        },
        {
          $project: {
            source: '$_id',
            total: 1,
            rto_count: 1,
            rto_rate: {
              $cond: [
                { $gt: ['$total', 0] },
                { $multiply: [{ $divide: ['$rto_count', '$total'] }, 100] },
                0,
              ],
            },
          },
        },
        { $sort: { rto_rate: -1 } },
      ];
      const results = await Order.aggregate(pipeline);
      return results.map((r) => ({
        source: r.source || 'Unknown',
        total: r.total,
        rto_count: r.rto_count,
        rto_rate: parseFloat(r.rto_rate.toFixed(2)),
      }));
    } catch (e) {}
  }

  const orders = await getCachedOrders();
  const map = {};
  for (const o of orders) {
    const source = o.utm_source || 'Unknown';
    if (!map[source]) {
      map[source] = { source, total: 0, rto_count: 0 };
    }
    map[source].total += 1;
    if (o.final_status === 'RTO') map[source].rto_count += 1;
  }
  return Object.values(map)
    .map((s) => ({
      ...s,
      rto_rate: parseFloat(((s.rto_count / s.total) * 100).toFixed(2)),
    }))
    .sort((a, b) => b.rto_rate - a.rto_rate);
}

/**
 * Returns courier partner breakdown.
 */
async function getCourierBreakdown() {
  const isMongoReady = await hasMongoOrders();
  if (isMongoReady) {
    try {
      const pipeline = [
        {
          $group: {
            _id: '$courier',
            total: { $sum: 1 },
            rto_count: { $sum: { $cond: [{ $eq: ['$final_status', 'RTO'] }, 1, 0] } },
          },
        },
        {
          $project: {
            courier: '$_id',
            total: 1,
            rto_count: 1,
            rto_rate: {
              $cond: [
                { $gt: ['$total', 0] },
                { $multiply: [{ $divide: ['$rto_count', '$total'] }, 100] },
                0,
              ],
            },
          },
        },
        { $sort: { rto_rate: -1 } },
      ];
      const results = await Order.aggregate(pipeline);
      return results.map((r) => ({
        courier: r.courier || 'Unknown',
        total: r.total,
        rto_count: r.rto_count,
        rto_rate: parseFloat(r.rto_rate.toFixed(2)),
      }));
    } catch (e) {}
  }

  const orders = await getCachedOrders();
  const map = {};
  for (const o of orders) {
    const courier = o.courier || 'Unknown';
    if (!map[courier]) {
      map[courier] = { courier, total: 0, rto_count: 0 };
    }
    map[courier].total += 1;
    if (o.final_status === 'RTO') map[courier].rto_count += 1;
  }
  return Object.values(map)
    .map((s) => ({
      ...s,
      rto_rate: parseFloat(((s.rto_count / s.total) * 100).toFixed(2)),
    }))
    .sort((a, b) => b.rto_rate - a.rto_rate);
}

module.exports = {
  getStats,
  getRegional,
  getSourceBreakdown,
  getCourierBreakdown,
  getCachedOrders,
  hasMongoOrders,
};
