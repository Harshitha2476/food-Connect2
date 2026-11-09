const { body, validationResult } = require('express-validator');
const { sendError } = require('../../utils/response');
const { cleanupFile } = require('../upload');

const VALID_CATEGORIES = ['Cooked Meals', 'Rice', 'Vegetables', 'Fruits', 'Bakery', 'Other'];
const VALID_STORAGE = ['Hot holding', 'Refrigerated', 'Room temperature', 'Frozen'];

/**
 * Handle validation errors from express-validator
 * Automatically removes uploaded file if form validation fails.
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    if (req.file) {
      cleanupFile(req.file.path);
    }
    const formattedErrors = errors.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value,
    }));
    return sendError(res, 400, 'Validation failed for surplus food listing.', formattedErrors);
  }
  next();
}

/**
 * Validation rules for creating a surplus food listing
 */
const validateCreateSurplus = [
  body('foodName')
    .trim()
    .notEmpty()
    .withMessage('Food name is required')
    .isLength({ min: 2, max: 150 })
    .withMessage('Food name must be between 2 and 150 characters'),

  body('category')
    .trim()
    .notEmpty()
    .withMessage('Category is required')
    .isIn(VALID_CATEGORIES)
    .withMessage(`Invalid food category. Allowed: ${VALID_CATEGORIES.join(', ')}`),

  body('quantityKg')
    .notEmpty()
    .withMessage('Quantity is required')
    .isFloat({ gt: 0 })
    .withMessage('Quantity must be a positive number greater than 0 kg'),

  body('preparationDate')
    .trim()
    .notEmpty()
    .withMessage('Preparation date is required')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Preparation date must be in YYYY-MM-DD format'),

  body('preparationTime')
    .trim()
    .notEmpty()
    .withMessage('Preparation time is required')
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage('Preparation time must be in HH:mm 24-hour format (e.g. 12:30)'),

  body('storageMethod')
    .trim()
    .notEmpty()
    .withMessage('Storage method is required')
    .isIn(VALID_STORAGE)
    .withMessage(`Storage method must be one of: ${VALID_STORAGE.join(', ')}`),

  // Storage temperature validation: required for Hot holding, Refrigerated, Frozen
  body('storageTemp')
    .trim()
    .custom((value, { req }) => {
      const method = req.body.storageMethod;
      const tempRequiredMethods = ['Hot holding', 'Refrigerated', 'Frozen'];

      if (tempRequiredMethods.includes(method) && (!value || value.trim() === '')) {
        throw new Error(`Storage temperature is mandatory when storage method is '${method}'`);
      }

      if (value && value.trim() !== '') {
        // Must contain a numeric value and a valid unit (°C, °F, C, F)
        const match = value.match(/^([+-]?\d+(?:\.\d+)?)\s*(°?C|°?F|C|F)$/i);
        if (!match) {
          throw new Error("Storage temperature must be a numeric value with unit (e.g. '65°C', '4°C', '150°F')");
        }
      }

      return true;
    }),

  // Ingredients: mandatory for food safety transparency
  body('ingredients')
    .trim()
    .notEmpty()
    .withMessage('Ingredients list is required for safety transparency and dietary tracking')
    .isLength({ min: 3, max: 500 })
    .withMessage('Ingredients description must be between 3 and 500 characters'),

  // Allergens: mandatory statement (can be 'None' or comma-separated allergen list)
  body('allergens')
    .trim()
    .notEmpty()
    .withMessage("Allergen information is required (state allergens present or explicitly declare 'None')")
    .isLength({ min: 2, max: 200 })
    .withMessage('Allergen information must be between 2 and 200 characters'),

  body('pickupDeadline')
    .trim()
    .notEmpty()
    .withMessage('Pickup deadline is required')
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage('Pickup deadline must be in HH:mm 24-hour format (e.g. 15:00)')
    .custom((deadline, { req }) => {
      const prepTime = req.body.preparationTime;
      const prepDate = req.body.preparationDate;
      const today = new Date().toISOString().slice(0, 10);

      // If preparation is today, pickup deadline must not be earlier than preparation time
      if (prepDate === today && prepTime && deadline) {
        const [pHours, pMins] = prepTime.split(':').map(Number);
        const [dHours, dMins] = deadline.split(':').map(Number);
        const prepTotal = pHours * 60 + pMins;
        const deadTotal = dHours * 60 + dMins;

        if (deadTotal <= prepTotal) {
          throw new Error('Pickup deadline must be scheduled after preparation time');
        }
      }
      return true;
    }),

  body('location')
    .trim()
    .notEmpty()
    .withMessage('Canteen pickup location is required')
    .isLength({ min: 2, max: 200 })
    .withMessage('Location must be between 2 and 200 characters'),

  body('notes')
    .optional({ checkFalsy: true })
    .trim(),

  handleValidationErrors,
];

/**
 * Validation rules for updating a surplus listing
 */
const validateUpdateSurplus = [
  body('foodName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Food name cannot be empty')
    .isLength({ min: 2, max: 150 })
    .withMessage('Food name must be between 2 and 150 characters'),

  body('category')
    .optional()
    .trim()
    .isIn(VALID_CATEGORIES)
    .withMessage(`Invalid category. Allowed: ${VALID_CATEGORIES.join(', ')}`),

  body('quantityKg')
    .optional()
    .isFloat({ gt: 0 })
    .withMessage('Quantity must be a positive number greater than 0 kg'),

  body('preparationDate')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Preparation date must be in YYYY-MM-DD format'),

  body('preparationTime')
    .optional()
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage('Preparation time must be in HH:mm format'),

  body('storageMethod')
    .optional()
    .isIn(VALID_STORAGE)
    .withMessage(`Storage method must be one of: ${VALID_STORAGE.join(', ')}`),

  body('storageTemp')
    .optional()
    .trim()
    .custom((value) => {
      if (value && value.trim() !== '') {
        const match = value.match(/^([+-]?\d+(?:\.\d+)?)\s*(°?C|°?F|C|F)$/i);
        if (!match) {
          throw new Error("Storage temperature must be a numeric value with unit (e.g. '65°C', '4°C')");
        }
      }
      return true;
    }),

  body('ingredients')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Ingredients cannot be empty if specified'),

  body('allergens')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Allergens cannot be empty if specified'),

  body('pickupDeadline')
    .optional()
    .matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .withMessage('Pickup deadline must be in HH:mm format'),

  body('location')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Location cannot be empty'),

  handleValidationErrors,
];

/**
 * Validation rules for Food Safety Officer verification decision
 */
const validateSafetyStatus = [
  body('safetyStatus')
    .trim()
    .notEmpty()
    .withMessage('Safety status is required')
    .isIn(['pending', 'verified', 'rejected'])
    .withMessage("Safety status must be 'pending', 'verified', or 'rejected'"),

  body('notes')
    .trim()
    .custom((notes, { req }) => {
      // Rejection strictly requires an explanatory reason
      if (req.body.safetyStatus === 'rejected' && (!notes || notes.trim() === '')) {
        throw new Error('A detailed reason is mandatory when rejecting food safety eligibility');
      }
      return true;
    }),

  handleValidationErrors,
];

module.exports = {
  validateCreateSurplus,
  validateUpdateSurplus,
  validateSafetyStatus,
};
