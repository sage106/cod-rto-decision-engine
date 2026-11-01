/**
 * seedDatabase.js
 * ---------------
 * Reads the historical orders CSV, normalizes and filters records,
 * inserts them into MongoDB, runs the decision engine on every order,
 * stores the decisions, and prints a formatted summary.
 *
 * Usage:
 *   node scripts/seedDatabase.js
 *
 * Environment:
 *   MONGODB_URI — read from ../server/.env or defaults to
 *                 mongodb://localhost:27017/cod_rto_engine
 */

const path = require('path');
const fs = require('fs');

// Ensure packages installed in server/node_modules are resolvable
module.paths.push(path.resolve(__dirname, '..', 'server', 'node_modules'));

const csv = require('csv-parser');
const mongoose = require('mongoose');

// ---------------------------------------------------------------------------
// 1. Resolve environment
// ---------------------------------------------------------------------------
const dotenvPath = path.resolve(__dirname, '..', 'server', '.env');
if (fs.existsSync(dotenvPath)) {
  require('dotenv').config({ path: dotenvPath });
}

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/cod_rto_engine';
const CSV_PATH = path.resolve(__dirname, '..', 'data', 'orders_sample.csv');

// ---------------------------------------------------------------------------
// 2. Import engine + config
// ---------------------------------------------------------------------------
const { evaluateOrder } = require('../server/engine/decisionEngine');
const defaultConfig = require('../server/config/rulesConfig');

// ---------------------------------------------------------------------------
// 3. Financial constants (must match rulesConfig / business memo)
// ---------------------------------------------------------------------------
const AOV = 649;
const GROSS_MARGIN_PCT = 0.62;
const GROSS_MARGIN = AOV * GROSS_MARGIN_PCT; // Rs.402.38
const RTO_COST = 169.40;

// ---------------------------------------------------------------------------
// 4. Helpers
// ---------------------------------------------------------------------------

/** Pad or trim a string to a fixed visible width (left-aligned). */
function pad(str, width) {
  const s = String(str);
  return s.length >= width ? s.slice(0, width) : s + ' '.repeat(width - s.length);
}

/** Pad a string to a fixed width, right-aligned. */
function padRight(str, width) {
  const s = String(str);
  return s.length >= width ? s.slice(0, width) : ' '.repeat(width - s.length) + s;
}

/** Format a number with Indian-style commas (e.g. 1,42,296). */
function indianFormat(num) {
  const n = Math.round(num);
  const s = Math.abs(n).toString();
  if (s.length <= 3) return (n < 0 ? '-' : '') + s;
  const last3 = s.slice(-3);
  const remaining = s.slice(0, -3);
  const formatted =
    remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
  return (n < 0 ? '-' : '') + formatted;
}

