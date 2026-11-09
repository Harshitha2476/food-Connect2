const SurplusModel = require('../models/Surplus');
const CanteenModel = require('../models/Canteen');
const { logAudit } = require('../utils/audit');
const { sendSuccess, sendError } = require('../utils/response');
const { cleanupFile } = require('../middleware/upload');
const { sanitizeSurplus, sanitizeSurplusList } = require('../utils/privacy');

/**
 * Surplus Food Controller
 * Handles creation, retrieval, updating, safe cancellation, and food safety verification.
 */
class SurplusController {
  /**
   * Create a new surplus food listing
   * POST /api/surplus
   */
  static async create(req, res, next) {
    try {
      let canteenId = null;

      // 1. Role-based Canteen ID Resolution
      if (req.user.role === 'canteen') {
        const canteen = CanteenModel.findByUserId(req.user.id);
        if (!canteen) {
          const newCanteen = CanteenModel.create({
            userId: req.user.id,
            name: req.user.organization || 'Campus Canteen',
            location: req.body.location || 'Campus Dining Block',
            coordinatorName: req.user.name,
            coordinatorPhone: req.user.phone,
          });
          canteenId = newCanteen.id;
        } else {
          canteenId = canteen.id;
        }
      } else if (req.user.role === 'admin') {
        if (req.body.canteenId) {
          const specifiedCanteen = CanteenModel.findById(req.body.canteenId);
          if (!specifiedCanteen) {
            if (req.file) cleanupFile(req.file.path);
            return sendError(res, 404, `Canteen with ID ${req.body.canteenId} not found.`);
          }
          canteenId = specifiedCanteen.id;
        } else {
          const allCanteens = CanteenModel.findAll();
          canteenId = allCanteens[0]?.id || 1;
        }
      } else {
        if (req.file) cleanupFile(req.file.path);
        return sendError(res, 403, 'Unauthorized: Only canteen coordinators or administrators can create surplus listings.');
      }

      // 2. Handle optional image upload
      const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;

      // 3. Create listing in database
      const newSurplus = SurplusModel.create({
        canteenId,
        foodName: req.body.foodName,
        category: req.body.category,
        quantityKg: req.body.quantityKg,
        preparationDate: req.body.preparationDate,
        preparationTime: req.body.preparationTime,
        storageMethod: req.body.storageMethod,
        storageTemp: req.body.storageTemp,
        ingredients: req.body.ingredients,
        allergens: req.body.allergens,
        pickupDeadline: req.body.pickupDeadline,
        location: req.body.location,
        notes: req.body.notes,
        photoUrl,
      });

      // 4. Audit logging
      logAudit(
        req.user.id,
        'CREATE_SURPLUS',
        'food_surplus_listings',
        newSurplus.id,
        { foodName: newSurplus.foodName, quantityKg: newSurplus.quantityKg, category: newSurplus.category },
        req
      );

      return sendSuccess(res, 201, 'Surplus food listing created. Safety verification is pending.', {
        surplus: sanitizeSurplus(newSurplus, req.user),
      });
    } catch (error) {
      if (req.file) cleanupFile(req.file.path);
      next(error);
    }
  }

