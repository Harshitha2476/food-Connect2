const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const { authenticate, authorize } = require('../middleware/auth');
const {
  validateRegister,
  validateLogin,
  validateAdminCreateUser,
  validateChangePassword,
} = require('../middleware/validators/authValidator');
const { sendSuccess } = require('../utils/response');

// 1. Public Authentication Routes
router.post('/register', validateRegister, AuthController.register);
router.post('/login', validateLogin, AuthController.login);

// 2. Protected Authenticated Routes (Requires Valid JWT)
router.get('/me', authenticate, AuthController.getMe);
router.put('/change-password', authenticate, validateChangePassword, AuthController.changePassword);

// 3. Admin-Only User Management (Allows Provisioning Privileged Roles)
router.post(
  '/admin/users',
  authenticate,
  authorize('admin'),
  validateAdminCreateUser,
  AuthController.adminCreateUser
);

// 4. Role Authorization Verification Endpoints (Used for testing and role checking)
router.get('/test/canteen-only', authenticate, authorize('canteen'), (req, res) => {
  sendSuccess(res, 200, 'Authorized: Canteen Coordinator access granted.', { user: req.user });
});

router.get('/test/ngo-only', authenticate, authorize('ngo'), (req, res) => {
  sendSuccess(res, 200, 'Authorized: Distribution Center / NGO access granted.', { user: req.user });
});

router.get('/test/volunteer-only', authenticate, authorize('volunteer'), (req, res) => {
  sendSuccess(res, 200, 'Authorized: Volunteer access granted.', { user: req.user });
});

router.get('/test/admin-only', authenticate, authorize('admin'), (req, res) => {
  sendSuccess(res, 200, 'Authorized: Campus Administrator access granted.', { user: req.user });
});

router.get('/test/safety-only', authenticate, authorize('safety_officer'), (req, res) => {
  sendSuccess(res, 200, 'Authorized: Food Safety Officer access granted.', { user: req.user });
});

module.exports = router;

