const express = require('express');
const { protect, requireAnyAdmin } = require('../middleware/auth');
const { getSubmission, updateSubmission } = require('../controllers/submissionController');

const router = express.Router();
router.use(protect, requireAnyAdmin);

router.get('/:examinationId/:subjectId', getSubmission);
router.put('/:examinationId/:subjectId', updateSubmission);

module.exports = router;