  /**
   * Get all surplus food listings with filtering and pagination
   * GET /api/surplus
   */
  static async getAll(req, res, next) {
    try {
      const { category, status, canteenId, safetyStatus, search, limit, offset, myOnly } = req.query;

      let filterCanteenId = canteenId ? parseInt(canteenId, 10) : undefined;

      if (myOnly === 'true' && req.user && req.user.role === 'canteen') {
        const canteen = CanteenModel.findByUserId(req.user.id);
        filterCanteenId = canteen ? canteen.id : -1;
      }

      const listings = SurplusModel.findAll({
        category,
        status,
        canteenId: filterCanteenId,
        safetyStatus,
        search,
        limit: limit ? parseInt(limit, 10) : 50,
        offset: offset ? parseInt(offset, 10) : 0,
      });

      const sanitized = sanitizeSurplusList(listings, req.user);

      return sendSuccess(res, 200, `Retrieved ${sanitized.length} surplus listing(s).`, {
        surplus: sanitized,
        count: sanitized.length,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get specific surplus listing by ID
   * GET /api/surplus/:id
   */
  static async getById(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const listing = SurplusModel.findById(id);

      if (!listing) {
        return sendError(res, 404, `Surplus listing with ID ${id} not found.`);
      }

      return sendSuccess(res, 200, 'Listing details retrieved successfully.', {
        surplus: sanitizeSurplus(listing, req.user),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update surplus listing details
   * PUT /api/surplus/:id
   */
  static async update(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const listing = SurplusModel.findById(id);

      if (!listing) {
        if (req.file) cleanupFile(req.file.path);
        return sendError(res, 404, `Surplus listing with ID ${id} not found.`);
      }

      // Authorization: Only the owning canteen or admin can update
      if (req.user.role === 'canteen' && listing.canteenUserId !== req.user.id) {
        if (req.file) cleanupFile(req.file.path);
        return sendError(res, 403, 'Unauthorized: You can only update listings belonging to your canteen.');
      }

      // Status check: Cannot edit listing if already in transit, delivered, or cancelled
      if (['in_transit', 'delivered', 'cancelled'].includes(listing.status)) {
        if (req.file) cleanupFile(req.file.path);
        return sendError(
          res,
          400,
          `Cannot update listing because its current status is '${listing.status}'.`
        );
      }

      // If already matched/accepted by a center, prevent changing quantity or category
      if (listing.matchingStatus === 'matched' || listing.status === 'matched') {
        if (req.body.quantityKg && parseFloat(req.body.quantityKg) !== listing.quantityKg) {
          if (req.file) cleanupFile(req.file.path);
          return sendError(
            res,
            400,
            'Cannot modify food quantity because this listing has already been matched and committed to a distribution center.'
          );
        }
      }

      const photoUrl = req.file ? `/uploads/${req.file.filename}` : undefined;

      const updates = {
        foodName: req.body.foodName,
        category: req.body.category,
        quantityKg: req.body.quantityKg,
        preparationDate: req.body.preparationDate,
        preparationTime: req.body.preparationTime,
        storageMethod: req.body.storageMethod,
        storageTemp: req.body.storageTemp,
        ingredients: req.body.ingredients,
        allergens: req.body.allergens,
        pickupDeadline: req.body.pickupDeadline,
        location: req.body.location,
        notes: req.body.notes,
        photoUrl,
      };

      if (req.body.quantityKg && listing.status === 'available') {
        updates.availableQuantityKg = req.body.quantityKg;
      }

      const updated = SurplusModel.update(id, updates);

      logAudit(
        req.user.id,
        'UPDATE_SURPLUS',
        'food_surplus_listings',
        id,
        { updatedFields: Object.keys(updates).filter((k) => updates[k] !== undefined) },
        req
      );

      return sendSuccess(res, 200, 'Surplus listing updated successfully.', {
        surplus: sanitizeSurplus(updated, req.user),
      });
    } catch (error) {
      if (req.file) cleanupFile(req.file.path);
      next(error);
    }
  }

  /**
   * Safe Cancellation of a surplus listing
   * DELETE /api/surplus/:id
   */
  static async cancel(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const listing = SurplusModel.findById(id);

      if (!listing) {
        return sendError(res, 404, `Surplus listing with ID ${id} not found.`);
      }

      // Authorization: owning canteen or admin
      if (req.user.role === 'canteen' && listing.canteenUserId !== req.user.id) {
        return sendError(res, 403, 'Unauthorized: You can only cancel listings belonging to your canteen.');
      }

      // Check if cancellation is unsafe
      if (listing.status === 'in_transit') {
        return sendError(
          res,
          400,
          'Cannot cancel listing: A volunteer is already in transit collecting this food.'
        );
      }
      if (listing.status === 'delivered') {
        return sendError(res, 400, 'Cannot cancel listing: Food has already been delivered.');
      }
      if (listing.status === 'cancelled') {
        return sendError(res, 400, 'Listing is already cancelled.');
      }

      const cancelled = SurplusModel.cancel(id);

      logAudit(
        req.user.id,
        'CANCEL_SURPLUS',
        'food_surplus_listings',
        id,
        { previousStatus: listing.status, availableQuantityKg: 0 },
        req
      );

      return sendSuccess(res, 200, 'Surplus listing has been safely cancelled and open offers released.', {
        surplus: sanitizeSurplus(cancelled, req.user),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Food Safety Officer verification decision
   * PUT /api/surplus/:id/safety
   */
  static async updateSafety(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const listing = SurplusModel.findById(id);

      if (!listing) {
        return sendError(res, 404, `Surplus listing with ID ${id} not found.`);
      }

      // Authorization: safety_officer or admin
      if (!['safety_officer', 'admin'].includes(req.user.role)) {
        return sendError(res, 403, 'Access denied: Only Food Safety Officers or Administrators can verify food safety.');
      }

      const { safetyStatus, notes } = req.body;

      // Safety rule enforcement: verify mandatory safety data exists before approving
      if (safetyStatus === 'verified') {
        const tempRequiredMethods = ['Hot holding', 'Refrigerated', 'Frozen'];
        const isTempMissing = tempRequiredMethods.includes(listing.storageMethod) && !listing.storageTemp;

        if (
          !listing.storageMethod ||
          !listing.pickupDeadline ||
          !listing.preparationTime ||
          !listing.ingredients ||
          !listing.allergens ||
          isTempMissing
        ) {
          return sendError(
            res,
            400,
            'Cannot approve food safety verification: Mandatory safety information is incomplete (requires storage method, storage temperature, ingredients, and allergen statement).'
          );
        }
      }

      // If rejected, notes are mandatory
      if (safetyStatus === 'rejected' && (!notes || notes.trim() === '')) {
        return sendError(res, 400, 'A detailed reason is mandatory when rejecting food safety eligibility.');
      }

      const updated = SurplusModel.updateSafetyStatus(id, {
        safetyStatus,
        verifiedBy: req.user.id,
        notes: notes || `Safety verification status updated to ${safetyStatus}`,
      });

      logAudit(
        req.user.id,
        'VERIFY_FOOD_SAFETY',
        'food_surplus_listings',
        id,
        { decision: safetyStatus, notes, verifiedBy: req.user.name },
        req
      );

      return sendSuccess(res, 200, `Food safety status updated to '${safetyStatus}'.`, {
        surplus: sanitizeSurplus(updated, req.user),
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = SurplusController;
