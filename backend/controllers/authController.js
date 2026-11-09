const bcrypt = require('bcryptjs');
const UserModel = require('../models/User');
const { getDatabase } = require('../database/connection');
const { signToken } = require('../utils/jwt');
const { logAudit } = require('../utils/audit');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Auth Controller
 * Handles user registration, login, profile retrieval, and administrative user provisioning.
 */
class AuthController {
  /**
   * Public User Registration
   * POST /api/auth/register
   */
  static async register(req, res, next) {
    try {
      const { name, email, password, phone, organization, role } = req.body;

      // 1. Check for existing user by email
      const existingUser = UserModel.findByEmail(email);
      if (existingUser) {
        return sendError(
          res,
          409,
          'An account with this email address already exists. Please sign in instead.'
        );
      }

      // 2. Hash password securely
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      const db = getDatabase();

      // 3. Create user and linked role profile inside a transaction
      let newUser = null;
      const registerTransaction = db.transaction(() => {
        newUser = UserModel.create({
          name,
          email,
          passwordHash,
          role,
          organization,
          phone,
        });

        // Auto-provision initial canteen record if role is canteen
        if (role === 'canteen') {
          db.prepare(`
            INSERT INTO canteens (user_id, name, location, lat, lng, coordinator_name, coordinator_phone, sustainability_score)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            newUser.id,
            organization,
            'Campus Location (Pending Update)',
            12.9716,
            77.5946,
            name,
            phone,
            75
          );
        }

        // Auto-provision initial distribution center record if role is ngo
        if (role === 'ngo') {
          db.prepare(`
            INSERT INTO distribution_centers (
              user_id, name, address, lat, lng, travel_time_min, capacity_kg, available_capacity_kg, contact_person, contact_phone, is_verified
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            newUser.id,
            organization,
            'Center Address (Pending Update)',
            12.9745,
            77.5990,
            10,
            100.0,
            100.0,
            name,
            phone,
            1
          );
        }
      });

      registerTransaction();

      // 4. Generate JWT token
      const token = signToken(newUser);

      // 5. Write audit log
      logAudit(
        newUser.id,
        'USER_REGISTER',
        'users',
        newUser.id,
        { role: newUser.role, email: newUser.email },
        req
      );

      // 6. Return response matching frontend session shape
      return sendSuccess(res, 201, 'Account created successfully.', {
        token,
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          organization: newUser.organization,
          phone: newUser.phone,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * User Login
   * POST /api/auth/login
   */
  static async login(req, res, next) {
    try {
      const { email, password } = req.body;

      // 1. Find user by email
      const user = UserModel.findByEmail(email);
      if (!user) {
        logAudit(null, 'LOGIN_FAILED_NOT_FOUND', 'users', null, { email }, req);
        return sendError(res, 401, 'Invalid email or password.');
      }

      // 2. Check if account is active
      if (user.is_active !== 1) {
        logAudit(user.id, 'LOGIN_BLOCKED_INACTIVE', 'users', user.id, { email }, req);
        return sendError(
          res,
          403,
          'Your account has been deactivated. Please contact an administrator.'
        );
      }

      // 3. Verify password hash using bcryptjs
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        logAudit(user.id, 'LOGIN_FAILED_BAD_PASSWORD', 'users', user.id, { email }, req);
        return sendError(res, 401, 'Invalid email or password.');
      }

      // 4. Generate JWT token
      const token = signToken(user);

      // 5. Record successful login audit log
      logAudit(
        user.id,
        'LOGIN_SUCCESS',
        'users',
        user.id,
        { role: user.role, email: user.email },
        req
      );

      // 6. Return safe session payload matching frontend structure
      return sendSuccess(res, 200, `Welcome back, ${user.name}!`, {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          organization: user.organization,
          phone: user.phone,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Current Authenticated User Profile
   * GET /api/auth/me
   */
  static async getMe(req, res, next) {
    try {
      const userProfile = UserModel.findByIdWithProfile(req.user.id);
      if (!userProfile) {
        return sendError(res, 404, 'User profile not found.');
      }

      // Never expose password_hash
      delete userProfile.password_hash;

      return sendSuccess(res, 200, 'User profile retrieved successfully.', {
        user: userProfile,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin-Controlled User Creation (Privileged Provisioning)
   * POST /api/auth/admin/users
   * Restricted to admin role only
   */
  static async adminCreateUser(req, res, next) {
    try {
      const { name, email, password, phone, organization, role } = req.body;

      // Check duplicate email
      const existingUser = UserModel.findByEmail(email);
      if (existingUser) {
        return sendError(res, 409, 'A user with this email address already exists.');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);
      const newUser = UserModel.create({
        name,
        email,
        passwordHash,
        role,
        organization,
        phone,
      });

      // Audit log
      logAudit(
        req.user.id,
        'ADMIN_CREATE_USER',
        'users',
        newUser.id,
        { createdRole: role, targetEmail: email },
        req
      );

      return sendSuccess(res, 201, `User '${name}' with role '${role}' provisioned successfully.`, {
        user: newUser,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Change Password
   * PUT /api/auth/change-password
   */
  static async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = UserModel.findByEmail(req.user.email);

      const isValid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isValid) {
        return sendError(res, 400, 'Current password is incorrect.');
      }

      const newPasswordHash = await bcrypt.hash(newPassword, 10);
      UserModel.updatePassword(req.user.id, newPasswordHash);

      logAudit(req.user.id, 'CHANGE_PASSWORD', 'users', req.user.id, {}, req);

      return sendSuccess(res, 200, 'Password updated successfully.');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AuthController;

