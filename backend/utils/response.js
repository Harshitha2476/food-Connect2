/**
 * Consistent API Response Utilities for Campus FoodConnect
 */

/**
 * Format a successful JSON response
 * @param {object} res - Express response object
 * @param {number} statusCode - HTTP status code (default 200)
 * @param {string} message - Human-readable success message
 * @param {any} data - Response payload
 */
function sendSuccess(res, statusCode = 200, message = 'Success', data = null) {
  const response = {
    success: true,
    message,
  };
  if (data !== null && data !== undefined) {
    response.data = data;
  }
  return res.status(statusCode).json(response);
}

/**
 * Format an error JSON response
 * @param {object} res - Express response object
 * @param {number} statusCode - HTTP status code (default 500)
 * @param {string} message - Human-readable error message
 * @param {any} errors - Optional validation errors or details
 */
function sendError(res, statusCode = 500, message = 'An error occurred', errors = null) {
  const response = {
    success: false,
    message,
  };
  if (errors !== null && errors !== undefined) {
    response.errors = errors;
  }
  return res.status(statusCode).json(response);
}

module.exports = {
  sendSuccess,
  sendError,
};

