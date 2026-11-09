const SurplusModel = require('../models/Surplus');
const CanteenModel = require('../models/Canteen');
const CenterModel = require('../models/Center');
const RoutingService = require('../services/routingService');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Map & Nearby Centers Controller
 * Identifies nearby distribution centers relative to a surplus food listing's canteen,
 * estimates road travel times via RoutingService, and computes eligibility for interactive Leaflet maps.
 */
class MapController {
  /**
   * Get nearby distribution centers for a surplus food listing
   * GET /api/matching/nearby/:surplusId
   */
  static async getNearbyCentersForSurplus(req, res, next) {
    try {
      const surplusId = parseInt(req.params.surplusId, 10);
      const surplus = SurplusModel.findById(surplusId);

      if (!surplus) {
        return sendError(res, 404, `Surplus food listing #${surplusId} not found.`);
      }

      // Lookup canteen coordinates
      const canteen = CanteenModel.findById(surplus.canteenId);
      if (!canteen) {
        return sendError(res, 404, `Canteen associated with surplus listing #${surplusId} not found.`);
      }

      const canteenCoords = { lat: canteen.lat, lng: canteen.lng };
      if (!RoutingService.validateCoordinates(canteenCoords.lat, canteenCoords.lng)) {
        return sendError(res, 400, 'Canteen coordinate values are invalid or out of range (-90..90, -180..180).');
      }

      // Retrieve all distribution centers with active demands
      const allCenters = CenterModel.findAll();
      const MAX_TRAVEL_TIME_MIN = 15;

      const evaluatedCenters = allCenters.map((center) => {
        const centerCoords = {
          lat: center.lat,
          lng: center.lng,
          travelTimeMin: center.travelTimeMin,
        };

        const route = RoutingService.calculateRoadRoute(canteenCoords, centerCoords);
        const ineligibilityReasons = [];

        // 1. Food safety verification pre-condition with detailed reasons
        if (surplus.safetyStatus !== 'verified') {
          if (surplus.safetyStatus === 'pending') {
            // Keep "Food safety status is" prefix so existing test assertions continue to pass
            ineligibilityReasons.push("Food safety status is 'pending'. Safety verification is pending. Listing cannot be matched.");
          } else if (surplus.safetyStatus === 'rejected') {
            ineligibilityReasons.push("Food safety status is 'rejected'. Safety verification was rejected. Listing cannot be matched.");
          } else {
            ineligibilityReasons.push(`Food safety status is '${surplus.safetyStatus}'. Only verified food listings can be matched or scheduled for pickup.`);
          }
        }
        // 2. Available quantity must be > 0
        if (surplus.availableQuantityKg <= 0) {
          ineligibilityReasons.push('No available quantity remaining for allocation.');
        }
        // 3. Fully allocated check (status matched and no quantity left)
        if (surplus.status === 'matched' && surplus.availableQuantityKg <= 0) {
          ineligibilityReasons.push('Listing is fully allocated and cannot accept new offers.');
        }
        // 4. Cancelled listing check
        if (surplus.status === 'cancelled') {
          ineligibilityReasons.push('Listing has been cancelled by the coordinator.');
        }
        // 5. Expired listing check
        if (surplus.status === 'expired') {
          ineligibilityReasons.push('Listing has expired and is no longer eligible for allocation.');
        }
        // 6. Pickup deadline passed check
        // The pickup_deadline column stores either a full ISO datetime ("YYYY-MM-DDTHH:MM"),
        // a date+time string ("YYYY-MM-DD HH:MM"), or a time-only string ("HH:MM").
        // Time-only values represent today's date and must be parsed accordingly.
        if (surplus.pickupDeadline) {
          let deadline;
          const timeOnlyPattern = /^\d{1,2}:\d{2}$/; // e.g. "14:30"
          if (timeOnlyPattern.test(surplus.pickupDeadline.trim())) {
            // Treat as a time on today's date in the local environment
            const todayStr = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
            deadline = new Date(`${todayStr}T${surplus.pickupDeadline.trim()}:00`);
          } else {
            deadline = new Date(surplus.pickupDeadline);
          }
          if (isNaN(deadline.getTime())) {
            ineligibilityReasons.push('Pickup deadline format is invalid.');
          } else if (deadline < new Date()) {
            ineligibilityReasons.push('Pickup deadline has already passed.');
          }
        }

        // 2. Road travel time threshold (strict 15-minute window)
        if (route.estimatedTravelTimeMin > MAX_TRAVEL_TIME_MIN) {
          ineligibilityReasons.push(
            `Estimated road travel time (${route.estimatedTravelTimeMin} min) exceeds the maximum 15-minute transit window.`
          );
        }

        // 3. Storage capacity check
        if (center.availableCapacityKg <= 0) {
          ineligibilityReasons.push('Distribution center currently has 0 kg available storage capacity.');
        }

        // 4. Food category demand compatibility
        if (center.demandCategories && center.demandCategories.length > 0) {
          const acceptsCategory =
            center.demandCategories.some(
              (c) => c.toLowerCase() === surplus.category.toLowerCase()
            ) ||
            center.demandCategories.includes('Other') ||
            surplus.category === 'Other';

          if (!acceptsCategory) {
            ineligibilityReasons.push(
              `Center does not accept '${surplus.category}'. Accepted categories: ${center.demandCategories.join(', ')}.`
            );
          }
        }

        const isEligible = ineligibilityReasons.length === 0;

        return {
          centerId: center.id,
          centerName: center.name,
          address: center.address,
          lat: center.lat,
          lng: center.lng,
          // --- Distance and routing fields ---
          // straightLineDistanceKm: exact Haversine (great-circle) straight-line distance
          straightLineDistanceKm: route.straightLineDistanceKm,
          // estimatedRoadDistanceKm: simulated road distance (1.38× factor); NOT a live road measurement
          estimatedRoadDistanceKm: route.estimatedRoadDistanceKm,
          // estimatedDistanceKm: alias for estimatedRoadDistanceKm, retained for backward compatibility
          estimatedDistanceKm: route.estimatedRoadDistanceKm,
          estimatedTravelTimeMin: route.estimatedTravelTimeMin,
          // Routing metadata – clearly identifies whether routing is simulated or live
          routingStatus: route.routingStatus,
          isLiveRouting: route.isLiveRouting,
          routingProvider: route.routingProvider,
          // routeGeometry: simulated interpolated path; NOT a real turn-by-turn street route
          routeGeometry: route.routeGeometry,
          // --- Capacity and demand ---
          availableCapacityKg: center.availableCapacityKg,
          totalCapacityKg: center.capacityKg,
          demand: {
            categories: center.demandCategories,
            demandKg: center.demandKg,
            urgency: center.urgency,
            dietaryNotes: center.dietaryNotes,
          },
          isEligible,
          ineligibilityReasons,
        };
      });

      // Sort: eligible first (sorted by travel time ascending), then ineligible
      const eligible = evaluatedCenters.filter((c) => c.isEligible).sort((a, b) => a.estimatedTravelTimeMin - b.estimatedTravelTimeMin);
      const ineligible = evaluatedCenters.filter((c) => !c.isEligible).sort((a, b) => a.estimatedTravelTimeMin - b.estimatedTravelTimeMin);
      const sortedCenters = [...eligible, ...ineligible];

      return sendSuccess(res, 200, `Evaluated ${sortedCenters.length} nearby distribution center(s).`, {
        surplus: {
          id: surplus.id,
          foodName: surplus.foodName,
          category: surplus.category,
          quantityKg: surplus.quantityKg,
          availableQuantityKg: surplus.availableQuantityKg,
          safetyStatus: surplus.safetyStatus,
          status: surplus.status,
          pickupDeadline: surplus.pickupDeadline,
        },
        canteen: {
          id: canteen.id,
          name: canteen.name,
          location: canteen.location,
          lat: canteen.lat,
          lng: canteen.lng,
        },
        routingMetadata: {
          // provider is kept as 'simulated_osrm_road_network' for API stability.
          // This is NOT live OSRM routing. All values are simulated estimates.
          provider: 'simulated_osrm_road_network',
          isLiveRouting: false,
          maxTravelTimeEligibilityMin: MAX_TRAVEL_TIME_MIN,
          note: 'All distances and travel times are estimates from a calibrated campus road network model. ' +
                'Simulated values have NOT been verified against live GPS or road routing. ' +
                'The 15-minute transit eligibility threshold is an estimate, not a confirmed real-world travel time.',
        },
        centers: sortedCenters,
        summary: {
          totalCenters: sortedCenters.length,
          eligibleCenters: eligible.length,
          ineligibleCenters: ineligible.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = MapController;

