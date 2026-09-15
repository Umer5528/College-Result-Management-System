const AuditLog = require('../models/AuditLog');

/**
 * Fire-and-forget audit logging. Never throws into the caller's flow —
 * a logging failure must not block the underlying business action.
 */
async function logAction({ user, userLabel = '', action, description = '', metadata = {}, req = null }) {
  try {
    await AuditLog.create({
      user: user ? user._id : null,
      userLabel,
      action,
      description,
      metadata,
      ipAddress: req ? req.ip : '',
    });
  } catch (err) {
    console.error('[Audit] Failed to write audit log:', err.message);
  }
}

module.exports = { logAction };
