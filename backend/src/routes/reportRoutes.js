const express = require('express');
const { protect, requireAnyAdmin } = require('../middleware/auth');
const {
  exportExamExcel,
  exportExamPdf,
  getOverallReport,
  exportOverallExcel,
  exportOverallPdf,
} = require('../controllers/reportController');

const router = express.Router();
router.use(protect, requireAnyAdmin);

router.get('/:examinationId/excel', exportExamExcel);
router.get('/:examinationId/pdf', exportExamPdf);

router.post('/overall', getOverallReport);
router.post('/overall/excel', exportOverallExcel);
router.post('/overall/pdf', exportOverallPdf);

module.exports = router;
