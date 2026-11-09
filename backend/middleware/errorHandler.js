const { sendError } = require('../utils/response');
const config = require('../config');

/**
 * Centralized Global Error Handler Middleware
 */
function errorHandler(err, req, res, next) {
  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err);

  // Handle SQLite constraint violations
  if (err.code && err.code.startsWith('SQLITE_CONSTRAINT')) {
    if (err.message.includes('UNIQUE')) {
      return sendError(res, 409, 'A record with this information already exists.');
    }
    if (err.message.includes('FOREIGN KEY')) {
      return sendError(res, 400, 'Referenced record does not exist or has active dependencies.');
    }
    if (err.message.includes('CHECK')) {
      return sendError(res, 400, 'Data violates database validation constraints (e.g. quantity must be positive).');
    }
    return sendError(res, 400, 'Database constraint violation.', err.message);
  }

  // Handle Multer upload errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return sendError(res, 400, 'File is too large. Maximum size is 5MB.');
    }
    return sendError(res, 400, `File upload error: ${err.message}`);
  }

  // Handle JWT authentication errors
  if (err.name === 'JsonWebTokenError') {
    return sendError(res, 401, 'Invalid authentication token.');
  }
  if (err.name === 'TokenExpiredError') {
    return sendError(res, 401, 'Authentication token has expired. Please sign in again.');
  }

  // Handle custom status errors
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal server error.';
  const details = config.env === 'development' ? err.stack : undefined;

  return sendError(res, statusCode, message, details);
}

/**
 * 404 Not Found Handler for undefined routes
 */
function notFoundHandler(req, res) {
  return sendError(res, 404, `Route not found: ${req.method} ${req.originalUrl}`);
}

module.exports = {
  errorHandler,
  notFoundHandler,
};

