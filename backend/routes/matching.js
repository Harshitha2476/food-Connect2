const express = require('express');
const router = express.Router();
const MapController = require('../controllers/mapController');
const MatchingController = require('../controllers/matchingController');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * Nearby Distribution Centers for Interactive Map
 * GET /api/matching/nearby/:surplusId
 * Computes road travel times, distances, and eligibility for Leaflet map markers and routing.
 */
router.get('/nearby/:surplusId', MapController.getNearbyCentersForSurplus);

/**
 * Trigger intelligent matching and greedy allocation for a surplus listing
 * POST /api/matching/trigger/:surplusId
 * Initiates multi-criteria scoring and greedy capacity allocation for eligible centers.
 */
router.post(
  '/trigger/:surplusId',
  authenticate,
  authorize('canteen', 'admin'),
  MatchingController.triggerMatching
);

/**
 * View multi-criteria rankings and scoring breakdown for a surplus listing
 * GET /api/matching/rankings/:surplusId
 */
router.get(
  '/rankings/:surplusId',
  authenticate,
  MatchingController.getRankings
);

/**
 * View all allocation records/offers for a surplus listing
 * GET /api/matching/surplus/:surplusId
 */
router.get(
  '/surplus/:surplusId',
  authenticate,
  MatchingController.getAllocationsForSurplus
);

/**
 * View incoming food allocation offers for distribution center
 * GET /api/matching/offers
 */
router.get(
  '/offers',
  authenticate,
  authorize('ngo', 'admin'),
  MatchingController.getOffers
);

/**
 * View single allocation offer details
 * GET /api/matching/offers/:id
 */
router.get(
  '/offers/:id',
  authenticate,
  MatchingController.getOfferById
);

/**
 * Accept an allocation offer
 * PUT /api/matching/offers/:id/accept
 */
router.put(
  '/offers/:id/accept',
  authenticate,
  authorize('ngo', 'admin'),
  MatchingController.acceptOffer
);

/**
 * Reject an allocation offer with a mandatory reason and evaluate fallback matching
 * PUT /api/matching/offers/:id/reject
 */
router.put(
  '/offers/:id/reject',
  authenticate,
  authorize('ngo', 'admin'),
  MatchingController.rejectOffer
);

/**
 * Process expired offers exceeding timeout and trigger fallback matching
 * POST /api/matching/process-expired
 */
router.post(
  '/process-expired',
  authenticate,
  authorize('admin'),
  MatchingController.processExpiredOffers
);

module.exports = router;
