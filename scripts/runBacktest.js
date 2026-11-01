/**
 * runBacktest.js
 * ---------------
 * Loads all historical orders from MongoDB, runs the decision engine
 * on every record, compares the engine's bucket assignment to the
 * actual outcome, and prints a detailed backtest report with
 * financial impact analysis.
 *
 * Usage:
 *   node scripts/runBacktest.js
 *   node scripts/runBacktest.js --max-prior-rto 3
 *   node scripts/runBacktest.js --high-value 1200 --mid-value 800
 *
 * Flags:
 *   --max-prior-rto <n>   Override the max prior RTO threshold
 *   --high-value <n>      Override high order value threshold (Rs.)
 *   --mid-value <n>       Override mid order value threshold (Rs.)
 */

const path = require('path');
const fs = require('fs');

// Ensure packages installed in server/node_modules are resolvable
module.paths.push(path.resolve(__dirname, '..', 'server', 'node_modules'));

const mongoose = require('mongoose');

// ---------------------------------------------------------------------------
// 1. Environment
// ---------------------------------------------------------------------------
const dotenvPath = path.resolve(__dirname, '..', 'server', '.env');
if (fs.existsSync(dotenvPath)) {
  require('dotenv').config({ path: dotenvPath });
}

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/cod_rto_engine';

// ---------------------------------------------------------------------------
// 2. Import engine + default config + CSV loader
// ---------------------------------------------------------------------------
const { evaluateOrder } = require('../server/engine/decisionEngine');
const defaultConfig = require('../server/config/rulesConfig');
const { importCSV } = require('../server/services/csvImportService');

// ---------------------------------------------------------------------------
// 3. Financial constants
// ---------------------------------------------------------------------------
const AOV = 649;
const GROSS_MARGIN_PCT = 0.62;
const GROSS_MARGIN = AOV * GROSS_MARGIN_PCT; // Rs.402.38
const RTO_COST = 169.40;

// ---------------------------------------------------------------------------
// 4. CLI argument parsing
// ---------------------------------------------------------------------------
function parseArgs() {
  const args = process.argv.slice(2);
  const overrides = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--max-prior-rto' && args[i + 1]) {
      overrides.maxPriorRTO = parseInt(args[++i], 10);
    } else if (args[i] === '--high-value' && args[i + 1]) {
      overrides.highValueThreshold = parseFloat(args[++i]);
    } else if (args[i] === '--mid-value' && args[i + 1]) {
      overrides.midValueThreshold = parseFloat(args[++i]);
    }
  }
  return overrides;
}

// ---------------------------------------------------------------------------
// 5. Formatting helpers
// ---------------------------------------------------------------------------

function pad(str, width) {
  const s = String(str);
  return s.length >= width ? s.slice(0, width) : s + ' '.repeat(width - s.length);
}

function padRight(str, width) {
  const s = String(str);
  return s.length >= width ? s.slice(0, width) : ' '.repeat(width - s.length) + s;
}

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

function line(char, len) {
  return char.repeat(len);
}

