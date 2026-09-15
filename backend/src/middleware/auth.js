const asyncHandler = require('express-async-handler');
const { verifyAuthToken } = require('../utils/tokens');
const User = require('../models/User');
const { ROLES } = require('../config/constants');

// Verifies JWT, loads the user, and ensures the account is still active.
const protect = asyncHandler(async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    res.status(401);
    throw new Error('Not authenticated: no token provided');
  }

  let decoded;
  try {
    decoded = verifyAuthToken(token);
  } catch (err) {
    res.status(401);
    throw new Error('Not authenticated: invalid or expired token');
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    res.status(401);
    throw new Error('Not authenticated: user no longer exists');
  }
  if (!user.isActive) {
    res.status(403);
    throw new Error('This account has been disabled. Contact the Super Admin.');
  }

  req.user = user;
  next();
});

// Restrict route to specific roles. Super Admin should be given explicit
// access wherever it needs it (never silently bypasses role checks) but in
// practice super_admin is included in every protected admin route below.
const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403);
      throw new Error('You do not have permission to perform this action');
    }
    next();
  };

const requireSuperAdmin = requireRole(ROLES.SUPER_ADMIN);
const requireAnyAdmin = requireRole(ROLES.SUPER_ADMIN, ROLES.ADMIN);

module.exports = { protect, requireRole, requireSuperAdmin, requireAnyAdmin };
