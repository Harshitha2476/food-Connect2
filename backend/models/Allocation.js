const { getDatabase } = require('../database/connection');

/**
 * Matching Allocation Data Access Model
 * Manages database operations for matching_allocations with prepared statements.
 */
class AllocationModel {
  /**
   * Create a new matching allocation record
   * @param {object} allocationData
   * @returns {object}
   */
  static create({
    surplusId,
    centerId,
    allocatedKg,
    matchScore,
    demandScore,
    capacityScore,
    travelScore,
    urgencyScore,
    travelTimeMin,
    status = 'offered',
  }) {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO matching_allocations (
        surplus_id, center_id, allocated_kg, match_score, demand_score,
        capacity_score, travel_score, urgency_score, travel_time_min, status, offered_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    const result = stmt.run(
      surplusId,
      centerId,
      parseFloat(allocatedKg),
      parseFloat(matchScore),
      parseFloat(demandScore),
      parseFloat(capacityScore),
      parseFloat(travelScore),
      parseFloat(urgencyScore),
      parseInt(travelTimeMin, 10),
      status
    );

    return this.findById(result.lastInsertRowid);
  }

  /**
   * Find an allocation by ID with joined surplus, canteen, and center details
   * @param {number} id
   * @returns {object|null}
   */
  static findById(id) {
    const db = getDatabase();
    const query = `
      SELECT 
        m.id,
        m.surplus_id as surplusId,
        m.center_id as centerId,
        m.allocated_kg as allocatedKg,
        m.match_score as matchScore,
        m.demand_score as demandScore,
        m.capacity_score as capacityScore,
        m.travel_score as travelScore,
        m.urgency_score as urgencyScore,
        m.travel_time_min as travelTimeMin,
        m.status,
        m.rejection_reason as rejectionReason,
        m.offered_at as offeredAt,
        m.responded_at as respondedAt,
        m.created_at as createdAt,
        s.food_name as foodName,
        s.category as foodCategory,
        s.quantity_kg as totalQuantityKg,
        s.available_quantity_kg as availableQuantityKg,
        s.preparation_date as preparationDate,
        s.preparation_time as preparationTime,
        s.pickup_deadline as pickupDeadline,
        s.storage_method as storageMethod,
        s.storage_temp as storageTemp,
        s.ingredients,
        s.allergens,
        s.location as canteenLocation,
        s.notes as surplusNotes,
        s.safety_status as safetyStatus,
        c.id as canteenId,
        c.user_id as canteenUserId,
        c.name as canteenName,
        c.coordinator_name as coordinatorName,
        c.coordinator_phone as coordinatorPhone,
        dc.user_id as centerUserId,
        dc.name as centerName,
        dc.address as centerAddress,
        dc.contact_person as centerContactPerson,
        dc.contact_phone as centerContactPhone
      FROM matching_allocations m
      JOIN food_surplus_listings s ON m.surplus_id = s.id
      JOIN canteens c ON s.canteen_id = c.id
      JOIN distribution_centers dc ON m.center_id = dc.id
      WHERE m.id = ?
    `;

    return db.prepare(query).get(id) || null;
  }

  /**
   * Check if an active allocation exists for a surplus and center
   * @param {number} surplusId
   * @param {number} centerId
   * @returns {boolean}
   */
  static hasActiveAllocation(surplusId, centerId) {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT id FROM matching_allocations
      WHERE surplus_id = ? AND center_id = ? AND status IN ('offered', 'accepted')
    `).get(surplusId, centerId);
    return !!row;
  }

  /**
   * Retrieve matching allocations with filters
   * @param {object} filters
   * @returns {Array}
   */
  static findAll({ centerId, surplusId, status, canteenId } = {}) {
    const db = getDatabase();
    const conditions = [];
    const params = [];

    if (centerId) {
      conditions.push('m.center_id = ?');
      params.push(centerId);
    }

    if (surplusId) {
      conditions.push('m.surplus_id = ?');
      params.push(surplusId);
    }

    if (status) {
      conditions.push('m.status = ?');
      params.push(status);
    }

    if (canteenId) {
      conditions.push('s.canteen_id = ?');
      params.push(canteenId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        m.id,
        m.surplus_id as surplusId,
        m.center_id as centerId,
        m.allocated_kg as allocatedKg,
        m.match_score as matchScore,
        m.demand_score as demandScore,
        m.capacity_score as capacityScore,
        m.travel_score as travelScore,
        m.urgency_score as urgencyScore,
        m.travel_time_min as travelTimeMin,
        m.status,
        m.rejection_reason as rejectionReason,
        m.offered_at as offeredAt,
        m.responded_at as respondedAt,
        m.created_at as createdAt,
        s.food_name as foodName,
        s.category as foodCategory,
        s.quantity_kg as totalQuantityKg,
        s.pickup_deadline as pickupDeadline,
        c.name as canteenName,
        c.location as canteenLocation,
        dc.name as centerName,
        dc.address as centerAddress
      FROM matching_allocations m
      JOIN food_surplus_listings s ON m.surplus_id = s.id
      JOIN canteens c ON s.canteen_id = c.id
      JOIN distribution_centers dc ON m.center_id = dc.id
      ${whereClause}
      ORDER BY m.offered_at DESC
    `;

    return db.prepare(query).all(...params);
  }

  /**
   * Update allocation status (e.g. accepted, rejected, cancelled)
   * @param {number} id
   * @param {string} status
   * @param {string|null} rejectionReason
   * @returns {object|null}
   */
  static updateStatus(id, status, rejectionReason = null) {
    const db = getDatabase();
    const stmt = db.prepare(`
      UPDATE matching_allocations
      SET status = ?,
          rejection_reason = COALESCE(?, rejection_reason),
          responded_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `);

    stmt.run(status, rejectionReason, id);
    return this.findById(id);
  }
}

module.exports = AllocationModel;
