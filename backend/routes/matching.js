const express = require('express');
const router = express.Router();
const MapController = require('../controllers/mapController');

/**
 * Nearby Distribution Centers for Interactive Map
 * GET /api/matching/nearby/:surplusId
 * Computes road travel times, distances, and eligibility for Leaflet map markers and routing.
 */
router.get('/nearby/:surplusId', MapController.getNearbyCentersForSurplus);

module.exports = router;

