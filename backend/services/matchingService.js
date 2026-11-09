const { getDatabase } = require('../database/connection');
const SurplusModel = require('../models/Surplus');
const CenterModel = require('../models/Center');
const CanteenModel = require('../models/Canteen');
const AllocationModel = require('../models/Allocation');
const NotificationModel = require('../models/Notification');
const RoutingService = require('./routingService');
const { logAudit } = require('../utils/audit');

const MAX_TRAVEL_TIME_MIN = 15;

/**
 * Intelligent Food Matching and Allocation Service
 * Implements a Hybrid Rule-Based Multi-Criteria Matching Algorithm with Greedy Allocation.
 */
class MatchingService {
  /**
   * Validate food surplus listing eligibility for matching
   * @param {object} surplus
   * @returns {{ eligible: boolean, reasons: string[] }}
   */
  static validateSurplusEligibility(surplus) {
    const reasons = [];

    if (!surplus) {
      return { eligible: false, reasons: ['Surplus listing not found.'] };
    }

    // 1. Food safety status
    if (surplus.safetyStatus !== 'verified') {
      if (surplus.safetyStatus === 'pending') {
        reasons.push("Food safety status is 'pending'. Food safety verification is pending.");
      } else if (surplus.safetyStatus === 'rejected') {
        reasons.push("Food safety status is 'rejected'. Safety verification was rejected.");
      } else {
        reasons.push(`Food safety status is '${surplus.safetyStatus}'. Only verified food listings can be matched.`);
      }
    }

    // 2. Quantity checks
    if (!surplus.quantityKg || surplus.quantityKg <= 0) {
      reasons.push('Total food quantity must be greater than zero.');
    }
    if (surplus.availableQuantityKg <= 0) {
      reasons.push('No available quantity remaining for allocation.');
    }

    // 3. Status checks
    if (surplus.status === 'cancelled' || surplus.matchingStatus === 'cancelled') {
      reasons.push('Listing has been cancelled.');
    }
    if (surplus.status === 'expired' || surplus.matchingStatus === 'expired') {
      reasons.push('Listing has expired.');
    }
    if (surplus.status === 'matched' && surplus.availableQuantityKg <= 0) {
      reasons.push('Listing is already fully allocated.');
    }

    // 4. Pickup deadline check
    if (surplus.pickupDeadline) {
      let deadline;
      const timeOnlyPattern = /^\d{1,2}:\d{2}$/;
      if (timeOnlyPattern.test(surplus.pickupDeadline.trim())) {
        const todayStr = new Date().toISOString().slice(0, 10);
        deadline = new Date(`${todayStr}T${surplus.pickupDeadline.trim()}:00`);
      } else {
        deadline = new Date(surplus.pickupDeadline);
      }
      if (isNaN(deadline.getTime())) {
        reasons.push('Pickup deadline format is invalid.');
      } else if (deadline < new Date()) {
        reasons.push('Pickup deadline has already passed.');
      }
    }

    // 5. Mandatory safety information check
    const tempRequiredMethods = ['Hot holding', 'Refrigerated', 'Frozen'];
    const isTempMissing = tempRequiredMethods.includes(surplus.storageMethod) && !surplus.storageTemp;
    if (
      !surplus.storageMethod ||
      !surplus.pickupDeadline ||
      !surplus.preparationTime ||
      !surplus.ingredients ||
      !surplus.allergens ||
      isTempMissing
    ) {
      reasons.push('Mandatory safety information is incomplete.');
    }

    return {
      eligible: reasons.length === 0,
      reasons,
    };
  }

