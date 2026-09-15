const express = require('express');
const { publicSubmissionLimiter } = require('../middleware/rateLimiters');
const asyncHandler = require('express-async-handler');
const CollegeSettings = require('../models/CollegeSettings');
const { ok } = require('../utils/apiResponse');
const {
  getExamInfo,
  getSubjectRoster,
  submitSubjectResult,
} = require('../controllers/publicSubmissionController');

const router = express.Router();

// Every route here is intentionally unauthenticated (the security boundary is
// the unguessable 64-char token) but rate limited to prevent abuse/scraping.
router.use(publicSubmissionLimiter);

// Minimal public settings (name/logo only) so the login screen and the
// submission page can brand themselves without exposing full college contact
// details or requiring auth.
router.get(
  '/settings',
  asyncHandler(async (req, res) => {
    const settings = await CollegeSettings.findOne();
    return ok(res, {
      collegeName: settings?.collegeName || '',
      logoUrl: settings?.logoUrl || '',
    });
  })
);

router.get('/submit/:token', getExamInfo);
router.get('/submit/:token/subject/:subjectId', getSubjectRoster);
router.post('/submit/:token/subject/:subjectId', submitSubjectResult);

module.exports = router;
