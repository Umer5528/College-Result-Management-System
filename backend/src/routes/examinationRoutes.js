const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, requireAnyAdmin } = require('../middleware/auth');
const {
  listExaminations,
  getExamination,
  createExamination,
  createFromPrevious,
  updateExamination,
  generateSubmissionLink,
  disableSubmissionLink,
  getSubmissionProgress,
} = require('../controllers/examinationController');

const router = express.Router();
router.use(protect, requireAnyAdmin);

router.get('/', listExaminations);
router.get('/:id', getExamination);
router.get('/:id/progress', getSubmissionProgress);

router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Exam name is required'),
    body('class').notEmpty().withMessage('Class is required'),
    body('resultDate').notEmpty().withMessage('Result date is required'),
  ],
  validate,
  createExamination
);

router.post('/:id/create-from-previous', createFromPrevious);
router.put('/:id', updateExamination);
router.post('/:id/generate-link', generateSubmissionLink);
router.put('/:id/disable-link', disableSubmissionLink);

module.exports = router;