  /**
   * Validate distribution center eligibility for a surplus listing
   * @param {object} center
   * @param {object} surplus
   * @param {object} route
   * @returns {{ eligible: boolean, reasons: string[] }}
   */
  static validateCenterEligibility(center, surplus, route) {
    const reasons = [];

    // 1. Center active & verified check
    if (center.isVerified === 0) {
      reasons.push('Distribution center is inactive or unverified.');
    }

    // 2. Coordinate validity
    if (!RoutingService.validateCoordinates(center.lat, center.lng)) {
      reasons.push('Distribution center has invalid geographic coordinates.');
    }

    // 3. Available storage capacity
    if (center.availableCapacityKg <= 0) {
      reasons.push('Distribution center has 0 kg available storage capacity.');
    }

    // 4. Travel-time limit (strict 15-minute threshold)
    if (route.estimatedTravelTimeMin > MAX_TRAVEL_TIME_MIN) {
      reasons.push(
        `Estimated road travel time (${route.estimatedTravelTimeMin} min) exceeds the maximum 15-minute transit window.`
      );
    }

    // 5. Category and demand compatibility
    if (center.demandCategories && center.demandCategories.length > 0) {
      const accepts =
        center.demandCategories.some(
          (c) => c.toLowerCase() === surplus.category.toLowerCase()
        ) ||
        center.demandCategories.includes('Other') ||
        surplus.category === 'Other';

      if (!accepts) {
        reasons.push(
          `Center does not accept '${surplus.category}'. Accepted categories: ${center.demandCategories.join(', ')}.`
        );
      }
    }

    return {
      eligible: reasons.length === 0,
      reasons,
    };
  }

  /**
   * Calculate Multi-Criteria Matching Score:
   * S = 0.35 * D + 0.25 * C + 0.25 * T + 0.15 * U
   * All sub-scores normalized between 0 and 100.
   *
   * @param {object} surplus
   * @param {object} center
   * @param {object} route
   * @returns {{ total: number, demand: number, capacity: number, travel: number, urgency: number }}
   */
  static calculateMatchScores(surplus, center, route) {
    // 1. Demand score (D, 35%)
    let demandScore = 0;
    if (center.demandCategories && center.demandCategories.length > 0) {
      const exactMatch = center.demandCategories.some(
        (c) => c.toLowerCase() === surplus.category.toLowerCase()
      );
      if (exactMatch) {
        demandScore = center.demandKg > 0 ? 100 : 90;
      } else if (surplus.category === 'Other' || center.demandCategories.includes('Other')) {
        demandScore = 50;
      } else {
        demandScore = 0;
      }
    } else {
      // General intake center with no restricted categories
      demandScore = 60;
    }

    // 2. Capacity score (C, 25%)
    let capacityScore = 0;
    const availCap = center.availableCapacityKg;
    const surplusQty = surplus.availableQuantityKg;

    if (availCap >= surplusQty && availCap > 0) {
      // Center comfortably accommodates entire surplus without reaching 100% full
      const utilization = surplusQty / availCap;
      capacityScore = Math.round(100 - utilization * 15);
    } else if (availCap > 0 && surplusQty > 0) {
      // Partial accommodation capacity
      capacityScore = Math.round((availCap / surplusQty) * 70);
    } else {
      capacityScore = 0;
    }

    // 3. Travel-time score (T, 25%)
    let travelScore = 0;
    const travelTime = route.estimatedTravelTimeMin;
    if (travelTime <= MAX_TRAVEL_TIME_MIN && travelTime >= 0) {
      travelScore = Math.max(0, Math.round(100 - (travelTime / MAX_TRAVEL_TIME_MIN) * 60));
    } else {
      travelScore = 0;
    }

    // 4. Urgency score (U, 15%)
    let urgencyScore = 65; // default medium
    const urgencyMap = { high: 100, medium: 65, low: 35 };
    if (center.urgency && urgencyMap[center.urgency]) {
      urgencyScore = urgencyMap[center.urgency];
    }

    // Final weighted score S
    const rawTotal =
      0.35 * demandScore +
      0.25 * capacityScore +
      0.25 * travelScore +
      0.15 * urgencyScore;

    const total = Math.min(100, Math.max(0, Math.round(rawTotal * 10) / 10));

    return {
      total,
      demand: demandScore,
      capacity: capacityScore,
      travel: travelScore,
      urgency: urgencyScore,
    };
  }

