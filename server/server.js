/**
 * server.js
 *
 * Main entry point for the COD RTO Decision Engine backend API.
 * Sets up Express middleware, connects to MongoDB, mounts API routes,
 * and handles graceful startup and shutdown.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Load environment variables from .env if present
const dotenvPath = path.resolve(__dirname, '.env');
if (fs.existsSync(dotenvPath)) {
  require('dotenv').config({ path: dotenvPath });
} else {
  require('dotenv').config();
}

// Route handlers
const orderRoutes = require('./routes/orderRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const configRoutes = require('./routes/configRoutes');
const whatsappRoutes = require('./routes/whatsappRoutes');
const backtestRoutes = require('./routes/backtestRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cod_rto_engine';

// Security and utility middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// API Routes
app.use('/api/orders', orderRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/config', configRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/backtest', backtestRoutes);

// Serve static frontend build if present
const buildPath = path.resolve(__dirname, '..', 'client', 'build');
if (fs.existsSync(buildPath)) {
  app.use(express.static(buildPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(buildPath, 'index.html'));
  });
}

// 404 handler for unknown API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `API endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

// Global error handling middleware
app.use(errorHandler);

// Database connection helper
async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 2000,
    });
    console.log(`[INFO] Connected to MongoDB at ${MONGODB_URI}`);
  } catch (err) {
    console.warn(`[WARN] MongoDB connection failed: ${err.message}`);
    console.warn('[WARN] Running in dataset mode. Full analytics and simulations are fully operational.');
  }
}

// Start server if executed directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[INFO] COD RTO Decision Engine API running on port ${PORT}`);
    console.log(`[INFO] Access the dashboard at http://localhost:${PORT}`);
  });
  connectDB().catch(() => {});
}

module.exports = app;
