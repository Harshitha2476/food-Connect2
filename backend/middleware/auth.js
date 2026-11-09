const { verifyToken } = require('../utils/jwt');
const UserModel = require('../models/User');
const { sendError } = require('../utils/response');

/**
 * Authentication Middleware
 * Validates the JWT Bearer token from the Authorization header,
 * ensures the user exists and is active, then attaches the user to req.user.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(
      res,
      401,
      'Authentication required. Please provide a valid Bearer token in the Authorization header.'
    );
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyToken(token);
    const user = UserModel.findById(decoded.id);

    if (!user) {
      return sendError(res, 401, 'User account associated with this token no longer exists.');
    }

    if (user.is_active !== 1) {
      return sendError(res, 403, 'Your account has been deactivated. Please contact an administrator.');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return sendError(res, 401, 'Your session has expired. Please log in again.');
    }
    return sendError(res, 401, 'Invalid authentication token.');
  }
}

/**
 * Optional Authentication Middleware
 * If a valid Bearer token is provided, attaches user to req.user.
 * If no token is provided, leaves req.user = null and proceeds without error.
 */
function optionalAuthenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyToken(token);
    const user = UserModel.findById(decoded.id);
    req.user = user && user.is_active === 1 ? user : null;
  } catch {
    req.user = null;
  }
  next();
}

/**
 * Role-Based Authorization Middleware
 * Verifies that the authenticated user possesses one of the allowed roles.
 * @param  {...string} allowedRoles - e.g. 'canteen', 'ngo', 'volunteer', 'admin', 'safety_officer'
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 401, 'Authentication required prior to role verification.');
    }

    if (!allowedRoles.includes(req.user.role)) {
      return sendError(
        res,
        403,
        `Access denied: Your role (${req.user.role}) is not authorized to perform this action. Required role(s): ${allowedRoles.join(', ')}.`
      );
    }

    next();
  };
}

module.exports = {
  authenticate,
  optionalAuthenticate,
  authorize,
};
