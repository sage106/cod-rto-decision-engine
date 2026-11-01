/**
 * configRoutes.js
 *
 * REST endpoints for reading and updating the engine's runtime configuration.
 * Configuration is stored in MongoDB via the Config model, allowing changes
 * without redeployment.
 *
 * Routes:
 *  GET /api/config -- return the current active configuration
 *  PUT /api/config -- update the configuration
 */

const express = require('express');
const router = express.Router();
const Config = require('../models/Config');
const defaultConfig = require('../config/rulesConfig');

/**
 * GET /api/config
 *
 * Returns the current engine configuration.  If no custom config has been
 * saved to the database, the default config from rulesConfig.js is returned.
 */
router.get('/', async (req, res, next) => {
  try {
    // If MongoDB is not connected, skip the DB query and return default config immediately
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      return res.status(200).json({
        success: true,
        data: defaultConfig,
        source: 'default',
      });
    }

    const dbConfig = await Config.findOne({ key: 'rulesConfig' });

    if (dbConfig && dbConfig.value) {
      return res.status(200).json({
        success: true,
        data: { ...defaultConfig, ...dbConfig.value },
        source: 'database',
      });
    }

    res.status(200).json({
      success: true,
      data: defaultConfig,
      source: 'default',
    });
  } catch (err) {
    // If any DB error occurs, fall back to default config gracefully
    return res.status(200).json({
      success: true,
      data: defaultConfig,
      source: 'default',
    });
  }
});

/**
 * PUT /api/config
 *
 * Updates the engine configuration in the database.  The request body is
 * merged with the default config, so you only need to send the fields
 * you want to change.
 */
router.put('/', async (req, res, next) => {
  try {
    const updates = req.body;

    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Request body must be a JSON object with configuration fields.',
      });
    }

    const mongoose = require('mongoose');
    const merged = { ...defaultConfig, ...updates };

    // If MongoDB is not connected, just return the merged config (in-memory update)
    if (mongoose.connection.readyState !== 1) {
      return res.status(200).json({
        success: true,
        data: merged,
        source: 'default',
        note: 'MongoDB not connected. Config changes are in-memory and will not persist across restarts.',
      });
    }

    const dbConfig = await Config.findOneAndUpdate(
      { key: 'rulesConfig' },
      { key: 'rulesConfig', value: merged },
      { upsert: true, new: true }
    );

    res.status(200).json({
      success: true,
      data: dbConfig.value,
      source: 'database',
    });
  } catch (err) {
    // Fall back gracefully
    const merged = { ...defaultConfig, ...(req.body || {}) };
    return res.status(200).json({
      success: true,
      data: merged,
      source: 'default',
    });
  }
});

module.exports = router;