  /**
   * Rank all centers for a surplus listing and return evaluation details
   * @param {number} surplusId
   * @returns {object}
   */
  static getRankedCenters(surplusId) {
    const surplus = SurplusModel.findById(surplusId);
    if (!surplus) {
      throw new Error(`Surplus listing #${surplusId} not found.`);
    }

    const canteen = CanteenModel.findById(surplus.canteenId);
    if (!canteen) {
      throw new Error(`Canteen associated with surplus #${surplusId} not found.`);
    }

    const canteenCoords = { lat: canteen.lat, lng: canteen.lng };
    const surplusValidation = this.validateSurplusEligibility(surplus);

    const allCenters = CenterModel.findAll();
    const evaluated = allCenters.map((center) => {
      const centerCoords = {
        lat: center.lat,
        lng: center.lng,
        travelTimeMin: center.travelTimeMin,
      };

      const route = RoutingService.calculateRoadRoute(canteenCoords, centerCoords);
      const centerValidation = this.validateCenterEligibility(center, surplus, route);

      const allReasons = [...surplusValidation.reasons, ...centerValidation.reasons];
      const isEligible = allReasons.length === 0;

      const scores = this.calculateMatchScores(surplus, center, route);

      return {
        centerId: center.id,
        centerName: center.name,
        address: center.address,
        userId: center.userId,
        contactPerson: center.contactPerson,
        contactPhone: center.contactPhone,
        lat: center.lat,
        lng: center.lng,
        straightLineDistanceKm: route.straightLineDistanceKm,
        estimatedRoadDistanceKm: route.estimatedRoadDistanceKm,
        estimatedDistanceKm: route.estimatedRoadDistanceKm,
        estimatedTravelTimeMin: route.estimatedTravelTimeMin,
        routingStatus: route.routingStatus,
        isLiveRouting: route.isLiveRouting,
        routingProvider: route.routingProvider,
        availableCapacityKg: center.availableCapacityKg,
        totalCapacityKg: center.capacityKg,
        demand: {
          categories: center.demandCategories,
          demandKg: center.demandKg,
          urgency: center.urgency,
          dietaryNotes: center.dietaryNotes,
        },
        scores,
        matchScore: scores.total,
        isEligible,
        ineligibilityReasons: allReasons,
      };
    });

    // Rank: Eligible first (sorted by score DESC, travel time ASC, capacity DESC, centerId ASC)
    const eligible = evaluated
      .filter((c) => c.isEligible)
      .sort((a, b) => {
        if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
        if (a.estimatedTravelTimeMin !== b.estimatedTravelTimeMin) return a.estimatedTravelTimeMin - b.estimatedTravelTimeMin;
        if (b.availableCapacityKg !== a.availableCapacityKg) return b.availableCapacityKg - a.availableCapacityKg;
        return a.centerId - b.centerId;
      });

    const ineligible = evaluated
      .filter((c) => !c.isEligible)
      .sort((a, b) => b.matchScore - a.matchScore);

    return {
      surplus,
      canteen,
      surplusEligible: surplusValidation.eligible,
      surplusIneligibilityReasons: surplusValidation.reasons,
      eligibleCenters: eligible,
      ineligibleCenters: ineligible,
      allCenters: [...eligible, ...ineligible],
    };
  }

