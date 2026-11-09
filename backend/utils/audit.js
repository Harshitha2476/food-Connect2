const { getDatabase } = require('../database/connection');

/**
 * Records an entry into the audit_logs table
 * @param {number|null} userId - The user performing the action
 * @param {string} action - Action code (e.g., 'USER_LOGIN', 'USER_REGISTER')
 * @param {string} entityType - Target entity type (e.g., 'users', 'auth')
 * @param {number|null} entityId - Target entity ID
 * @param {object|null} details - Structured JSON details
 * @param {object|null} req - Express request object for IP address
 */
function logAudit(userId, action, entityType, entityId = null, details = null, req = null) {
  try {
    const db = getDatabase();
    const ipAddress = req
      ? req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null
      : null;

    const stmt = db.prepare(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details_json, ip_address)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      userId || null,
      action,
      entityType,
      entityId || null,
      details ? JSON.stringify(details) : null,
      ipAddress
    );
  } catch (error) {
    console.error('Failed to write audit log:', error.message);
  }
}

module.exports = {
  logAudit,
};

