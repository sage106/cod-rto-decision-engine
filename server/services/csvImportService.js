/**
 * csvImportService.js
 *
 * Reads the orders_sample.csv dataset, normalises each record, and returns
 * an array of order objects ready for insertion into MongoDB or direct
 * engine evaluation.
 *
 * Only DELIVERED and RTO records are retained -- any other final_status
 * values are filtered out to keep the dataset clean for analysis.
 */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

/**
 * Import orders from a CSV file.
 *
 * @param {string} filePath - Absolute or relative path to the CSV file.
 * @returns {Promise<Array<Object>>} Array of normalised order objects.
 */
function importCSV(filePath) {
  return new Promise((resolve, reject) => {
    const orders = [];
    const resolvedPath = path.resolve(filePath);

    if (!fs.existsSync(resolvedPath)) {
      return reject(new Error(`CSV file not found: ${resolvedPath}`));
    }

    fs.createReadStream(resolvedPath)
      .pipe(csv())
      .on('data', (row) => {
        // Normalise final_status: uppercase, trimmed
        const rawStatus = (row.final_status || '').trim().toUpperCase();

        // Only keep DELIVERED and RTO records
        if (rawStatus !== 'DELIVERED' && rawStatus !== 'RTO') {
          return;
        }

        const order = {
          order_id: (row.order_id || '').trim(),
          order_datetime: row.order_datetime ? new Date(row.order_datetime) : new Date(),
          customer_name: (row.customer_name || '').trim(),
          phone: (row.phone || '').trim(),
          address: (row.address || '').trim(),
          city: (row.city || '').trim(),
          state: (row.state || '').trim(),
          pincode: (row.pincode || '').trim(),
          order_value: parseFloat(row.order_value) || 0,
          items: (row.items || '').trim(),
          num_items: parseInt(row.num_items, 10) || 1,
          customer_prior_orders: parseInt(row.customer_prior_orders, 10) || 0,
          customer_prior_rto: parseInt(row.customer_prior_rto, 10) || 0,
          utm_source: (row.utm_source || '').trim(),
          courier: (row.courier || '').trim(),
          payment_method: (row.payment_method || 'COD').trim(),
          final_status: rawStatus,
        };

        orders.push(order);
      })
      .on('end', () => {
        resolve(orders);
      })
      .on('error', (err) => {
        reject(err);
      });
  });
}

module.exports = { importCSV };
