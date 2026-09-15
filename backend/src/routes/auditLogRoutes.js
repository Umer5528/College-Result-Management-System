const express = require('express');
const { protect, requireSuperAdmin } = require('../middleware/auth');
const { listAuditLogs } = require('../controllers/auditLogController');

const router = express.Router();
router.get('/', protect, requireSuperAdmin, listAuditLogs);

module.exports = router;