// ---------------------------------------------------------------------------
// 6. Main
// ---------------------------------------------------------------------------
async function main() {
  const overrides = parseArgs();

  // Merge overrides into config
  const config = { ...defaultConfig };
  if (overrides.maxPriorRTO !== undefined) {
    config.maxPriorRTO = overrides.maxPriorRTO;
  }
  if (overrides.highValueThreshold !== undefined) {
    config.highValueThreshold = overrides.highValueThreshold;
  }
  if (overrides.midValueThreshold !== undefined) {
    config.midValueThreshold = overrides.midValueThreshold;
  }

  // --- Load orders -------------------------------------------------------
  let orders = [];
  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 2000 });
    const db = mongoose.connection.db;
    orders = await db.collection('orders').find({}).toArray();
    if (orders.length > 0) {
      console.log(`Loaded ${orders.length} orders from MongoDB.`);
    }
  } catch (err) {
    // MongoDB unavailable, proceed to CSV fallback
  }

  if (!orders || orders.length === 0) {
    const csvPath = path.resolve(__dirname, '..', 'data', 'orders_sample.csv');
    console.log(`Loading orders directly from CSV: ${csvPath}`);
    orders = await importCSV(csvPath);
    console.log(`Loaded ${orders.length} valid orders from CSV.\n`);
  }

  // --- Run engine --------------------------------------------------------
  const bucketCounts = {
    'Ship As-Is': { total: 0, rto: 0, delivered: 0 },
    'Ship After Confirmation': { total: 0, rto: 0, delivered: 0 },
    'Nudge to Prepaid': { total: 0, rto: 0, delivered: 0 },
    'Hold / Cancel': { total: 0, rto: 0, delivered: 0 },
  };

  const bucketNames = Object.keys(bucketCounts);

  for (const order of orders) {
    const result = await evaluateOrder(order, config);
    const bucket = result.bucket || result.action_label || 'Ship As-Is';

    if (!bucketCounts[bucket]) continue;

    bucketCounts[bucket].total += 1;
    if (order.final_status === 'RTO') {
      bucketCounts[bucket].rto += 1;
    } else {
      bucketCounts[bucket].delivered += 1;
    }
  }

  const totalOrders = orders.length;
  const totalRTO = orders.filter((o) => o.final_status === 'RTO').length;
  const totalDelivered = totalOrders - totalRTO;

  // =====================================================================
  // PRINT REPORT
  // =====================================================================

  console.log('');
  console.log(line('=', 56));
  console.log(' COD RTO Decision Engine -- Backtest Report');
  console.log(line('=', 56));
  console.log('');

  // Config overrides
  if (Object.keys(overrides).length > 0) {
    console.log('CONFIG OVERRIDES:');
    for (const [key, val] of Object.entries(overrides)) {
      console.log(`  ${key}: ${val}`);
    }
    console.log('');
  }

  console.log(`Total Orders Evaluated:  ${totalOrders.toLocaleString()}`);
  console.log(
    `Overall RTO Rate:        ${totalRTO.toLocaleString()} / ${totalOrders.toLocaleString()} (${((totalRTO / totalOrders) * 100).toFixed(2)}%)`
  );
  console.log('');

  // --- Bucket Distribution -----------------------------------------------
  console.log('BUCKET DISTRIBUTION:');
  const bdrTop =
    '+----------------------------+-------+--------+';
  console.log(bdrTop);
  console.log(
    '| ' +
      pad('Bucket', 26) +
      ' | ' +
      padRight('Count', 5) +
      ' | ' +
      padRight('Pct', 6) +
      ' |'
  );
  console.log(bdrTop);

  for (const name of bucketNames) {
    const data = bucketCounts[name];
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
  console.log(bdrTop);
  console.log('');

  // --- Accuracy Analysis -------------------------------------------------
  console.log('ACCURACY ANALYSIS:');
  const accTop =
    '+----------------------------+----------+-----------+----------+';
  console.log(accTop);
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
  console.log(accTop);

  for (const name of bucketNames) {
    const data = bucketCounts[name];
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
  console.log(accTop);
  console.log('');

  // --- Confusion-style summary -------------------------------------------
  console.log('DECISION QUALITY:');
  const holdData = bucketCounts['Hold / Cancel'];
  const shipData = bucketCounts['Ship As-Is'];

  const truePositives = holdData.rto;       // correctly gated RTOs
  const falsePositives = holdData.delivered; // genuine orders we would have blocked
  const trueNegatives = shipData.delivered;  // correctly shipped good orders
  const falseNegatives = shipData.rto;       // RTOs that slipped through

  console.log(`  True Positives  (Hold + was RTO):       ${truePositives}`);
  console.log(`  False Positives (Hold + was Delivered):  ${falsePositives}`);
  console.log(`  True Negatives  (Ship + was Delivered):  ${trueNegatives}`);
  console.log(`  False Negatives (Ship + was RTO):        ${falseNegatives}`);

  if (truePositives + falsePositives > 0) {
    const precision =
      ((truePositives / (truePositives + falsePositives)) * 100).toFixed(1);
    console.log(`  Precision (Hold bucket):                 ${precision}%`);
  }
  if (truePositives + falseNegatives > 0) {
    const recall =
      ((truePositives / (truePositives + falseNegatives)) * 100).toFixed(1);
    console.log(`  Recall (RTO capture in Hold):            ${recall}%`);
  }
  console.log('');

  // --- Financial Impact ---------------------------------------------------
  console.log('FINANCIAL IMPACT:');
  console.log(line('-', 50));

  const rtosAvoided = holdData.rto;
  const rtoCostAvoided = rtosAvoided * RTO_COST;

  const marginAtRisk = falsePositives * GROSS_MARGIN;

  // Nudge bucket: assume 30% prepaid conversion rate
  const nudgeData = bucketCounts['Nudge to Prepaid'];
  const nudgeConversions = Math.round(nudgeData.total * 0.3);
  const nudgeSavings = nudgeConversions * RTO_COST;

  // Confirmation bucket: assume 20% of RTOs caught
  const confirmData = bucketCounts['Ship After Confirmation'];
  const confirmCaught = Math.round(confirmData.rto * 0.2);
  const confirmSavings = confirmCaught * RTO_COST;

  const totalSavings = rtoCostAvoided + nudgeSavings + confirmSavings;
  const netImpact = totalSavings - marginAtRisk;

  console.log(
    `  Estimated RTO Cost Avoided:     Rs. ${indianFormat(rtoCostAvoided)}`
  );
  console.log(
    `  Nudge-to-Prepaid Savings:       Rs. ${indianFormat(nudgeSavings)}`
  );
  console.log(
    `  Confirmation Savings:           Rs. ${indianFormat(confirmSavings)}`
  );
  console.log(
    `  Total Savings:                  Rs. ${indianFormat(totalSavings)}`
  );
  console.log(
    `  Potential Margin at Risk:       Rs. ${indianFormat(marginAtRisk)}`
  );
  console.log(
    `  Net Financial Impact:           Rs. ${indianFormat(netImpact)}`
  );

  if (marginAtRisk > 0) {
    const roi = ((netImpact / marginAtRisk) * 100).toFixed(1);
    console.log(`  ROI on Gating:                  ${roi}%`);
  }

  console.log('');

  // --- Monthly projection ------------------------------------------------
  const monthlyOrders = 3000;
  const scaleFactor = monthlyOrders / totalOrders;

  console.log('MONTHLY PROJECTION (3,000 orders/month):');
  console.log(line('-', 50));
  console.log(
    `  Projected RTOs Avoided:         ${Math.round(rtosAvoided * scaleFactor)}`
  );
  console.log(
    `  Projected Monthly Savings:      Rs. ${indianFormat(netImpact * scaleFactor)}`
  );
  console.log(
    `  Projected Annual Savings:       Rs. ${indianFormat(netImpact * scaleFactor * 12)}`
  );
  console.log('');

  // --- Disconnect --------------------------------------------------------
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log('Database connection closed.');
  }
  console.log('Backtest complete.');
}

main().catch((err) => {
  console.error('Backtest failed:', err);
  process.exit(1);
});
