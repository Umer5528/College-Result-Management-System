const express = require('express');
const { protect, requireAnyAdmin, requireSuperAdmin } = require('../middleware/auth');
const { finalizeResult, reopenResult, deleteResult, getResult, setStudentDecision } = require('../controllers/resultController');

const router = express.Router();
router.use(protect, requireAnyAdmin);

router.get('/:examinationId', getResult);
router.post('/:examinationId/finalize', finalizeResult);
router.put('/:examinationId/reopen', requireSuperAdmin, reopenResult);
router.delete('/:examinationId', deleteResult);
router.put('/:examinationId/students/:studentId/decision', setStudentDecision);

module.exports = router;