  /**
   * Run Greedy Allocation for a surplus listing within a strict SQLite transaction
   * @param {number} surplusId
   * @param {object} actor - User initiating matching
   * @param {object} options - { excludeCenterIds?: number[] }
   * @returns {object}
   */
  static runGreedyAllocation(surplusId, actor = null, options = {}) {
    const db = getDatabase();
    let result = null;

    const tx = db.transaction(() => {
      // 1. Fetch listing inside transaction
      const surplus = db.prepare(`
        SELECT s.*, c.lat as canteenLat, c.lng as canteenLng, c.name as canteenName, c.user_id as canteenUserId
        FROM food_surplus_listings s
        JOIN canteens c ON s.canteen_id = c.id
        WHERE s.id = ?
      `).get(surplusId);

      if (!surplus) {
        throw new Error(`Surplus food listing #${surplusId} not found.`);
      }

      // 2. Validate surplus eligibility
      const surplusObj = SurplusModel.findById(surplusId);
      const surplusValidation = this.validateSurplusEligibility(surplusObj);
      if (!surplusValidation.eligible) {
        return {
          success: false,
          status: 'ineligible_surplus',
          message: `Cannot allocate surplus listing #${surplusId}: ${surplusValidation.reasons[0]}`,
          reasons: surplusValidation.reasons,
          allocations: [],
          remainingAvailableKg: surplusObj.availableQuantityKg,
        };
      }

      let remainingQty = parseFloat(surplusObj.availableQuantityKg);
      if (remainingQty <= 0) {
        return {
          success: false,
          status: 'zero_quantity',
          message: 'Surplus listing has 0 kg available quantity remaining.',
          allocations: [],
          remainingAvailableKg: 0,
        };
      }

      // 3. Evaluate and rank centers
      const evaluation = this.getRankedCenters(surplusId);
      let candidateCenters = evaluation.eligibleCenters;

      // Filter out excluded centers (e.g., during fallback matching where a center already rejected)
      if (options.excludeCenterIds && options.excludeCenterIds.length > 0) {
        candidateCenters = candidateCenters.filter(
          (c) => !options.excludeCenterIds.includes(c.centerId)
        );
      }

      // Filter out centers that already have an active offer or accepted allocation
      const existingActiveAllocations = db.prepare(`
        SELECT center_id FROM matching_allocations
        WHERE surplus_id = ? AND status IN ('offered', 'accepted')
      `).all(surplusId).map((row) => row.center_id);

      candidateCenters = candidateCenters.filter(
        (c) => !existingActiveAllocations.includes(c.centerId)
      );

      if (candidateCenters.length === 0) {
        logAudit(
          actor?.id || null,
          'MATCHING_NO_ELIGIBLE_CENTERS',
          'food_surplus_listings',
          surplusId,
          { reasons: evaluation.surplusIneligibilityReasons, availableKg: remainingQty }
        );

        return {
          success: true,
          status: 'no_eligible_centers',
          message: 'No eligible distribution centers found matching criteria and travel-time constraints.',
          allocations: [],
          remainingAvailableKg: remainingQty,
        };
      }

      // 4. Greedy Allocation Stage
      const createdAllocations = [];

      for (const center of candidateCenters) {
        if (remainingQty <= 0) break;

        // Re-read authoritative fresh capacity inside transaction
        const metrics = CenterModel.calculateCapacityMetrics(center.centerId);
        if (!metrics || metrics.availableCapacityKg <= 0) continue;

        // Greedy amount: up to remaining quantity and up to center available capacity
        const allocQty = Math.round(Math.min(remainingQty, metrics.availableCapacityKg) * 10) / 10;
        if (allocQty <= 0) continue;

        // Insert allocation record
        const insertAllocStmt = db.prepare(`
          INSERT INTO matching_allocations (
            surplus_id, center_id, allocated_kg, match_score, demand_score,
            capacity_score, travel_score, urgency_score, travel_time_min,
            status, offered_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'offered', datetime('now'))
        `);

        const allocResult = insertAllocStmt.run(
          surplusId,
          center.centerId,
          allocQty,
          center.scores.total,
          center.scores.demand,
          center.scores.capacity,
          center.scores.travel,
          center.scores.urgency,
          center.estimatedTravelTimeMin
        );

        const allocationId = allocResult.lastInsertRowid;

        // Authoritatively synchronize center's capacity (reserves allocQty)
        CenterModel.syncAvailableCapacity(center.centerId);

        // Deduct from remaining surplus quantity
        remainingQty = Math.round((remainingQty - allocQty) * 10) / 10;

        // Create notification for the center's NGO user
        if (center.userId) {
          NotificationModel.create({
            userId: center.userId,
            recipientRole: 'ngo',
            type: 'offer',
            title: 'New Surplus Food Offer',
            message: `New offer: ${allocQty} kg of ${surplus.food_name} from ${surplus.canteenName}.`,
            data: {
              surplusId,
              allocationId,
              allocatedKg: allocQty,
              foodName: surplus.food_name,
              canteenName: surplus.canteenName,
            },
          });
        }

        createdAllocations.push({
          allocationId,
          centerId: center.centerId,
          centerName: center.centerName,
          allocatedKg: allocQty,
          matchScore: center.scores.total,
          estimatedTravelTimeMin: center.estimatedTravelTimeMin,
          status: 'offered',
        });
      }

      // 5. Update surplus listing status and available quantity
      const newStatus = remainingQty === 0 ? 'matched' : 'available';
      const newMatchingStatus = remainingQty === 0 ? 'matched' : 'available';

      db.prepare(`
        UPDATE food_surplus_listings
        SET available_quantity_kg = ?,
            status = ?,
            matching_status = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(remainingQty, newStatus, newMatchingStatus, surplusId);

      // 6. Audit logging
      logAudit(
        actor?.id || null,
        'GREEDY_ALLOCATION_COMPLETED',
        'food_surplus_listings',
        surplusId,
        {
          allocatedCount: createdAllocations.length,
          totalAllocatedKg: createdAllocations.reduce((acc, a) => acc + a.allocatedKg, 0),
          remainingAvailableKg: remainingQty,
        }
      );

      return {
        success: true,
        status: createdAllocations.length > 0 ? (remainingQty === 0 ? 'fully_allocated' : 'partially_allocated') : 'no_allocation_made',
        message: createdAllocations.length > 0
          ? `Successfully allocated food to ${createdAllocations.length} distribution center(s).`
          : 'Could not allocate food to candidate centers.',
        allocations: createdAllocations,
        remainingAvailableKg: remainingQty,
      };
    });

    result = tx();
    return result;
  }

  /**
   * Accept an allocation offer
   * @param {number} allocationId
   * @param {object} user - Authenticated user accepting offer
   * @returns {object}
   */
  static acceptOffer(allocationId, user) {
    const db = getDatabase();
    let updated = null;

    const tx = db.transaction(() => {
      const allocation = AllocationModel.findById(allocationId);
      if (!allocation) {
        throw new Error(`Allocation offer #${allocationId} not found.`);
      }

      // Role check: Only the NGO user linked to this center (or an admin) can accept
      if (user.role !== 'admin' && allocation.centerUserId !== user.id) {
        const err = new Error('Access denied: You can only accept offers directed to your distribution center.');
        err.statusCode = 403;
        throw err;
      }

      // Offer state validations
      if (allocation.status === 'accepted') {
        const err = new Error('Offer has already been accepted.');
        err.statusCode = 400;
        throw err;
      }
      if (allocation.status === 'rejected') {
        const err = new Error('Cannot accept an offer that has been rejected.');
        err.statusCode = 400;
        throw err;
      }
      if (allocation.status === 'expired') {
        const err = new Error('Cannot accept an offer that has expired.');
        err.statusCode = 400;
        throw err;
      }
      if (allocation.status === 'cancelled') {
        const err = new Error('Cannot accept an offer that has been cancelled.');
        err.statusCode = 400;
        throw err;
      }

      // Surplus validity check
      const surplus = SurplusModel.findById(allocation.surplusId);
      if (!surplus || surplus.status === 'cancelled' || surplus.safetyStatus === 'rejected') {
        const err = new Error('Cannot accept offer: Surplus listing is no longer eligible or has been cancelled.');
        err.statusCode = 400;
        throw err;
      }

      // Mark allocation as accepted
      db.prepare(`
        UPDATE matching_allocations
        SET status = 'accepted',
            responded_at = datetime('now'),
            updated_at = datetime('now')
        WHERE id = ?
      `).run(allocationId);

      // Re-verify center capacity consistency
      CenterModel.syncAvailableCapacity(allocation.centerId);

      // Notify Canteen Coordinator
      if (allocation.canteenUserId) {
        NotificationModel.create({
          userId: allocation.canteenUserId,
          recipientRole: 'canteen',
          type: 'match',
          title: 'Offer Accepted by Distribution Center',
          message: `${allocation.centerName} has accepted the offer of ${allocation.allocatedKg} kg of ${allocation.foodName}.`,
          data: { allocationId, surplusId: allocation.surplusId, centerId: allocation.centerId },
        });
      }

      logAudit(
        user.id,
        'OFFER_ACCEPTED',
        'matching_allocations',
        allocationId,
        { centerId: allocation.centerId, surplusId: allocation.surplusId, allocatedKg: allocation.allocatedKg }
      );

      updated = AllocationModel.findById(allocationId);
    });

    tx();
    return updated;
  }

