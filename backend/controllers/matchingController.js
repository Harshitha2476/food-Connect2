const MatchingService = require('../services/matchingService');
const AllocationModel = require('../models/Allocation');
const SurplusModel = require('../models/Surplus');
const CenterModel = require('../models/Center');
const CanteenModel = require('../models/Canteen');
const { sendSuccess, sendError } = require('../utils/response');
const { maskPhone } = require('../utils/privacy');

/**
 * Intelligent Matching & Allocation Controller
 * Coordinates multi-criteria ranking, greedy allocation, offer accept/reject,
 * and fallback allocation workflows.
 */
class MatchingController {
  /**
   * Trigger intelligent matching and greedy allocation for a surplus listing
   * POST /api/matching/trigger/:surplusId
   */
  static async triggerMatching(req, res, next) {
    try {
      const surplusId = parseInt(req.params.surplusId, 10);
      const surplus = SurplusModel.findById(surplusId);

      if (!surplus) {
        return sendError(res, 404, `Surplus food listing #${surplusId} not found.`);
      }

      // Authorization: Only owning canteen coordinator or admin can trigger matching
      if (req.user.role === 'canteen') {
        const canteen = CanteenModel.findByUserId(req.user.id);
        if (!canteen || surplus.canteenId !== canteen.id) {
          return sendError(res, 403, "Access denied: You can only trigger matching for your own canteen's surplus listings.");
        }
      } else if (req.user.role !== 'admin') {
        return sendError(res, 403, 'Access denied: Only canteen coordinators or administrators can initiate food matching.');
      }

      const result = MatchingService.runGreedyAllocation(surplusId, req.user);

      if (!result.success) {
        return sendError(res, 400, result.message, {
          reasons: result.reasons || [],
          remainingAvailableKg: result.remainingAvailableKg,
        });
      }

      return sendSuccess(res, 200, result.message, {
        surplusId,
        allocationStatus: result.status,
        allocations: result.allocations,
        remainingAvailableKg: result.remainingAvailableKg,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * View ranked distribution centers for a surplus listing with scores breakdown
   * GET /api/matching/rankings/:surplusId
   */
  static async getRankings(req, res, next) {
    try {
      const surplusId = parseInt(req.params.surplusId, 10);
      const surplus = SurplusModel.findById(surplusId);

      if (!surplus) {
        return sendError(res, 404, `Surplus food listing #${surplusId} not found.`);
      }

      const rankings = MatchingService.getRankedCenters(surplusId);

      // Sanitize phone numbers for non-owning callers
      const sanitizedEligible = rankings.eligibleCenters.map((c) => ({
        ...c,
        contactPhone: req.user.role === 'admin' ? c.contactPhone : maskPhone(c.contactPhone),
      }));

      const sanitizedIneligible = rankings.ineligibleCenters.map((c) => ({
        ...c,
        contactPhone: req.user.role === 'admin' ? c.contactPhone : maskPhone(c.contactPhone),
      }));

      return sendSuccess(res, 200, `Evaluated and ranked ${rankings.allCenters.length} distribution center(s).`, {
        surplus: {
          id: surplus.id,
          foodName: surplus.foodName,
          category: surplus.category,
          quantityKg: surplus.quantityKg,
          availableQuantityKg: surplus.availableQuantityKg,
          safetyStatus: surplus.safetyStatus,
          status: surplus.status,
        },
        surplusEligible: rankings.surplusEligible,
        surplusIneligibilityReasons: rankings.surplusIneligibilityReasons,
        scoringWeights: {
          demand: '35%',
          capacity: '25%',
          travelTime: '25%',
          urgency: '15%',
          formula: 'S = 0.35D + 0.25C + 0.25T + 0.15U',
        },
        eligibleCenters: sanitizedEligible,
        ineligibleCenters: sanitizedIneligible,
        summary: {
          totalEvaluated: rankings.allCenters.length,
          eligibleCount: rankings.eligibleCenters.length,
          ineligibleCount: rankings.ineligibleCenters.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Retrieve all allocation offers/records for a specific surplus listing
   * GET /api/matching/surplus/:surplusId
   */
  static async getAllocationsForSurplus(req, res, next) {
    try {
      const surplusId = parseInt(req.params.surplusId, 10);
      const surplus = SurplusModel.findById(surplusId);

      if (!surplus) {
        return sendError(res, 404, `Surplus food listing #${surplusId} not found.`);
      }

      const allocations = AllocationModel.findAll({ surplusId });

      return sendSuccess(res, 200, `Retrieved ${allocations.length} allocation record(s) for surplus #${surplusId}.`, {
        surplusId,
        allocations,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * View offers for a distribution center
   * GET /api/matching/offers
   */
  static async getOffers(req, res, next) {
    try {
      let centerId = null;

      if (req.user.role === 'ngo') {
        const center = CenterModel.findByUserId(req.user.id);
        if (!center) {
          return sendSuccess(res, 200, 'No distribution center registered for this account.', { offers: [] });
        }
        centerId = center.id;
      } else if (req.user.role === 'admin') {
        centerId = req.query.centerId ? parseInt(req.query.centerId, 10) : null;
      } else {
        return sendError(res, 403, 'Access denied: Only NGO coordinators or administrators can view distribution center offers.');
      }

      const statusFilter = req.query.status || null;
      const offers = AllocationModel.findAll({ centerId, status: statusFilter });

      return sendSuccess(res, 200, `Retrieved ${offers.length} offer(s).`, {
        offers,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * View details of a specific allocation offer
   * GET /api/matching/offers/:id
   */
  static async getOfferById(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const offer = AllocationModel.findById(id);

      if (!offer) {
        return sendError(res, 404, `Allocation offer #${id} not found.`);
      }

      // Check access permission
      const isOwnerNgo = req.user.role === 'ngo' && offer.centerUserId === req.user.id;
      const isOwnerCanteen = req.user.role === 'canteen' && offer.canteenUserId === req.user.id;
      const isAdmin = req.user.role === 'admin';

      if (!isOwnerNgo && !isOwnerCanteen && !isAdmin) {
        return sendError(res, 403, 'Access denied: You are not authorized to view this allocation offer.');
      }

      return sendSuccess(res, 200, `Retrieved allocation offer #${id}.`, {
        offer,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Accept an allocation offer
   * PUT /api/matching/offers/:id/accept
   */
  static async acceptOffer(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const updated = MatchingService.acceptOffer(id, req.user);

      return sendSuccess(res, 200, `Offer #${id} successfully accepted.`, {
        allocation: updated,
      });
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.statusCode, error.message);
      }
      next(error);
    }
  }

  /**
   * Reject an allocation offer with a mandatory reason and trigger fallback matching
   * PUT /api/matching/offers/:id/reject
   */
  static async rejectOffer(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const { rejectionReason } = req.body;

      if (!rejectionReason || typeof rejectionReason !== 'string' || rejectionReason.trim().length === 0) {
        return sendError(res, 400, 'A detailed rejection reason is mandatory when declining an offer.');
      }

      const result = MatchingService.rejectOffer(id, req.user, rejectionReason);

      return sendSuccess(res, 200, `Offer #${id} rejected. Reserved quantity restored and fallback matching evaluated.`, {
        rejectedAllocationId: id,
        rejectionReason: rejectionReason.trim(),
        restoredQuantityKg: result.restoredQuantityKg,
        fallbackMatching: result.fallbackMatching,
      });
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.statusCode, error.message);
      }
      next(error);
    }
  }

  /**
   * Process expired offers and trigger fallback matching
   * POST /api/matching/process-expired
   */
  static async processExpiredOffers(req, res, next) {
    try {
      const timeoutMinutes = parseInt(req.body.timeoutMinutes || req.query.timeoutMinutes || 15, 10);
      const result = MatchingService.processExpiredOffers(timeoutMinutes);

      return sendSuccess(res, 200, `Processed ${result.processedCount} expired offer(s).`, {
        processedCount: result.processedCount,
        expiredOffers: result.expiredOffers,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = MatchingController;