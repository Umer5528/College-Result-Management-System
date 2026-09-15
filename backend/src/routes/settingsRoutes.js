const express = require('express');
const { protect, requireAnyAdmin } = require('../middleware/auth');
const { getSettings, updateSettings } = require('../controllers/settingsController');

const router = express.Router();

router.get('/', protect, requireAnyAdmin, getSettings);
router.put('/', protect, requireAnyAdmin, updateSettings);

module.exports = router;
