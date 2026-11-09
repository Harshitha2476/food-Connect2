const { getDatabase } = require('../database/connection');
const CenterModel = require('./Center');

/**
 * Surplus Food Data Access Model
 * Manages database operations for food_surplus_listings with prepared statements.
 */
class SurplusModel {
  /**
   * Create a new surplus food listing
   * @param {object} listingData
   * @returns {object} The created surplus listing
   */
  static create({
    canteenId,
    foodName,
    category,
    quantityKg,
    preparationDate,
    preparationTime,
    storageMethod,
    storageTemp = null,
    ingredients,
    allergens,
    pickupDeadline,
    location,
    notes = null,
    photoUrl = null,
  }) {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO food_surplus_listings (
        canteen_id, food_name, category, quantity_kg, available_quantity_kg,
        preparation_date, preparation_time, storage_method, storage_temp,
        ingredients, allergens, pickup_deadline, location, notes, photo_url,
        safety_status, matching_status, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'available', 'available')
    `);

    const result = stmt.run(
      canteenId,
      foodName.trim(),
      category,
      parseFloat(quantityKg),
      parseFloat(quantityKg), // Initially available == total
      preparationDate,
      preparationTime,
      storageMethod,
      storageTemp ? storageTemp.trim() : null,
      ingredients ? ingredients.trim() : null,
      allergens ? allergens.trim() : null,
      pickupDeadline,
      location.trim(),
      notes ? notes.trim() : null,
      photoUrl
    );

    return this.findById(result.lastInsertRowid);
  }

  /**
   * Retrieve surplus food listings with optional filtering
   * @param {object} filters
   * @returns {Array}
   */
  static findAll({
    canteenId,
    category,
    status,
    safetyStatus,
    search,
    limit = 50,
    offset = 0,
  } = {}) {
    const db = getDatabase();
    const conditions = [];
    const params = [];

    if (canteenId) {
      conditions.push('s.canteen_id = ?');
      params.push(canteenId);
    }

    if (category) {
      conditions.push('s.category = ?');
      params.push(category);
    }

    if (status) {
      conditions.push('s.status = ?');
      params.push(status);
    }

    if (safetyStatus) {
      conditions.push('s.safety_status = ?');
      params.push(safetyStatus);
    }

    if (search) {
      conditions.push('(s.food_name LIKE ? OR s.ingredients LIKE ? OR s.location LIKE ?)');
      const pattern = `%${search.trim()}%`;
      params.push(pattern, pattern, pattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        s.id,
        s.canteen_id as canteenId,
        c.user_id as canteenUserId,
        c.name as canteenName,
        c.location as canteenLocation,
        c.coordinator_name as coordinatorName,
        c.coordinator_phone as coordinatorPhone,
        s.food_name as foodName,
        s.category,
        s.quantity_kg as quantityKg,
        s.available_quantity_kg as availableQuantityKg,
        s.preparation_date as preparationDate,
        s.preparation_time as preparationTime,
        s.storage_method as storageMethod,
        s.storage_temp as storageTemp,
        s.ingredients,
        s.allergens,
        s.pickup_deadline as pickupDeadline,
        s.location,
        s.notes,
        s.photo_url as photoUrl,
        s.safety_status as safetyStatus,
        s.safety_verified_by as safetyVerifiedBy,
        s.safety_verified_at as safetyVerifiedAt,
        s.safety_notes as safetyNotes,
        s.matching_status as matchingStatus,
        s.status,
        m.center_id as matchedCenterId,
        dc.name as matchedCenterName,
        s.created_at as createdAt,
        s.updated_at as updatedAt
      FROM food_surplus_listings s
      JOIN canteens c ON s.canteen_id = c.id
      LEFT JOIN matching_allocations m ON s.id = m.surplus_id AND m.status IN ('offered', 'accepted')
      LEFT JOIN distribution_centers dc ON m.center_id = dc.id
      ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?
    `;

    params.push(limit, offset);
    return db.prepare(query).all(...params);
  }

