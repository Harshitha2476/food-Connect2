const { getDatabase } = require('../database/connection');

/**
 * Notification Data Access Model
 * Manages notification creation and querying for users and roles.
 */
class NotificationModel {
  /**
   * Create a notification record
   * @param {object} param0
   * @returns {object}
   */
  static create({ userId = null, recipientRole = 'all', type = 'system', title, message, data = null }) {
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO notifications (user_id, recipient_role, type, title, message, data_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      userId,
      recipientRole,
      type,
      title.trim(),
      message.trim(),
      data ? JSON.stringify(data) : null
    );

    return this.findById(result.lastInsertRowid);
  }

  /**
   * Find notification by ID
   * @param {number} id
   * @returns {object|null}
   */
  static findById(id) {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT id, user_id as userId, recipient_role as recipientRole, type,
             title, message, data_json as dataJson, is_read as isRead, created_at as createdAt
      FROM notifications
      WHERE id = ?
    `).get(id);

    if (!row) return null;

    let data = null;
    try {
      data = row.dataJson ? JSON.parse(row.dataJson) : null;
    } catch {
      data = null;
    }

    return {
      ...row,
      data,
      dataJson: undefined,
      isRead: Boolean(row.isRead),
    };
  }

  /**
   * Find notifications for a specific user or role
   * @param {number} userId
   * @param {object} options
   * @returns {Array}
   */
  static findByUserId(userId, { unreadOnly = false, limit = 50 } = {}) {
    const db = getDatabase();
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId);
    const role = user ? user.role : 'all';

    let query = `
      SELECT id, user_id as userId, recipient_role as recipientRole, type,
             title, message, data_json as dataJson, is_read as isRead, created_at as createdAt
      FROM notifications
      WHERE (user_id = ? OR recipient_role = ? OR recipient_role = 'all')
    `;

    if (unreadOnly) {
      query += ' AND is_read = 0';
    }

    query += ' ORDER BY created_at DESC LIMIT ?';

    const rows = db.prepare(query).all(userId, role, limit);

    return rows.map((row) => {
      let data = null;
      try {
        data = row.dataJson ? JSON.parse(row.dataJson) : null;
      } catch {
        data = null;
      }
      return {
        ...row,
        data,
        dataJson: undefined,
        isRead: Boolean(row.isRead),
      };
    });
  }

  /**
   * Mark a notification as read
   * @param {number} id
   * @param {number} userId
   */
  static markAsRead(id, userId) {
    const db = getDatabase();
    db.prepare(`
      UPDATE notifications
      SET is_read = 1
      WHERE id = ? AND (user_id = ? OR user_id IS NULL)
    `).run(id, userId);
  }
}

module.exports = NotificationModel;

