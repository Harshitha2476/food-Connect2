const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Sign a new JWT token for an authenticated user
 * @param {object} user - User record { id, email, role, name, organization }
 * @returns {string} - Signed JWT
 */
function signToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    organization: user.organization,
  };

  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
}

/**
 * Verify and decode a JWT token
 * @param {string} token 
 * @returns {object} - Decoded payload
 */
function verifyToken(token) {
  return jwt.verify(token, config.jwt.secret);
}

module.exports = {
  signToken,
  verifyToken,
};

