const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { protect, requireAnyAdmin } = require('../middleware/auth');
const {
  listClasses,
  getClass,
  createClass,
  updateClass,
  addSubject,
  updateSubject,
  archiveClass,
  deleteClass,
  getClassStudents,
} = require('../controllers/classController');

const router = express.Router();
router.use(protect, requireAnyAdmin);

router.get('/', listClasses);
router.get('/:id', getClass);
router.get('/:id/students', getClassStudents);

router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Class name is required'),
    body('academicSession').trim().notEmpty().withMessage('Academic session is required'),
    body('subjects').isArray({ min: 1 }).withMessage('At least one subject is required'),
  ],
  validate,
  createClass
);

router.put('/:id', updateClass);
router.put('/:id/archive', archiveClass);
router.delete('/:id', deleteClass);

router.post(
  '/:id/subjects',
  [
    body('name').trim().notEmpty(),
    body('totalMarks').isFloat({ min: 1 }),
    body('passingMarks').isFloat({ min: 0 }),
  ],
  validate,
  addSubject
);

router.put('/:id/subjects/:subjectId', updateSubject);

module.exports = router;
