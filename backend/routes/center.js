const express = require('express');
const router = express.Router();
const CenterController = require('../controllers/centerController');
const { authenticate, optionalAuthenticate, authorize } = require('../middleware/auth');
const {
  validateCreateCenter,
  validateUpdateCenter,
  validateUpdateDemand,
  validateUpdateCapacity,
} = require('../middleware/validators/centerValidator');

// 1. Register Distribution Center (NGO or Admin)
router.post(
  '/',
  authenticate,
  authorize('ngo', 'admin'),
  validateCreateCenter,
  CenterController.create
);

// 2. View My Center Profile (NGO only)
router.get('/my', authenticate, authorize('ngo'), CenterController.getMyCenter);

// 3. View All Distribution Centers (Public receives privacy-sanitized contacts)
router.get('/', optionalAuthenticate, CenterController.getAll);

// 4. View Specific Center Details
router.get('/:id', optionalAuthenticate, CenterController.getById);

// 5. Update Center Profile
router.put(
  '/:id',
  authenticate,
  authorize('ngo', 'admin'),
  validateUpdateCenter,
  CenterController.update
);

// 6. Update Food Demand Preferences (NGO or Admin)
router.put(
  '/:id/demand',
  authenticate,
  authorize('ngo', 'admin'),
  validateUpdateDemand,
  CenterController.updateDemand
);

// 7. Update Storage Capacity (NGO or Admin)
router.put(
  '/:id/capacity',
  authenticate,
  authorize('ngo', 'admin'),
  validateUpdateCapacity,
  CenterController.updateCapacity
);

module.exports = router;
