const { body, validationResult } = require('express-validator');
const { sendError } = require('../../utils/response');

const VALID_CATEGORIES = ['Cooked Meals', 'Rice', 'Vegetables', 'Fruits', 'Bakery', 'Other'];
const VALID_URGENCY = ['low', 'medium', 'high'];

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value,
    }));
    return sendError(res, 400, 'Validation failed for distribution center.', formattedErrors);
  }
  next();
}

/**
 * Validation rules for creating a distribution center.
 * NOTE: Travel time is strictly NOT accepted from user input;
 * it is computed objectively by RoutingService using coordinates.
 */
const validateCreateCenter = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Center name is required')
    .isLength({ min: 2, max: 150 })
    .withMessage('Center name must be between 2 and 150 characters'),

  body('address')
    .trim()
    .notEmpty()
    .withMessage('Address is required')
    .isLength({ min: 5, max: 250 })
    .withMessage('Address must be between 5 and 250 characters'),

  body('lat')
    .notEmpty()
    .withMessage('Latitude coordinate is required')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be a valid float between -90 and 90'),

  body('lng')
    .notEmpty()
    .withMessage('Longitude coordinate is required')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be a valid float between -180 and 180'),

  body('capacityKg')
    .notEmpty()
    .withMessage('Total storage capacity is required')
    .isFloat({ min: 1 })
    .withMessage('Total capacity must be at least 1 kg'),

  body('contactPerson')
    .trim()
    .notEmpty()
    .withMessage('Contact person name is required'),

  body('contactPhone')
    .trim()
    .notEmpty()
    .withMessage('Contact phone number is required'),

  handleValidationErrors,
];

/**
 * Validation rules for updating center basic details.
 * Coordinates are validated. User cannot manually inject arbitrary travelTimeMin.
 */
const validateUpdateCenter = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Center name cannot be empty'),

  body('address')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Address cannot be empty'),

  body('lat')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),

  body('lng')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),

  handleValidationErrors,
];

/**
 * Validation rules for updating food demand preferences
 */
const validateUpdateDemand = [
  body('categories')
    .isArray({ min: 1 })
    .withMessage('At least one food category must be specified')
    .custom((categories) => {
      for (const cat of categories) {
        if (!VALID_CATEGORIES.includes(cat)) {
          throw new Error(`Invalid food category '${cat}'. Allowed: ${VALID_CATEGORIES.join(', ')}`);
        }
      }
      return true;
    }),

  body('demandKg')
    .notEmpty()
    .withMessage('Demand quantity is required')
    .isFloat({ min: 0 })
    .withMessage('Demand quantity must be 0 kg or greater'),

  body('urgency')
    .trim()
    .notEmpty()
    .withMessage('Urgency is required')
    .isIn(VALID_URGENCY)
    .withMessage(`Urgency must be one of: ${VALID_URGENCY.join(', ')}`),

  body('dietaryNotes')
    .optional({ checkFalsy: true })
    .trim(),

  handleValidationErrors,
];

/**
 * Validation rules for updating center capacity.
 * Center sets their total capacity. Available capacity is computed dynamically by the backend.
 */
const validateUpdateCapacity = [
  body('capacityKg')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Total capacity must be a positive number'),

  handleValidationErrors,
];

module.exports = {
  validateCreateCenter,
  validateUpdateCenter,
  validateUpdateDemand,
  validateUpdateCapacity,
};
