const { getDatabase } = require('../database/connection');

/**
 * Distribution Center Data Access Model
 * Manages operations for distribution_centers and food_demand tables.
 */
class CenterModel {
  /**
   * Calculate authoritative capacity metrics considering active commitments and occupied food
   * @param {number} centerId
   * @param {number|null} newTotalCapacity
   * @returns {object} { totalCapacityKg, committedKg, occupiedKg, totalCommittedAndOccupied, availableCapacityKg }
   */
  static calculateCapacityMetrics(centerId, newTotalCapacity = null) {
    const db = getDatabase();
    const center = db.prepare('SELECT capacity_kg FROM distribution_centers WHERE id = ?').get(centerId);
    if (!center) return null;

    const total = newTotalCapacity !== null ? parseFloat(newTotalCapacity) : parseFloat(center.capacity_kg);

    // Active commitments: food allocations offered or accepted (not yet finished)
    const committedRow = db.prepare(`
      SELECT COALESCE(SUM(allocated_kg), 0) as committedKg
      FROM matching_allocations
      WHERE center_id = ? AND status IN ('offered', 'accepted')
    `).get(centerId);
    const committedKg = committedRow ? parseFloat(committedRow.committedKg) : 0;

    // Occupied inventory: food currently collected or in transit to this center
    const occupiedRow = db.prepare(`
      SELECT COALESCE(SUM(quantity_kg), 0) as occupiedKg
      FROM pickup_records
      WHERE center_id = ? AND status IN ('collected', 'in_transit')
    `).get(centerId);
    const occupiedKg = occupiedRow ? parseFloat(occupiedRow.occupiedKg) : 0;

    const totalCommittedAndOccupied = Math.round((committedKg + occupiedKg) * 10) / 10;
    const available = Math.max(0, Math.round((total - totalCommittedAndOccupied) * 10) / 10);

    return {
      totalCapacityKg: total,
      committedKg,
      occupiedKg,
      totalCommittedAndOccupied,
      availableCapacityKg: available,
    };
  }

