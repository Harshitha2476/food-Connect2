const CenterModel = require('../models/Center');
const { logAudit } = require('../utils/audit');
const { sendSuccess, sendError } = require('../utils/response');
const { sanitizeCenter, sanitizeCenterList } = require('../utils/privacy');

/**
 * Distribution Center Controller
 * Manages registration, discovery, demand recording, and safe capacity updates.
 */
class CenterController {
  /**
   * Register a new distribution center
   * POST /api/centers
   */
  static async create(req, res, next) {
    try {
      const {
        name,
        address,
        lat,
        lng,
        capacityKg,
        contactPerson,
        contactPhone,
        acceptedCategories,
      } = req.body;

      // Prevent duplicate center for NGO account (unless admin)
      if (req.user.role === 'ngo') {
        const existing = CenterModel.findByUserId(req.user.id);
        if (existing) {
          return sendError(
            res,
            409,
            `A distribution center ('${existing.name}') is already registered for this NGO account.`
          );
        }
      }

      const newCenter = CenterModel.create({
        userId: req.user.id,
        name,
        address,
        lat,
        lng,
        capacityKg,
        contactPerson: contactPerson || req.user.name,
        contactPhone: contactPhone || req.user.phone,
        isVerified: 1,
      });

      // If accepted categories provided, create initial active demand
      if (acceptedCategories && Array.isArray(acceptedCategories) && acceptedCategories.length > 0) {
        CenterModel.updateDemand(newCenter.id, {
          categories: acceptedCategories,
          demandKg: 0,
          urgency: 'medium',
        });
      }

      logAudit(
        req.user.id,
        'CREATE_CENTER',
        'distribution_centers',
        newCenter.id,
        { name: newCenter.name, capacityKg: newCenter.capacityKg },
        req
      );

      const created = CenterModel.findById(newCenter.id);
      return sendSuccess(res, 201, 'Distribution center registered successfully.', {
        center: sanitizeCenter(created, req.user),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all distribution centers with active demand preferences
   * GET /api/centers
   * Public caller receives sanitized contact information
   */
  static async getAll(req, res, next) {
    try {
      const { maxTravelTime, search } = req.query;
      const centers = CenterModel.findAll({ maxTravelTime, search });
      const sanitized = sanitizeCenterList(centers, req.user);

      return sendSuccess(res, 200, `Retrieved ${sanitized.length} distribution center(s).`, {
        centers: sanitized,
        count: sanitized.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get specific center details by ID
   * GET /api/centers/:id
   */
  static async getById(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const center = CenterModel.findById(id);

      if (!center) {
        return sendError(res, 404, `Distribution center with ID ${id} not found.`);
      }

      return sendSuccess(res, 200, 'Distribution center details retrieved successfully.', {
        center: sanitizeCenter(center, req.user),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get the authenticated NGO user's own distribution center
   * GET /api/centers/my
   */
  static async getMyCenter(req, res, next) {
    try {
      const center = CenterModel.findByUserId(req.user.id);
      if (!center) {
        return sendError(res, 404, 'No distribution center found associated with this account.');
      }

      // Owner receives full unmasked profile
      return sendSuccess(res, 200, 'Center profile retrieved successfully.', {
        center: sanitizeCenter(center, req.user),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update center profile details
   * PUT /api/centers/:id
   */
  static async update(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const center = CenterModel.findById(id);

      if (!center) {
        return sendError(res, 404, `Distribution center with ID ${id} not found.`);
      }

      // Authorization: only the owning NGO user or admin
      if (req.user.role === 'ngo' && center.userId !== req.user.id) {
        return sendError(res, 403, 'Unauthorized: You can only update your own distribution center.');
      }

      const updated = CenterModel.update(id, req.body);

      logAudit(
        req.user.id,
        'UPDATE_CENTER',
        'distribution_centers',
        id,
        { updatedFields: Object.keys(req.body) },
        req
      );

      return sendSuccess(res, 200, 'Distribution center details updated successfully.', {
        center: sanitizeCenter(updated, req.user),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Record or update food demand preferences
   * PUT /api/centers/:id/demand
   */
  static async updateDemand(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const center = CenterModel.findById(id);

      if (!center) {
        return sendError(res, 404, `Distribution center with ID ${id} not found.`);
      }

      // Authorization
      if (req.user.role === 'ngo' && center.userId !== req.user.id) {
        return sendError(res, 403, 'Unauthorized: You can only update demand for your own center.');
      }

      const { categories, demandKg, urgency, dietaryNotes } = req.body;

      const updated = CenterModel.updateDemand(id, {
        categories,
        demandKg,
        urgency,
        dietaryNotes,
      });

      logAudit(
        req.user.id,
        'UPDATE_DEMAND',
        'distribution_centers',
        id,
        { categories, demandKg, urgency },
        req
      );

      return sendSuccess(res, 200, 'Food demand preferences updated successfully.', {
        center: sanitizeCenter(updated, req.user),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update center storage capacity safely with committed allocation protection
   * PUT /api/centers/:id/capacity
   * 
   * Available capacity is authoritatively calculated by the backend.
   * Total capacity cannot be reduced below committed allocations + occupied inventory.
   */
  static async updateCapacity(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const center = CenterModel.findById(id);

      if (!center) {
        return sendError(res, 404, `Distribution center with ID ${id} not found.`);
      }

      // Authorization
      if (req.user.role === 'ngo' && center.userId !== req.user.id) {
        return sendError(res, 403, 'Unauthorized: You can only adjust capacity for your own center.');
      }

      const { capacityKg, availableCapacityKg } = req.body;
      const targetTotal = capacityKg !== undefined ? parseFloat(capacityKg) : center.capacityKg;

      // 1. Prevent negative capacity
      if (targetTotal < 0 || (availableCapacityKg !== undefined && parseFloat(availableCapacityKg) < 0)) {
        return sendError(res, 400, 'Capacity figures cannot be negative.');
      }

      // 2. Query committed allocations and physical occupancy
      const metrics = CenterModel.calculateCapacityMetrics(id, targetTotal);

      // 3. Prevent reducing total capacity below active committed allocations
      if (targetTotal < metrics.committedKg) {
        return sendError(
          res,
          400,
          `Cannot reduce total capacity to ${targetTotal} kg: The center has ${metrics.committedKg} kg in active committed food allocations.`
        );
      }

      if (targetTotal < metrics.totalCommittedAndOccupied) {
        return sendError(
          res,
          400,
          `Cannot reduce total capacity to ${targetTotal} kg: The center currently has ${metrics.totalCommittedAndOccupied} kg in committed and occupied food allocations.`
        );
      }

      // 4. If client sent availableCapacityKg, verify it does not exceed total capacity
      if (availableCapacityKg !== undefined && parseFloat(availableCapacityKg) > targetTotal) {
        return sendError(
          res,
          400,
          `Available capacity (${availableCapacityKg} kg) cannot exceed total capacity (${targetTotal} kg).`
        );
      }

      // 5. Authoritatively update capacity via database transaction
      const updated = CenterModel.updateCapacity(id, targetTotal);

      logAudit(
        req.user.id,
        'UPDATE_CAPACITY',
        'distribution_centers',
        id,
        {
          capacityKg: updated.capacityKg,
          availableCapacityKg: updated.availableCapacityKg,
          committedKg: metrics.committedKg,
          occupiedKg: metrics.occupiedKg,
        },
        req
      );

      return sendSuccess(res, 200, 'Center capacity updated successfully.', {
        center: sanitizeCenter(updated, req.user),
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = CenterController;
