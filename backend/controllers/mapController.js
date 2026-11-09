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

        // 1. Food safety verification pre-condition
        if (surplus.safetyStatus !== 'verified') {
          ineligibilityReasons.push(
            `Food safety status is '${surplus.safetyStatus}'. Only verified food listings can be matched or scheduled for pickup.`
          );
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
          estimatedDistanceKm: route.estimatedDistanceKm,
          estimatedTravelTimeMin: route.estimatedTravelTimeMin,
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
          routeGeometry: route.routeGeometry,
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
          provider: 'simulated_osrm_road_network',
          isLiveRouting: false,
          maxTravelTimeEligibilityMin: MAX_TRAVEL_TIME_MIN,
          note: 'Calculated using calibrated road network model. Travel times reflect estimated transit and traffic limits.',
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

