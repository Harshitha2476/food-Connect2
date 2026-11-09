const { getDatabase } = require('../database/connection');

/**
 * Canteen Data Access Model
 * Manages database operations for the canteens table using prepared statements.
 */
class CanteenModel {
  /**
   * Find canteen by primary key ID
   * @param {number} id
   * @returns {object|null}
   */
  static findById(id) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM canteens WHERE id = ?').get(id) || null;
  }

  /**
   * Find canteen linked to a specific user account
   * @param {number} userId
   * @returns {object|null}
   */
  static findByUserId(userId) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM canteens WHERE user_id = ?').get(userId) || null;
  }

  /**
   * Retrieve all canteens
   * @returns {Array}
   */
  static findAll() {
    const db = getDatabase();
    return db.prepare('SELECT * FROM canteens ORDER BY name ASC').all();
  }

  /**
   * Create a new canteen record
   * @param {object} param0
   * @returns {object}
   */
  static create({ userId, name, location, lat, lng, coordinatorName, coordinatorPhone, sustainabilityScore = 75 }) {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO canteens (user_id, name, location, lat, lng, coordinator_name, coordinator_phone, sustainability_score)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      userId,
      name.trim(),
      location.trim(),
      parseFloat(lat || 12.9716),
      parseFloat(lng || 77.5946),
      coordinatorName.trim(),
      coordinatorPhone ? coordinatorPhone.trim() : null,
      parseInt(sustainabilityScore, 10) || 75
    );

    return this.findById(result.lastInsertRowid);
  }

  /**
   * Update canteen details
   * @param {number} id
   * @param {object} updates
   * @returns {object|null}
   */
  static update(id, updates) {
    const db = getDatabase();
    const stmt = db.prepare(`
      UPDATE canteens
      SET name = COALESCE(?, name),
          location = COALESCE(?, location),
          lat = COALESCE(?, lat),
          lng = COALESCE(?, lng),
          coordinator_name = COALESCE(?, coordinator_name),
          coordinator_phone = COALESCE(?, coordinator_phone),
          sustainability_score = COALESCE(?, sustainability_score),
          updated_at = datetime('now')
      WHERE id = ?
    `);

    stmt.run(
      updates.name ? updates.name.trim() : null,
      updates.location ? updates.location.trim() : null,
      updates.lat !== undefined ? parseFloat(updates.lat) : null,
      updates.lng !== undefined ? parseFloat(updates.lng) : null,
      updates.coordinatorName ? updates.coordinatorName.trim() : null,
      updates.coordinatorPhone ? updates.coordinatorPhone.trim() : null,
      updates.sustainabilityScore !== undefined ? parseInt(updates.sustainabilityScore, 10) : null,
      id
    );

    return this.findById(id);
  }
}

module.exports = CanteenModel;

