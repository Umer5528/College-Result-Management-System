const asyncHandler = require('express-async-handler');
const CollegeSettings = require('../models/CollegeSettings');
const { ok } = require('../utils/apiResponse');
const { logAction } = require('../services/auditService');
const { AUDIT_ACTIONS } = require('../config/constants');

// GET /api/settings
const getSettings = asyncHandler(async (req, res) => {
  let settings = await CollegeSettings.findOne();
  if (!settings) {
    settings = await CollegeSettings.create({});
  }
  return ok(res, settings);
});

// PUT /api/settings
const updateSettings = asyncHandler(async (req, res) => {
  let settings = await CollegeSettings.findOne();
  if (!settings) {
    settings = new CollegeSettings({});
  }

  const fields = [
    'collegeName',
    'logoUrl',
    'address',
    'city',
    'province',
    'country',
    'phone',
    'email',
    'website',
    'principalName',
    'academicSession',
  ];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) settings[f] = req.body[f];
  });

  await settings.save();

  await logAction({
    user: req.user,
    action: AUDIT_ACTIONS.SETTINGS_UPDATED,
    description: 'College settings updated',
    req,
  });

  return ok(res, settings, 'Settings updated');
});

module.exports = { getSettings, updateSettings };
