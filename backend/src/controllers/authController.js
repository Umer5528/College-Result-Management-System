const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const { generateAuthToken } = require('../utils/tokens');
const { ok, fail } = require('../utils/apiResponse');
const { logAction } = require('../services/auditService');
const { AUDIT_ACTIONS } = require('../config/constants');

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) {
    await logAction({
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      description: `Login failed - no account for ${email}`,
      req,
    });
    return fail(res, 'Invalid email or password', 401);
  }

  if (!user.isActive) {
    return fail(res, 'This account has been disabled. Contact the Super Admin.', 403);
  }

  const match = await user.comparePassword(password);
  if (!match) {
    await logAction({
      user,
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      description: `Login failed - wrong password for ${email}`,
      req,
    });
    return fail(res, 'Invalid email or password', 401);
  }

  user.lastLoginAt = new Date();
  await user.save();

  const token = generateAuthToken(user);

  await logAction({
    user,
    action: AUDIT_ACTIONS.LOGIN,
    description: `${user.name} (${user.role}) logged in`,
    req,
  });

  return ok(res, { token, user }, 'Login successful');
});

// GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
  return ok(res, req.user, 'Current user');
});

// PUT /api/auth/change-password
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id);

  const match = await user.comparePassword(currentPassword);
  if (!match) {
    return fail(res, 'Current password is incorrect', 400);
  }

  user.passwordHash = await User.hashPassword(newPassword);
  await user.save();

  return ok(res, null, 'Password updated successfully');
});

module.exports = { login, getMe, changePassword };
