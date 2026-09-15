const asyncHandler = require('express-async-handler');
const crypto = require('crypto');
const User = require('../models/User');
const { ok, created, fail } = require('../utils/apiResponse');
const { logAction } = require('../services/auditService');
const { AUDIT_ACTIONS, ROLES } = require('../config/constants');

// GET /api/super-admin/admins
const listAdmins = asyncHandler(async (req, res) => {
  const admins = await User.find({ role: ROLES.ADMIN }).sort({ createdAt: -1 });
  return ok(res, admins);
});

// POST /api/super-admin/admins
const createAdmin = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    return fail(res, 'An account with this email already exists', 409);
  }

  const passwordHash = await User.hashPassword(password);
  const admin = await User.create({
    name,
    email: email.toLowerCase().trim(),
    passwordHash,
    role: ROLES.ADMIN,
    createdBy: req.user._id,
  });

  await logAction({
    user: req.user,
    action: AUDIT_ACTIONS.ADMIN_CREATED,
    description: `Super Admin created Admin account: ${admin.email}`,
    req,
  });

  return created(res, admin, 'Admin account created');
});

// PUT /api/super-admin/admins/:id
const updateAdmin = asyncHandler(async (req, res) => {
  const { name, email } = req.body;
  const admin = await User.findOne({ _id: req.params.id, role: ROLES.ADMIN });
  if (!admin) return fail(res, 'Admin not found', 404);

  if (name) admin.name = name;
  if (email) admin.email = email.toLowerCase().trim();
  await admin.save();

  await logAction({
    user: req.user,
    action: AUDIT_ACTIONS.ADMIN_EDITED,
    description: `Super Admin edited Admin account: ${admin.email}`,
    req,
  });

  return ok(res, admin, 'Admin updated');
});

// PUT /api/super-admin/admins/:id/disable
const disableAdmin = asyncHandler(async (req, res) => {
  const admin = await User.findOne({ _id: req.params.id, role: ROLES.ADMIN });
  if (!admin) return fail(res, 'Admin not found', 404);

  admin.isActive = false;
  await admin.save();

  await logAction({
    user: req.user,
    action: AUDIT_ACTIONS.ADMIN_DISABLED,
    description: `Super Admin disabled Admin account: ${admin.email}`,
    req,
  });

  return ok(res, admin, 'Admin account disabled');
});

// PUT /api/super-admin/admins/:id/enable
const enableAdmin = asyncHandler(async (req, res) => {
  const admin = await User.findOne({ _id: req.params.id, role: ROLES.ADMIN });
  if (!admin) return fail(res, 'Admin not found', 404);

  admin.isActive = true;
  await admin.save();

  await logAction({
    user: req.user,
    action: AUDIT_ACTIONS.ADMIN_ENABLED,
    description: `Super Admin enabled Admin account: ${admin.email}`,
    req,
  });

  return ok(res, admin, 'Admin account enabled');
});

// PUT /api/super-admin/admins/:id/reset-password
const resetAdminPassword = asyncHandler(async (req, res) => {
  const admin = await User.findOne({ _id: req.params.id, role: ROLES.ADMIN });
  if (!admin) return fail(res, 'Admin not found', 404);

  // Generate a temporary strong password if none supplied
  const tempPassword = req.body.newPassword || crypto.randomBytes(6).toString('hex');
  admin.passwordHash = await User.hashPassword(tempPassword);
  await admin.save();

  await logAction({
    user: req.user,
    action: AUDIT_ACTIONS.ADMIN_PASSWORD_RESET,
    description: `Super Admin reset password for Admin account: ${admin.email}`,
    req,
  });

  return ok(res, { temporaryPassword: tempPassword }, 'Password reset successfully');
});

module.exports = {
  listAdmins,
  createAdmin,
  updateAdmin,
  disableAdmin,
  enableAdmin,
  resetAdminPassword,
};