  /**
   * Find single surplus listing by ID
   * @param {number} id
   * @returns {object|null}
   */
  static findById(id) {
    const db = getDatabase();
    const query = `
      SELECT 
        s.id,
        s.canteen_id as canteenId,
        c.user_id as canteenUserId,
        c.name as canteenName,
        c.location as canteenLocation,
        c.coordinator_name as coordinatorName,
        c.coordinator_phone as coordinatorPhone,
        s.food_name as foodName,
        s.category,
        s.quantity_kg as quantityKg,
        s.available_quantity_kg as availableQuantityKg,
        s.preparation_date as preparationDate,
        s.preparation_time as preparationTime,
        s.storage_method as storageMethod,
        s.storage_temp as storageTemp,
        s.ingredients,
        s.allergens,
        s.pickup_deadline as pickupDeadline,
        s.location,
        s.notes,
        s.photo_url as photoUrl,
        s.safety_status as safetyStatus,
        s.safety_verified_by as safetyVerifiedBy,
        s.safety_verified_at as safetyVerifiedAt,
        s.safety_notes as safetyNotes,
        s.matching_status as matchingStatus,
        s.status,
        m.center_id as matchedCenterId,
        dc.name as matchedCenterName,
        s.created_at as createdAt,
        s.updated_at as updatedAt
      FROM food_surplus_listings s
      JOIN canteens c ON s.canteen_id = c.id
      LEFT JOIN matching_allocations m ON s.id = m.surplus_id AND m.status IN ('offered', 'accepted')
      LEFT JOIN distribution_centers dc ON m.center_id = dc.id
      WHERE s.id = ?
    `;
    return db.prepare(query).get(id) || null;
  }

  /**
   * Update surplus food listing details
   * @param {number} id
   * @param {object} updates
   * @returns {object|null}
   */
  static update(id, updates) {
    const db = getDatabase();
    const current = this.findById(id);
    if (!current) return null;

    const stmt = db.prepare(`
      UPDATE food_surplus_listings
      SET food_name = COALESCE(?, food_name),
          category = COALESCE(?, category),
          quantity_kg = COALESCE(?, quantity_kg),
          available_quantity_kg = COALESCE(?, available_quantity_kg),
          preparation_date = COALESCE(?, preparation_date),
          preparation_time = COALESCE(?, preparation_time),
          storage_method = COALESCE(?, storage_method),
          storage_temp = COALESCE(?, storage_temp),
          ingredients = COALESCE(?, ingredients),
          allergens = COALESCE(?, allergens),
          pickup_deadline = COALESCE(?, pickup_deadline),
          location = COALESCE(?, location),
          notes = COALESCE(?, notes),
          photo_url = COALESCE(?, photo_url),
          updated_at = datetime('now')
      WHERE id = ?
    `);

    stmt.run(
      updates.foodName ? updates.foodName.trim() : null,
      updates.category || null,
      updates.quantityKg ? parseFloat(updates.quantityKg) : null,
      updates.availableQuantityKg !== undefined ? parseFloat(updates.availableQuantityKg) : null,
      updates.preparationDate || null,
      updates.preparationTime || null,
      updates.storageMethod || null,
      updates.storageTemp !== undefined ? updates.storageTemp : null,
      updates.ingredients !== undefined ? updates.ingredients : null,
      updates.allergens !== undefined ? updates.allergens : null,
      updates.pickupDeadline || null,
      updates.location ? updates.location.trim() : null,
      updates.notes !== undefined ? updates.notes : null,
      updates.photoUrl !== undefined ? updates.photoUrl : null,
      id
    );

    return this.findById(id);
  }

