/**
 * Privacy & Sanitization Utilities
 * Protects personal contact details and sensitive operational data on public endpoints.
 */

/**
 * Mask a phone number for public display (e.g. "+91 98765 43210" -> "+91 98*** ***10")
 * @param {string} phone
 * @returns {string}
 */
function maskPhone(phone) {
  if (!phone || typeof phone !== 'string') return null;
  const trimmed = phone.trim();
  if (trimmed.length < 6) return '***';
  const prefix = trimmed.slice(0, 6);
  const suffix = trimmed.slice(-2);
  return `${prefix}*** ***${suffix}`;
}

/**
 * Sanitize a single surplus food listing for output
 * @param {object} listing - Listing from database
 * @param {object|null} user - Authenticated user from req.user
 * @returns {object} Sanitized listing
 */
function sanitizeSurplus(listing, user = null) {
  if (!listing) return null;
  const result = { ...listing };

  const isPrivileged =
    user && (user.role === 'admin' || user.id === listing.canteenUserId);

  if (!isPrivileged) {
    // Mask coordinator phone and strip internal user id
    if (result.coordinatorPhone) {
      result.coordinatorPhone = maskPhone(result.coordinatorPhone);
    }
    delete result.canteenUserId;
  }

  return result;
}

/**
 * Sanitize an array of surplus listings
 */
function sanitizeSurplusList(listings, user = null) {
  if (!Array.isArray(listings)) return [];
  return listings.map((l) => sanitizeSurplus(l, user));
}

/**
 * Sanitize a single distribution center record
 * @param {object} center
 * @param {object|null} user
 * @returns {object}
 */
function sanitizeCenter(center, user = null) {
  if (!center) return null;
  const result = { ...center };

  const isPrivileged =
    user && (user.role === 'admin' || user.id === center.userId);

  if (!isPrivileged) {
    if (result.contactPhone) {
      result.contactPhone = maskPhone(result.contactPhone);
    }
    delete result.userId;
  }

  return result;
}

/**
 * Sanitize an array of distribution centers
 */
function sanitizeCenterList(centers, user = null) {
  if (!Array.isArray(centers)) return [];
  return centers.map((c) => sanitizeCenter(c, user));
}

module.exports = {
  maskPhone,
  sanitizeSurplus,
  sanitizeSurplusList,
  sanitizeCenter,
  sanitizeCenterList,
};

