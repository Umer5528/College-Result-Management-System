const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, requireSuperAdmin } = require('../middleware/auth');
const {
  listAdmins,
  createAdmin,
  updateAdmin,
  disableAdmin,
  enableAdmin,
  resetAdminPassword,
} = require('../controllers/superAdminController');

const router = express.Router();

router.use(protect, requireSuperAdmin);

router.get('/admins', listAdmins);

router.post(
  '/admins',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  validate,
  createAdmin
);

router.put('/admins/:id', updateAdmin);
router.put('/admins/:id/disable', disableAdmin);
router.put('/admins/:id/enable', enableAdmin);
router.put('/admins/:id/reset-password', resetAdminPassword);

module.exports = router;
