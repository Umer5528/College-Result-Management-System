const asyncHandler = require('express-async-handler');
const AuditLog = require('../models/AuditLog');
const { ok } = require('../utils/apiResponse');

// GET /api/audit-logs?page=&limit=&action=
const listAuditLogs = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, action } = req.query;
  const filter = {};
  if (action) filter.action = action;

  const skip = (Number(page) - 1) * Number(limit);
  const [logs, total] = await Promise.all([
    AuditLog.find(filter).populate('user', 'name email role').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    AuditLog.countDocuments(filter),
  ]);

  return ok(res, { logs, total, page: Number(page), limit: Number(limit) });
});

module.exports = { listAuditLogs };