  /**
   * Register a new distribution center
   * Note: travelTimeMin is initialized objectively, not set manually by the client.
   * @param {object} centerData
   * @returns {object}
   */
  static create({
    userId,
    name,
    address,
    lat,
    lng,
    capacityKg,
    contactPerson,
    contactPhone,
    isVerified = 1,
  }) {
    const db = getDatabase();
    const totalCap = parseFloat(capacityKg);

    const stmt = db.prepare(`
      INSERT INTO distribution_centers (
        user_id, name, address, lat, lng, travel_time_min, capacity_kg,
        available_capacity_kg, contact_person, contact_phone, is_verified
      ) VALUES (?, ?, ?, ?, ?, 10, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      userId,
      name.trim(),
      address.trim(),
      parseFloat(lat),
      parseFloat(lng),
      totalCap,
      totalCap, // Initially available == total
      contactPerson.trim(),
      contactPhone.trim(),
      isVerified ? 1 : 0
    );

    return this.findById(result.lastInsertRowid);
  }

  /**
   * Find a distribution center by ID with its active demand
   * @param {number} id
   * @returns {object|null}
   */
  static findById(id) {
    const db = getDatabase();
    const query = `
      SELECT 
        dc.id,
        dc.user_id as userId,
        dc.name,
        dc.address,
        dc.lat,
        dc.lng,
        dc.travel_time_min as travelTimeMin,
        dc.capacity_kg as capacityKg,
        dc.available_capacity_kg as availableCapacityKg,
        dc.contact_person as contactPerson,
        dc.contact_phone as contactPhone,
        dc.is_verified as isVerified,
        dc.created_at as createdAt,
        dc.updated_at as updatedAt,
        fd.categories as demandCategoriesJson,
        fd.demand_kg as demandKg,
        fd.urgency,
        fd.dietary_notes as dietaryNotes
      FROM distribution_centers dc
      LEFT JOIN food_demand fd ON dc.id = fd.center_id AND fd.is_active = 1
      WHERE dc.id = ?
    `;

    const row = db.prepare(query).get(id);
    if (!row) return null;

    let demandCategories = [];
    try {
      demandCategories = row.demandCategoriesJson ? JSON.parse(row.demandCategoriesJson) : [];
    } catch {
      demandCategories = [];
    }

    return {
      ...row,
      demandCategories,
      demandCategoriesJson: undefined,
    };
  }

  /**
   * Find a distribution center linked to a specific user account
   * @param {number} userId
   * @returns {object|null}
   */
  static findByUserId(userId) {
    const db = getDatabase();
    const row = db.prepare('SELECT id FROM distribution_centers WHERE user_id = ?').get(userId);
    if (!row) return null;
    return this.findById(row.id);
  }

  /**
   * Retrieve all distribution centers with active demand
   * @param {object} filters
   * @returns {Array}
   */
  static findAll({ maxTravelTime, search } = {}) {
    const db = getDatabase();
    const conditions = [];
    const params = [];

    if (maxTravelTime) {
      conditions.push('dc.travel_time_min <= ?');
      params.push(parseInt(maxTravelTime, 10));
    }

    if (search) {
      conditions.push('(dc.name LIKE ? OR dc.address LIKE ? OR dc.contact_person LIKE ?)');
      const pattern = `%${search.trim()}%`;
      params.push(pattern, pattern, pattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        dc.id,
        dc.user_id as userId,
        dc.name,
        dc.address,
        dc.lat,
        dc.lng,
        dc.travel_time_min as travelTimeMin,
        dc.capacity_kg as capacityKg,
        dc.available_capacity_kg as availableCapacityKg,
        dc.contact_person as contactPerson,
        dc.contact_phone as contactPhone,
        dc.is_verified as isVerified,
        dc.created_at as createdAt,
        dc.updated_at as updatedAt,
        fd.categories as demandCategoriesJson,
        COALESCE(fd.demand_kg, 0) as demandKg,
        COALESCE(fd.urgency, 'medium') as urgency,
        fd.dietary_notes as dietaryNotes
      FROM distribution_centers dc
      LEFT JOIN food_demand fd ON dc.id = fd.center_id AND fd.is_active = 1
      ${whereClause}
      ORDER BY dc.name ASC
    `;

    const rows = db.prepare(query).all(...params);

    return rows.map((row) => {
      let demandCategories = [];
      try {
        demandCategories = row.demandCategoriesJson ? JSON.parse(row.demandCategoriesJson) : [];
      } catch {
        demandCategories = [];
      }
      return {
        ...row,
        demandCategories,
        demandCategoriesJson: undefined,
      };
    });
  }

  /**
   * Update distribution center details (excluding capacity and travel time)
   * @param {number} id
   * @param {object} updates
   * @returns {object|null}
   */
  static update(id, updates) {
    const db = getDatabase();
    const stmt = db.prepare(`
      UPDATE distribution_centers
      SET name = COALESCE(?, name),
          address = COALESCE(?, address),
          lat = COALESCE(?, lat),
          lng = COALESCE(?, lng),
          contact_person = COALESCE(?, contact_person),
          contact_phone = COALESCE(?, contact_phone),
          updated_at = datetime('now')
      WHERE id = ?
    `);

    stmt.run(
      updates.name ? updates.name.trim() : null,
      updates.address ? updates.address.trim() : null,
      updates.lat !== undefined ? parseFloat(updates.lat) : null,
      updates.lng !== undefined ? parseFloat(updates.lng) : null,
      updates.contactPerson ? updates.contactPerson.trim() : null,
      updates.contactPhone ? updates.contactPhone.trim() : null,
      id
    );

    return this.findById(id);
  }

  /**
   * Authoritatively update center capacity inside a transaction
   * Available capacity is calculated by the backend taking into account commitments and occupancy.
   * @param {number} id
   * @param {number} newTotalCapacity
   * @returns {object}
   */
  static updateCapacity(id, newTotalCapacity) {
    const db = getDatabase();
    let updatedCenter = null;

    const tx = db.transaction(() => {
      const metrics = this.calculateCapacityMetrics(id, newTotalCapacity);
      if (!metrics) {
        throw new Error(`Distribution center #${id} not found`);
      }

      const stmt = db.prepare(`
        UPDATE distribution_centers
        SET capacity_kg = ?,
            available_capacity_kg = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `);

      stmt.run(metrics.totalCapacityKg, metrics.availableCapacityKg, id);
      updatedCenter = this.findById(id);
    });

    tx();
    return updatedCenter;
  }

  /**
   * Recalculate and synchronize available capacity for a center
   * Called when an allocation is accepted, rejected, completed, or cancelled.
   * @param {number} centerId
   */
  static syncAvailableCapacity(centerId) {
    const db = getDatabase();
    const metrics = this.calculateCapacityMetrics(centerId);
    if (metrics) {
      db.prepare(`
        UPDATE distribution_centers
        SET available_capacity_kg = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(metrics.availableCapacityKg, centerId);
    }
  }

  /**
   * Record or update food demand for a distribution center
   * @param {number} centerId
   * @param {object} demandData
   * @returns {object}
   */
  static updateDemand(centerId, { categories, demandKg, urgency = 'medium', dietaryNotes = null }) {
    const db = getDatabase();
    const categoriesJson = JSON.stringify(Array.isArray(categories) ? categories : []);
    const qty = parseFloat(demandKg || 0);

    const existing = db.prepare('SELECT id FROM food_demand WHERE center_id = ? AND is_active = 1').get(centerId);

    if (existing) {
      db.prepare(`
        UPDATE food_demand
        SET categories = ?,
            demand_kg = ?,
            urgency = ?,
            dietary_notes = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(categoriesJson, qty, urgency, dietaryNotes ? dietaryNotes.trim() : null, existing.id);
    } else {
      db.prepare(`
        INSERT INTO food_demand (center_id, categories, demand_kg, urgency, dietary_notes, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
      `).run(centerId, categoriesJson, qty, urgency, dietaryNotes ? dietaryNotes.trim() : null);
    }

    return this.findById(centerId);
  }
}

module.exports = CenterModel;
