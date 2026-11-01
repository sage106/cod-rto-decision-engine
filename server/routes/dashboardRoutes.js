/**
 * dashboardRoutes.js
 *
 * REST endpoints for dashboard analytics. Uses MongoDB aggregation when connected
 * and populated, with seamless fallback to dataset analytics.
 *
 * Routes:
 *  GET /api/dashboard/stats             -- overall action distribution and financial totals
 *  GET /api/dashboard/regional          -- RTO rates grouped by state
 *  GET /api/dashboard/source-breakdown  -- RTO rates grouped by utm_source
 *  GET /api/dashboard/courier-breakdown -- RTO rates grouped by courier
 */

const express = require('express');
const router = express.Router();
const dashboardDataService = require('../services/dashboardDataService');

/**
 * GET /api/dashboard/stats
 */
router.get('/stats', async (req, res, next) => {
  try {
    const data = await dashboardDataService.getStats();
    res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/dashboard/regional
 */
router.get('/regional', async (req, res, next) => {
  try {
    const data = await dashboardDataService.getRegional();
    res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/dashboard/source-breakdown
 */
router.get('/source-breakdown', async (req, res, next) => {
  try {
    const data = await dashboardDataService.getSourceBreakdown();
    res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/dashboard/courier-breakdown
 */
router.get('/courier-breakdown', async (req, res, next) => {
  try {
    const data = await dashboardDataService.getCourierBreakdown();
    res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