// ---------------------------------------------------------------------------
// 5. Read CSV into memory
// ---------------------------------------------------------------------------
function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// 6. Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('========================================');
  console.log(' COD RTO Decision Engine -- Database Seed');
  console.log('========================================\n');

  // --- Connect -----------------------------------------------------------
  console.log(`Connecting to MongoDB: ${MONGODB_URI}`);
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.\n');

  const db = mongoose.connection.db;

  // --- Read CSV ----------------------------------------------------------
  console.log(`Reading CSV: ${CSV_PATH}`);
  const rawRows = await readCSV(CSV_PATH);
  console.log(`Raw rows read: ${rawRows.length}\n`);

  // --- Normalize + Filter ------------------------------------------------
  const orders = rawRows
    .map((row) => {
      const status = (row.final_status || '').trim().toUpperCase();
      return {
        order_id: row.order_id || row.id || null,
        customer_name: row.customer_name || '',
        customer_phone: row.customer_phone || row.phone || '',
        shipping_address: row.shipping_address || row.address || '',
        shipping_city: row.shipping_city || row.city || '',
        shipping_state: row.shipping_state || row.state || '',
        shipping_pincode: row.shipping_pincode || row.pincode || '',
        order_value: parseFloat(row.order_value || row.amount || 0),
        payment_method: (row.payment_method || 'COD').trim().toUpperCase(),
        order_source: row.order_source || row.source || 'Unknown',
        courier_partner: row.courier_partner || row.courier || '',
        customer_prior_orders: parseInt(row.customer_prior_orders || 0, 10),
        customer_prior_rto: parseInt(row.customer_prior_rto || 0, 10),
        final_status: status,
        created_at: row.created_at || row.order_date || new Date().toISOString(),
      };
    })
    .filter((o) => o.final_status === 'DELIVERED' || o.final_status === 'RTO');

  console.log(`Valid orders (DELIVERED or RTO): ${orders.length}\n`);

  // --- Insert orders -----------------------------------------------------
  const ordersCol = db.collection('orders');
  await ordersCol.deleteMany({});
  if (orders.length > 0) {
    await ordersCol.insertMany(orders);
  }
  console.log(`Inserted ${orders.length} orders into "orders" collection.\n`);

  // --- Run decision engine on each order ---------------------------------
  console.log('Running decision engine on each order...\n');

  const decisions = [];
  const bucketCounts = {
    'Ship As-Is': { total: 0, rto: 0, delivered: 0 },
    'Ship After Confirmation': { total: 0, rto: 0, delivered: 0 },
    'Nudge to Prepaid': { total: 0, rto: 0, delivered: 0 },
    'Hold / Cancel': { total: 0, rto: 0, delivered: 0 },
  };

  for (const order of orders) {
    const result = await evaluateOrder(order, defaultConfig);
    const bucket = result.bucket || result.action_label || 'Ship As-Is';

    decisions.push({
      order_id: order.order_id,
      bucket,
      risk_score: result.riskScore || result.risk_score || 0,
      flags: result.flags || [],
      actual_status: order.final_status,
      created_at: new Date(),
    });

    if (bucketCounts[bucket]) {
      bucketCounts[bucket].total += 1;
      if (order.final_status === 'RTO') {
        bucketCounts[bucket].rto += 1;
      } else {
        bucketCounts[bucket].delivered += 1;
      }
    }
  }

  // --- Store decisions ---------------------------------------------------
  const decisionsCol = db.collection('decisions');
  await decisionsCol.deleteMany({});
  if (decisions.length > 0) {
    await decisionsCol.insertMany(decisions);
  }
  console.log(`Stored ${decisions.length} decisions in "decisions" collection.\n`);

  // --- Summary -----------------------------------------------------------
  const totalOrders = orders.length;
  const totalRTO = orders.filter((o) => o.final_status === 'RTO').length;
  const overallRTORate = ((totalRTO / totalOrders) * 100).toFixed(2);

  console.log('========================================');
  console.log(' SEED SUMMARY');
  console.log('========================================\n');

  console.log(`Total Orders Processed:  ${totalOrders.toLocaleString()}`);
  console.log(`Total RTO:               ${totalRTO.toLocaleString()} (${overallRTORate}%)`);
  console.log(`Total Delivered:         ${(totalOrders - totalRTO).toLocaleString()}\n`);

  // Bucket distribution table
  console.log('BUCKET DISTRIBUTION:');
  const hdrSep =
    '+----------------------------+-------+--------+';
  console.log(hdrSep);
  console.log(
    '| ' +
      pad('Bucket', 26) +
      ' | ' +
      padRight('Count', 5) +
      ' | ' +
      padRight('Pct', 6) +
      ' |'
  );
  console.log(hdrSep);

  for (const [name, data] of Object.entries(bucketCounts)) {
    const pct = ((data.total / totalOrders) * 100).toFixed(1) + '%';
    console.log(
      '| ' +
        pad(name, 26) +
        ' | ' +
        padRight(String(data.total), 5) +
        ' | ' +
        padRight(pct, 6) +
        ' |'
    );
  }
  console.log(hdrSep);
  console.log('');

  // Accuracy table
  console.log('ACCURACY ANALYSIS (Actual Outcome per Bucket):');
  const accSep =
    '+----------------------------+----------+-----------+----------+';
  console.log(accSep);
  console.log(
    '| ' +
      pad('Bucket', 26) +
      ' | ' +
      padRight('Were RTO', 8) +
      ' | ' +
      padRight('Were DEL', 9) +
      ' | ' +
      padRight('RTO %', 8) +
      ' |'
  );
  console.log(accSep);

  for (const [name, data] of Object.entries(bucketCounts)) {
    const rtoPct =
      data.total > 0
        ? ((data.rto / data.total) * 100).toFixed(1) + '%'
        : '0.0%';
    console.log(
      '| ' +
        pad(name, 26) +
        ' | ' +
        padRight(String(data.rto), 8) +
        ' | ' +
        padRight(String(data.delivered), 9) +
        ' | ' +
        padRight(rtoPct, 8) +
        ' |'
    );
  }
  console.log(accSep);
  console.log('');

  // Financial summary
  const holdData = bucketCounts['Hold / Cancel'];
  const nudgeData = bucketCounts['Nudge to Prepaid'];

  // RTOs avoided = RTOs in Hold/Cancel bucket (would have been prevented)
  const rtosAvoided = holdData.rto;
  const rtoCostAvoided = rtosAvoided * RTO_COST;

  // Potential margin lost = delivered orders in Hold/Cancel that were genuine
  const falsePositives = holdData.delivered;
  const marginAtRisk = falsePositives * GROSS_MARGIN;

  // Nudge to prepaid: assume 30% conversion, each saves RTO cost
  const nudgeConversions = Math.round(nudgeData.total * 0.3);
  const nudgeSavings = nudgeConversions * RTO_COST;

  const netImpact = rtoCostAvoided + nudgeSavings - marginAtRisk;

  console.log('FINANCIAL IMPACT (Estimated):');
  console.log('-------------------------------------------');
  console.log(
    `  RTO Cost Avoided (Hold/Cancel):   Rs. ${indianFormat(rtoCostAvoided)}`
  );
  console.log(
    `  Nudge-to-Prepaid Savings (est.):  Rs. ${indianFormat(nudgeSavings)}`
  );
  console.log(
    `  Potential Margin at Risk:          Rs. ${indianFormat(marginAtRisk)}`
  );
  console.log(
    `  Net Financial Impact:             Rs. ${indianFormat(netImpact)}`
  );
  if (marginAtRisk > 0) {
    const roi = ((netImpact / marginAtRisk) * 100).toFixed(1);
    console.log(`  ROI on Gating:                    ${roi}%`);
  }
  console.log('');

  // --- Disconnect --------------------------------------------------------
  await mongoose.disconnect();
  console.log('Database connection closed. Seed complete.');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
