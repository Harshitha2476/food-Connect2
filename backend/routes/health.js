const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database/connection');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * @route   GET /api/health
 * @desc    System health check & database status
 * @access  Public
 */
router.get('/', (req, res) => {
  try {
    const db = getDatabase();

    // Verify DB connectivity with quick table counts
    const counts = {
      users: db.prepare('SELECT COUNT(*) as c FROM users').get().c,
      canteens: db.prepare('SELECT COUNT(*) as c FROM canteens').get().c,
      distributionCenters: db.prepare('SELECT COUNT(*) as c FROM distribution_centers').get().c,
      surplusListings: db.prepare('SELECT COUNT(*) as c FROM food_surplus_listings').get().c,
      allocations: db.prepare('SELECT COUNT(*) as c FROM matching_allocations').get().c,
      pickups: db.prepare('SELECT COUNT(*) as c FROM pickup_records').get().c,
    };

    return sendSuccess(res, 200, 'Campus FoodConnect API is operational', {
      status: 'UP',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      database: {
        engine: 'SQLite3 (better-sqlite3)',
        status: 'connected',
        records: counts,
      },
      version: '1.0.0',
    });
  } catch (error) {
    return sendError(res, 503, 'Service Unavailable - Database connection failed', error.message);
  }
});

module.exports = router;