  /**
   * Reject an allocation offer and immediately attempt fallback matching
   * @param {number} allocationId
   * @param {object} user - Authenticated user rejecting offer
   * @param {string} rejectionReason
   * @returns {object}
   */
  static rejectOffer(allocationId, user, rejectionReason) {
    if (!rejectionReason || rejectionReason.trim().length === 0) {
      const err = new Error('A detailed rejection reason is mandatory when declining an offer.');
      err.statusCode = 400;
      throw err;
    }

    const db = getDatabase();
    let result = null;

    const tx = db.transaction(() => {
      const allocation = AllocationModel.findById(allocationId);
      if (!allocation) {
        throw new Error(`Allocation offer #${allocationId} not found.`);
      }

      // Role check: Only the NGO user linked to this center (or admin) can reject
      if (user.role !== 'admin' && allocation.centerUserId !== user.id) {
        const err = new Error('Access denied: You can only reject offers directed to your distribution center.');
        err.statusCode = 403;
        throw err;
      }

      // Status check
      if (allocation.status === 'rejected') {
        const err = new Error('Offer has already been rejected.');
        err.statusCode = 400;
        throw err;
      }
      if (allocation.status === 'accepted') {
        const err = new Error('Cannot reject an offer that has already been accepted.');
        err.statusCode = 400;
        throw err;
      }
      if (allocation.status === 'cancelled') {
        const err = new Error('Cannot reject an offer that has been cancelled.');
        err.statusCode = 400;
        throw err;
      }
      if (allocation.status === 'expired') {
        const err = new Error('Cannot reject an offer that has expired.');
        err.statusCode = 400;
        throw err;
      }

      // 1. Mark allocation as rejected
      db.prepare(`
        UPDATE matching_allocations
        SET status = 'rejected',
            rejection_reason = ?,
            responded_at = datetime('now'),
            updated_at = datetime('now')
        WHERE id = ?
      `).run(rejectionReason.trim(), allocationId);

      // 2. Release reserved capacity on the distribution center
      CenterModel.syncAvailableCapacity(allocation.centerId);

      // 3. Restore surplus available quantity
      const surplus = SurplusModel.findById(allocation.surplusId);
      const restoredQty = Math.round((surplus.availableQuantityKg + allocation.allocatedKg) * 10) / 10;
      const cappedQty = Math.min(restoredQty, surplus.quantityKg);

      db.prepare(`
        UPDATE food_surplus_listings
        SET available_quantity_kg = ?,
            status = 'available',
            matching_status = 'available',
            updated_at = datetime('now')
        WHERE id = ?
      `).run(cappedQty, allocation.surplusId);

      logAudit(
        user.id,
        'OFFER_REJECTED',
        'matching_allocations',
        allocationId,
        {
          centerId: allocation.centerId,
          surplusId: allocation.surplusId,
          allocatedKg: allocation.allocatedKg,
          reason: rejectionReason.trim(),
        }
      );

      // 4. Trigger Immediate Fallback Matching if surplus is still eligible
      let fallbackResult = null;
      const freshSurplus = SurplusModel.findById(allocation.surplusId);
      const surplusValidation = this.validateSurplusEligibility(freshSurplus);

      if (surplusValidation.eligible && freshSurplus.availableQuantityKg > 0) {
        // Query all center IDs that have already rejected or have active allocations
        const excludedCenters = db.prepare(`
          SELECT center_id FROM matching_allocations
          WHERE surplus_id = ? AND status IN ('offered', 'accepted', 'rejected')
        `).all(allocation.surplusId).map((row) => row.center_id);

        fallbackResult = this.runGreedyAllocation(allocation.surplusId, user, {
          excludeCenterIds: excludedCenters,
        });

        logAudit(
          user.id,
          'FALLBACK_MATCHING_INITIATED',
          'food_surplus_listings',
          allocation.surplusId,
          {
            originalAllocationId: allocationId,
            fallbackStatus: fallbackResult.status,
            allocatedCount: fallbackResult.allocations.length,
          }
        );
      }

      result = {
        rejectedAllocation: AllocationModel.findById(allocationId),
        restoredQuantityKg: allocation.allocatedKg,
        fallbackMatching: fallbackResult,
      };
    });

    tx();
    return result;
  }

