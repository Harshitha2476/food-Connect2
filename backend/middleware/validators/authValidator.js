const { body, validationResult } = require('express-validator');
const { sendError } = require('../../utils/response');

/**
 * Middleware to check validation results and return formatted response
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value,
    }));
    return sendError(res, 400, 'Validation failed. Please check the submitted fields.', formattedErrors);
  }
  next;
  next();
}

/**
 * Public registration validation rules.
 * Enforces that public users can only register as canteen, ngo, or volunteer.
 * Explicitly rejects public attempts to claim 'admin' or 'safety_officer' roles.
 */
const validateRegister = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Full name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),

  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{7,15}$/)
    .withMessage('Please enter a valid phone number (e.g. +91 98765 43210)'),

  body('organization')
    .trim()
    .notEmpty()
    .withMessage('Organization or canteen name is required')
    .isLength({ min: 2, max: 150 })
    .withMessage('Organization name must be between 2 and 150 characters'),

  body('role')
    .trim()
    .notEmpty()
    .withMessage('Role is required')
    .custom((role) => {
      const publicRoles = ['canteen', 'ngo', 'volunteer'];
      const privilegedRoles = ['admin', 'safety_officer'];

      if (privilegedRoles.includes(role)) {
        throw new Error(
          `Unauthorized role assignment: The role '${role}' cannot be assigned via public registration. Please contact a Campus Administrator.`
        );
      }

      if (!publicRoles.includes(role)) {
        throw new Error(`Invalid role '${role}'. Allowed public roles are: ${publicRoles.join(', ')}`);
      }

      return true;
    }),

  handleValidationErrors,
];

/**
 * Login validation rules
 */
const validateLogin = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required'),

  handleValidationErrors,
];

/**
 * Admin user creation validation rules (allows privileged roles: admin, safety_officer)
 */
const validateAdminCreateUser = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Full name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),

  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required'),

  body('organization')
    .trim()
    .notEmpty()
    .withMessage('Organization is required'),

  body('role')
    .trim()
    .notEmpty()
    .withMessage('Role is required')
    .isIn(['canteen', 'ngo', 'volunteer', 'admin', 'safety_officer'])
    .withMessage('Invalid role specified. Must be canteen, ngo, volunteer, admin, or safety_officer'),

  handleValidationErrors,
];

/**
 * Password change validation rules
 */
const validateChangePassword = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),

  body('newPassword')
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long'),

  handleValidationErrors,
];

module.exports = {
  validateRegister,
  validateLogin,
  validateAdminCreateUser,
  validateChangePassword,
};

