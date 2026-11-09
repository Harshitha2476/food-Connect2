const express = require('express');
const router = express.Router();
const healthRoutes = require('./health');
const authRoutes = require('./auth');
const surplusRoutes = require('./surplus');
const centerRoutes = require('./center');
const matchingRoutes = require('./matching');
const { sendSuccess } = require('../utils/response');

// Mount routes
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/surplus', surplusRoutes);
router.use('/centers', centerRoutes);
router.use('/matching', matchingRoutes);

// API root info
router.get('/', (req, res) => {
  return sendSuccess(res, 200, 'Welcome to Campus FoodConnect API', {
    system: 'Campus FoodConnect – Intelligent Surplus Food Tracking and Redistribution System',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        me: 'GET /api/auth/me (Protected)',
        changePassword: 'PUT /api/auth/change-password (Protected)',
        adminCreateUser: 'POST /api/auth/admin/users (Admin only)',
      },
      surplus: {
        create: 'POST /api/surplus (Canteen, Admin)',
        list: 'GET /api/surplus',
        my: 'GET /api/surplus/my (Canteen)',
        get: 'GET /api/surplus/:id',
        update: 'PUT /api/surplus/:id (Canteen, Admin)',
        cancel: 'DELETE /api/surplus/:id (Canteen, Admin)',
        safetyVerification: 'PUT /api/surplus/:id/safety (Safety Officer, Admin)',
      },
      centers: {
        create: 'POST /api/centers (NGO, Admin)',
        list: 'GET /api/centers',
        my: 'GET /api/centers/my (NGO)',
        get: 'GET /api/centers/:id',
        update: 'PUT /api/centers/:id (NGO, Admin)',
        updateDemand: 'PUT /api/centers/:id/demand (NGO, Admin)',
        updateCapacity: 'PUT /api/centers/:id/capacity (NGO, Admin)',
      },
      matching: {
        nearbyCentersMap: 'GET /api/matching/nearby/:surplusId',
        triggerMatching: 'POST /api/matching/trigger/:surplusId (Canteen, Admin)',
        rankings: 'GET /api/matching/rankings/:surplusId (Protected)',
        surplusAllocations: 'GET /api/matching/surplus/:surplusId (Protected)',
        offers: 'GET /api/matching/offers (NGO, Admin)',
        offerDetails: 'GET /api/matching/offers/:id (Protected)',
        acceptOffer: 'PUT /api/matching/offers/:id/accept (NGO, Admin)',
        rejectOffer: 'PUT /api/matching/offers/:id/reject (NGO, Admin)',
        processExpired: 'POST /api/matching/process-expired (Admin)',
      },
      pickups: 'Phase 5 (Volunteer Pickup, OTP Verification)',
      analytics: 'Phase 6 (Waste Metrics, Impact Analytics)',
    },
  });
});

module.exports = router;
