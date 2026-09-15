const express = require('express');
const { protect, requireAnyAdmin } = require('../middleware/auth');
const { getDashboard } = require('../controllers/dashboardController');

const router = express.Router();
router.get('/', protect, requireAnyAdmin, getDashboard);

module.exports = router;