  /**
   * Process expired offers: identify unresponded offers exceeding timeout,
   * expire them, release reserved capacity, and trigger fallback matching.
   * @param {number} timeoutMinutes
   * @returns {object}
   */
  static processExpiredOffers(timeoutMinutes = 15) {
    const db = getDatabase();
    const expiredList = [];

    const tx = db.transaction(() => {
      // Find all offers offered > timeoutMinutes ago
      const expiredOffers = db.prepare(`
        SELECT id, surplus_id, center_id, allocated_kg, offered_at
        FROM matching_allocations
        WHERE status = 'offered'
          AND datetime(offered_at, '+' || ? || ' minutes') <= datetime('now')
      `).all(timeoutMinutes);

      for (const offer of expiredOffers) {
        // 1. Mark expired
        db.prepare(`
          UPDATE matching_allocations
          SET status = 'expired',
              rejection_reason = 'Offer expired without response after timeout',
              responded_at = datetime('now'),
              updated_at = datetime('now')
          WHERE id = ?
        `).run(offer.id);

        // 2. Release center capacity
        CenterModel.syncAvailableCapacity(offer.center_id);

        // 3. Restore surplus available quantity
        const surplus = SurplusModel.findById(offer.surplus_id);
        if (surplus) {
          const restoredQty = Math.round((surplus.availableQuantityKg + offer.allocated_kg) * 10) / 10;
          const cappedQty = Math.min(restoredQty, surplus.quantityKg);

          db.prepare(`
            UPDATE food_surplus_listings
            SET available_quantity_kg = ?,
                status = 'available',
                matching_status = 'available',
                updated_at = datetime('now')
            WHERE id = ?
          `).run(cappedQty, offer.surplus_id);
        }

        logAudit(
          null,
          'OFFER_EXPIRED',
          'matching_allocations',
          offer.id,
          { centerId: offer.center_id, surplusId: offer.surplus_id, allocatedKg: offer.allocated_kg }
        );

        // 4. Attempt fallback matching
        let fallbackResult = null;
        const freshSurplus = SurplusModel.findById(offer.surplus_id);
        if (freshSurplus) {
          const surplusVal = this.validateSurplusEligibility(freshSurplus);
          if (surplusVal.eligible && freshSurplus.availableQuantityKg > 0) {
            const excluded = db.prepare(`
              SELECT center_id FROM matching_allocations
              WHERE surplus_id = ? AND status IN ('offered', 'accepted', 'rejected', 'expired')
            `).all(offer.surplus_id).map((r) => r.center_id);

            fallbackResult = this.runGreedyAllocation(offer.surplus_id, null, {
              excludeCenterIds: excluded,
            });
          }
        }

        expiredList.push({
          allocationId: offer.id,
          centerId: offer.center_id,
          surplusId: offer.surplus_id,
          allocatedKg: offer.allocated_kg,
          fallbackMatching: fallbackResult,
        });
      }
    });

    tx();
    return {
      processedCount: expiredList.length,
      expiredOffers: expiredList,
    };
  }
}

module.exports = MatchingService;

