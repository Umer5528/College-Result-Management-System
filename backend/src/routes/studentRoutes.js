const express = require('express');
const multer = require('multer');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, requireAnyAdmin } = require('../middleware/auth');
const {
  listStudents,
  quickSearch,
  getStudent,
  createStudent,
  updateStudent,
  strikeOffStudent,
  restoreStudent,
  archiveStudent,
  deleteStudent,
  getStudentHistory,
  bulkImportStudents,
  bulkImportStudentsText,
  bulkImportTextPreview,
  exportStudents,
} = require('../controllers/studentController');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const router = express.Router();
router.use(protect, requireAnyAdmin);

router.get('/', listStudents);
router.get('/search', quickSearch);
router.get('/export', exportStudents);
router.get('/:id', getStudent);
router.get('/:id/history', getStudentHistory);

router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('rollNumber').trim().notEmpty().withMessage('Roll number is required'),
    body('class').notEmpty().withMessage('Class is required'),
    body('academicSession').trim().notEmpty().withMessage('Academic session is required'),
  ],
  validate,
  createStudent
);

router.post('/bulk-import', upload.single('file'), bulkImportStudents);
router.post('/bulk-import-text/preview', bulkImportTextPreview);
router.post('/bulk-import-text', bulkImportStudentsText);

router.put('/:id', updateStudent);
router.put('/:id/strike-off', strikeOffStudent);
router.put('/:id/restore', restoreStudent);
router.put('/:id/archive', archiveStudent);
router.delete('/:id', deleteStudent);

module.exports = router;