  /**
   * Update food safety verification status within a database transaction.
   * If rejected, safely handles outstanding offers, releases center capacity,
   * cancels pickups in progress without overwriting completed delivery records.
   * @param {number} id
   * @param {object} param1
   * @returns {object|null}
   */
  static updateSafetyStatus(id, { safetyStatus, verifiedBy, notes }) {
    const db = getDatabase();
    let updated = null;

    const tx = db.transaction(() => {
      const listing = this.findById(id);
      if (!listing) return;

      if (safetyStatus === 'rejected') {
        // 1. Cancel listing and zero available weight
        db.prepare(`
          UPDATE food_surplus_listings
          SET safety_status = 'rejected',
              safety_verified_by = ?,
              safety_verified_at = datetime('now'),
              safety_notes = ?,
              matching_status = 'cancelled',
              status = 'cancelled',
              available_quantity_kg = 0,
              updated_at = datetime('now')
          WHERE id = ?
        `).run(verifiedBy, notes, id);

        // 2. Query outstanding allocations to restore center capacity
        const activeAllocations = db.prepare(`
          SELECT id, center_id, allocated_kg, status
          FROM matching_allocations
          WHERE surplus_id = ? AND status IN ('offered', 'accepted')
        `).all(id);

        for (const alloc of activeAllocations) {
          db.prepare(`
            UPDATE matching_allocations
            SET status = 'cancelled',
                rejection_reason = 'Cancelled due to food safety rejection',
                updated_at = datetime('now')
            WHERE id = ?
          `).run(alloc.id);

          // Restore center's available capacity
          CenterModel.syncAvailableCapacity(alloc.center_id);
        }

        // 3. Cancel non-delivered pickups
        db.prepare(`
          UPDATE pickup_records
          SET status = 'cancelled',
              updated_at = datetime('now')
          WHERE surplus_id = ? AND status NOT IN ('delivered')
        `).run(id);

      } else {
        // Verified or Pending
        db.prepare(`
          UPDATE food_surplus_listings
          SET safety_status = ?,
              safety_verified_by = ?,
              safety_verified_at = datetime('now'),
              safety_notes = COALESCE(?, safety_notes),
              updated_at = datetime('now')
          WHERE id = ?
        `).run(safetyStatus, verifiedBy, notes || null, id);
      }

      updated = this.findById(id);
    });

    tx();
    return updated;
  }

  /**
   * Safe Cancellation of a surplus listing within a database transaction.
   * Cancels open allocations and releases center capacities.
   * @param {number} id
   * @returns {object|null}
   */
  static cancel(id) {
    const db = getDatabase();
    let cancelled = null;

    const cancelTx = db.transaction(() => {
      // 1. Mark listing cancelled and zero available quantity
      db.prepare(`
        UPDATE food_surplus_listings
        SET status = 'cancelled',
            matching_status = 'cancelled',
            available_quantity_kg = 0,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(id);

      // 2. Cancel open allocations and restore center available capacity
      const openAllocations = db.prepare(`
        SELECT id, center_id, allocated_kg
        FROM matching_allocations
        WHERE surplus_id = ? AND status IN ('offered', 'accepted')
      `).all(id);

      for (const alloc of openAllocations) {
        db.prepare(`
          UPDATE matching_allocations
          SET status = 'cancelled',
              rejection_reason = 'Cancelled by canteen coordinator',
              updated_at = datetime('now')
          WHERE id = ?
        `).run(alloc.id);

        CenterModel.syncAvailableCapacity(alloc.center_id);
      }

      // 3. Cancel open/assigned pickups
      db.prepare(`
        UPDATE pickup_records
        SET status = 'cancelled',
            updated_at = datetime('now')
        WHERE surplus_id = ? AND status IN ('assigned', 'pickup_pending')
      `).run(id);

      cancelled = this.findById(id);
    });

    cancelTx();
    return cancelled;
  }

  /**
   * Hard delete surplus listing (allowed only if no pickups or allocations exist)
   * @param {number} id
   */
  static delete(id) {
    const db = getDatabase();
    return db.prepare('DELETE FROM food_surplus_listings WHERE id = ?').run(id);
  }
}

module.exports = SurplusModel;
