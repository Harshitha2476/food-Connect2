const express = require('express');
const router = express.Router();
const SurplusController = require('../controllers/surplusController');
const { authenticate, optionalAuthenticate, authorize } = require('../middleware/auth');
const { upload, validateImageMagicBytes } = require('../middleware/upload');
const {
  validateCreateSurplus,
  validateUpdateSurplus,
  validateSafetyStatus,
} = require('../middleware/validators/surplusValidator');

// 1. Create Surplus Listing (Canteen Coordinator or Admin)
// Uses Multer for upload, followed by binary magic byte inspection, followed by express-validator
router.post(
  '/',
  authenticate,
  authorize('canteen', 'admin'),
  upload.single('photo'),
  validateImageMagicBytes,
  validateCreateSurplus,
  SurplusController.create
);

// 2. View My Canteen Listings (Canteen Coordinator)
router.get('/my', authenticate, authorize('canteen'), (req, res, next) => {
  req.query.myOnly = 'true';
  return SurplusController.getAll(req, res, next);
});

// 3. View All Surplus Listings with Filtering (Public receives privacy-sanitized contacts)
router.get('/', optionalAuthenticate, SurplusController.getAll);

// 4. View Specific Listing by ID
router.get('/:id', optionalAuthenticate, SurplusController.getById);

// 5. Update Listing Details (Owning Canteen or Admin)
router.put(
  '/:id',
  authenticate,
  authorize('canteen', 'admin'),
  upload.single('photo'),
  validateImageMagicBytes,
  validateUpdateSurplus,
  SurplusController.update
);

// 6. Safe Cancellation of Listing (Owning Canteen or Admin)
router.delete('/:id', authenticate, authorize('canteen', 'admin'), SurplusController.cancel);

// 7. Food Safety Officer Verification Decision (Safety Officer or Admin)
router.put(
  '/:id/safety',
  authenticate,
  authorize('safety_officer', 'admin'),
  validateSafetyStatus,
  SurplusController.updateSafety
);

module.exports = router;
