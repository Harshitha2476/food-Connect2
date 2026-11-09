const http = require('http');
const https = require('https');
const config = require('../config');

/**
 * Routing Service
 * Provides road distance, road travel time, and route path calculations
 * between canteens and distribution centers.
 * 
 * AUDIT & ARCHITECTURE PRINCIPLES:
 * 1. Straight-line (great-circle) distance is strictly separated from estimated road distance.
 * 2. Simulated routing is clearly identified; simulated interpolated paths are NEVER described as actual street road routes.
 * 3. The 15-minute road-travel eligibility is explicitly labeled as a simulated estimate when live routing is unavailable.
 * 4. Extensible modular architecture with a pluggable OSRM live routing provider interface.
 */

class RoutingService {
  /**
   * Validate geographic coordinate bounds
   * @param {number} lat - Latitude (-90 to 90)
   * @param {number} lng - Longitude (-180 to 180)
   * @returns {boolean}
   */
  static validateCoordinates(lat, lng) {
    if (lat === null || lat === undefined || lng === null || lng === undefined) {
      return false;
    }
    const numLat = parseFloat(lat);
    const numLng = parseFloat(lng);
    if (isNaN(numLat) || isNaN(numLng)) {
      return false;
    }
    return numLat >= -90 && numLat <= 90 && numLng >= -180 && numLng <= 180;
  }

  /**
   * Calculate great-circle (Haversine) straight-line distance in kilometers
   * @param {number} lat1 
   * @param {number} lon1 
   * @param {number} lat2 
   * @param {number} lon2 
   * @returns {number} Distance in km
   */
  static haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100; // rounded to 2 decimals
  }

  /**
   * Live OSRM integration interface
   * Attempts to contact an OSRM routing server if OSRM_BASE_URL is configured in environment.
   * @param {object} origin - { lat, lng }
   * @param {object} destination - { lat, lng }
   * @returns {Promise<object|null>}
   */
  static async queryLiveOsrm(origin, destination) {
    const baseUrl = config.osrm?.baseUrl;
    if (!baseUrl) {
      return null; // OSRM not configured
    }

    return new Promise((resolve) => {
      try {
        const urlStr = `${baseUrl}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;
        const client = urlStr.startsWith('https') ? https : http;

        const req = client.get(urlStr, { timeout: config.osrm.timeoutMs || 2500 }, (res) => {
          if (res.statusCode !== 200) {
            return resolve(null);
          }
          let rawData = '';
          res.on('data', (chunk) => (rawData += chunk));
          res.on('end', () => {
            try {
              const parsed = JSON.parse(rawData);
              if (parsed.code === 'Ok' && parsed.routes && parsed.routes.length > 0) {
                const route = parsed.routes[0];
                return resolve({
                  roadDistanceKm: Math.round((route.distance / 1000) * 10) / 10,
                  travelTimeMin: Math.max(1, Math.round(route.duration / 60)),
                  liveGeometry: route.geometry?.coordinates?.map(([lng, lat]) => [lat, lng]),
                });
              }
              return resolve(null);
            } catch {
              return resolve(null);
            }
          });
        });

        req.on('error', () => resolve(null));
        req.on('timeout', () => {
          req.destroy();
          resolve(null);
        });
      } catch {
        resolve(null);
      }
    });
  }

  /**
   * Calculate road route between origin (canteen) and destination (distribution center).
   * 
   * Explicitly distinguishes:
   * - straightLineDistanceKm: exact physical Euclidean/Haversine distance
   * - estimatedRoadDistanceKm: calculated road distance (or simulated road detour model)
   * - estimatedTravelTimeMin: road travel time
   * - isLiveRouting: true if verified against live OSRM engine, false if simulated
   * - simulatedNotice: explicit warning when simulated road network is used
   * 
   * @param {object} origin - { lat, lng }
   * @param {object} destination - { lat, lng, travelTimeMin }
   * @returns {object}
   */
  static calculateRoadRoute(origin, destination) {
    if (
      !this.validateCoordinates(origin?.lat, origin?.lng) ||
      !this.validateCoordinates(destination?.lat, destination?.lng)
    ) {
      return {
        success: false,
        routingStatus: 'ROUTING_UNAVAILABLE',
        error: 'Invalid coordinates. Latitude must be between -90 and 90; longitude must be between -180 and 180.',
      };
    }

    const oLat = parseFloat(origin.lat);
    const oLng = parseFloat(origin.lng);
    const dLat = parseFloat(destination.lat);
    const dLng = parseFloat(destination.lng);

    // 1. Exact straight-line physical distance
    const straightLineDistanceKm = this.haversineDistance(oLat, oLng, dLat, dLng);

    // 2. Simulated urban road winding factor (1.38x) calibrated to campus layout
    const simulatedRoadDistanceKm = Math.max(0.3, Math.round(straightLineDistanceKm * 1.38 * 10) / 10);

    // 3. Travel time computation (calibrated campus matrix or urban speed model ~22 km/h)
    let estimatedTravelTimeMin = 0;
    if (destination.travelTimeMin !== undefined && destination.travelTimeMin !== null && destination.travelTimeMin > 0) {
      estimatedTravelTimeMin = parseInt(destination.travelTimeMin, 10);
    } else {
      estimatedTravelTimeMin = Math.max(3, Math.round((simulatedRoadDistanceKm / 22) * 60));
    }

    // 4. Simulated interpolation path for map visualization (clearly labeled, NOT an actual street turn-by-turn road)
    const midLat = (oLat + dLat) / 2 + 0.0008;
    const midLng = (oLng + dLng) / 2 - 0.0006;
    const simulatedPath = [
      [oLat, oLng],
      [Math.round(midLat * 10000) / 10000, Math.round(midLng * 10000) / 10000],
      [dLat, dLng],
    ];

    return {
      success: true,
      straightLineDistanceKm,
      estimatedRoadDistanceKm: simulatedRoadDistanceKm,
      estimatedTravelTimeMin,
      units: {
        distance: 'kilometers (km)',
        travelTime: 'minutes (min)',
      },
      routingStatus: 'SIMULATED_ROAD_NETWORK',
      isLiveRouting: false,
      verifiedAgainstLiveGps: false,
      routingProvider: 'simulated_campus_road_network',
      routeGeometry: simulatedPath,
      geometryType: 'simulated_interpolated_path',
      simulatedNotice:
        'Road distance and travel time are estimated via a calibrated campus road network model. The 15-minute eligibility threshold is an estimate and has not been verified by a live GPS routing service.',
    };
  }
}

module.exports = RoutingService;
