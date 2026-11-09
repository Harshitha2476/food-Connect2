const { getDatabase } = require('../database/connection');

/**
 * User Data Access Model
 * Handles database operations for the users table using prepared statements.
 */
class UserModel {
  /**
   * Find a user by their email address (case-insensitive)
   * @param {string} email 
   * @returns {object|null}
   */
  static findByEmail(email) {
    if (!email) return null;
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT id, name, email, password_hash, role, organization, phone, is_active, created_at, updated_at
      FROM users
      WHERE email = ? COLLATE NOCASE
    `);
    return stmt.get(email.trim()) || null;
  }

  /**
   * Find a user by their unique primary key ID
   * @param {number} id 
   * @returns {object|null}
   */
  static findById(id) {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT id, name, email, role, organization, phone, is_active, created_at, updated_at
      FROM users
      WHERE id = ?
    `);
    return stmt.get(id) || null;
  }

  /**
   * Find a user with role-specific profile details (canteen, distribution center, or volunteer stats)
   * @param {number} id 
   * @returns {object|null}
   */
  static findByIdWithProfile(id) {
    const user = this.findById(id);
    if (!user) return null;

    const db = getDatabase();
    const result = { ...user };

    if (user.role === 'canteen') {
      const canteen = db.prepare('SELECT * FROM canteens WHERE user_id = ?').get(id);
      result.canteen = canteen || null;
    } else if (user.role === 'ngo') {
      const center = db.prepare('SELECT * FROM distribution_centers WHERE user_id = ?').get(id);
      result.distributionCenter = center || null;
    } else if (user.role === 'volunteer') {
      const stats = db.prepare(`
        SELECT 
          COUNT(CASE WHEN status = 'delivered' THEN 1 END) as completedPickups,
          COUNT(CASE WHEN status NOT IN ('delivered', 'cancelled') THEN 1 END) as activePickups
        FROM pickup_records
        WHERE volunteer_id = ?
      `).get(id);
      result.volunteerStats = {
        completed: stats?.completedPickups || 0,
        active: stats?.activePickups || 0,
      };
    }

    return result;
  }

  /**
   * Create a new user record
   * @param {object} userData
   * @returns {object} The created user (without password_hash)
   */
  static create({ name, email, passwordHash, role, organization, phone }) {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, organization, phone)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      name.trim(),
      email.trim().toLowerCase(),
      passwordHash,
      role,
      organization.trim(),
      phone.trim()
    );

    return this.findById(result.lastInsertRowid);
  }

  /**
   * Update user details
   * @param {number} id 
   * @param {object} updates 
   * @returns {object|null}
   */
  static update(id, { name, organization, phone }) {
    const db = getDatabase();
    const stmt = db.prepare(`
      UPDATE users 
      SET name = COALESCE(?, name),
          organization = COALESCE(?, organization),
          phone = COALESCE(?, phone),
          updated_at = datetime('now')
      WHERE id = ?
    `);
    stmt.run(name || null, organization || null, phone || null, id);
    return this.findById(id);
  }

  /**
   * Update a user's password hash
   * @param {number} id 
   * @param {string} newPasswordHash 
   */
  static updatePassword(id, newPasswordHash) {
    const db = getDatabase();
    const stmt = db.prepare(`
      UPDATE users 
      SET password_hash = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `);
    return stmt.run(newPasswordHash, id);
  }

  /**
   * List all users (admin overview)
   * @returns {Array}
   */
  static listAll() {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT id, name, email, role, organization, phone, is_active, created_at, updated_at
      FROM users
      ORDER BY created_at DESC
    `);
    return stmt.all();
  }
}

module.exports = UserModel;
