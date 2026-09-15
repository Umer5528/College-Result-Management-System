const asyncHandler = require('express-async-handler');
const Examination = require('../models/Examination');
const Student = require('../models/Student');
const Submission = require('../models/Submission');
const ExamResult = require('../models/ExamResult');
const { ok, fail } = require('../utils/apiResponse');
const { buildExamResult } = require('../services/calculationService');
const { logAction } = require('../services/auditService');
const { AUDIT_ACTIONS, EXAM_STATUS, ROLES } = require('../config/constants');

// Shared helper: recompute the result snapshot for an examination from current
// student roster + submissions. Used by both finalize and re-finalize (after
// an authorized reopen). Carries forward any existing Admin decisions so
// recalculation never silently resets a Pass/Fail call.
async function computeResultSnapshot(exam) {
  const students = await Student.find({ class: exam.class, isArchived: false });
  const submissions = await Submission.find({ examination: exam._id });
  const submissionsBySubject = new Map(submissions.map((s) => [s.subject.toString(), s]));

  const existing = await ExamResult.findOne({ examination: exam._id });
  const previousDecisionsByStudentId = new Map(
    (existing?.students || []).map((s) => [
      s.student.toString(),
      {
        overallDecision: s.overallDecision,
        decidedBy: s.decidedBy,
        decidedAt: s.decidedAt,
        decidedFailedSubjectsSnapshot: s.decidedFailedSubjectsSnapshot,
        decidedWasStruckOff: s.decidedWasStruckOff,
      },
    ])
  );

  return buildExamResult(students, exam.subjects, submissionsBySubject, previousDecisionsByStudentId);
}

// POST /api/results/:examinationId/finalize
const finalizeResult = asyncHandler(async (req, res) => {
  const exam = await Examination.findById(req.params.examinationId);
  if (!exam) return fail(res, 'Examination not found', 404);
  if (exam.status === EXAM_STATUS.FINALIZED) {
    return fail(res, 'Examination is already finalized', 400);
  }

  const submittedCount = await Submission.countDocuments({ examination: exam._id });
  if (submittedCount < exam.subjects.length) {
    return fail(
      res,
      `Cannot finalize: ${submittedCount}/${exam.subjects.length} subjects submitted. All subjects must be submitted first.`,
      400
    );
  }

  const { studentResults, stats } = await computeResultSnapshot(exam);

  const resultDoc = await ExamResult.findOneAndUpdate(
    { examination: exam._id },
    {
      examination: exam._id,
      students: studentResults,
      stats,
      finalizedBy: req.user._id,
      finalizedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  exam.status = EXAM_STATUS.FINALIZED;
  exam.finalizedAt = new Date();
  exam.finalizedBy = req.user._id;
  exam.isLinkActive = false;
  await exam.save();

  await logAction({
    user: req.user,
    action: AUDIT_ACTIONS.RESULT_FINALIZED,
    description: `Finalized result for examination "${exam.name}"`,
    metadata: { examinationId: exam._id },
    req,
  });

  return ok(res, resultDoc, 'Result finalized successfully');
});

// PUT /api/results/:examinationId/reopen  (Super Admin only, enforced at route level)
const reopenResult = asyncHandler(async (req, res) => {
  const exam = await Examination.findById(req.params.examinationId);
  if (!exam) return fail(res, 'Examination not found', 404);
  if (exam.status !== EXAM_STATUS.FINALIZED) {
    return fail(res, 'Only a finalized examination can be reopened', 400);
  }

  exam.status = EXAM_STATUS.READY_FOR_REVIEW;
  exam.finalizedAt = null;
  exam.finalizedBy = null;
  await exam.save();

  await logAction({
    user: req.user,
    action: AUDIT_ACTIONS.RESULT_REOPENED,
    description: `Reopened finalized result for examination "${exam.name}"`,
    metadata: { examinationId: exam._id },
    req,
  });

  return ok(res, exam, 'Result reopened. It can now be corrected and re-finalized.');
});

// DELETE /api/results/:examinationId
// Permanently deletes the finalized result snapshot ONLY. This is
// deliberately decoupled from the Examination's workflow status — the
// examination's `status` field tracks the submission/finalization
// WORKFLOW (has finalization happened), while the ExamResult document is
// just the data produced by that workflow. Deleting the data must never
// silently move the workflow backward; if the Admin wants to regenerate the
// result, they use the separate, deliberate Reopen action (Super Admin
// only) and then re-finalize. Underlying teacher submissions are untouched.
const deleteResult = asyncHandler(async (req, res) => {
  const exam = await Examination.findById(req.params.examinationId);
  if (!exam) return fail(res, 'Examination not found', 404);

  const deleted = await ExamResult.findOneAndDelete({ examination: exam._id });
  if (!deleted) {
    return fail(res, 'This examination has no finalized result to delete', 400);
  }

  await logAction({
    user: req.user,
    action: AUDIT_ACTIONS.RESULT_DELETED,
    description: `Deleted finalized result for examination "${exam.name}"`,
    metadata: { examinationId: exam._id },
    req,
  });

  return ok(res, exam, 'Finalized result deleted. The examination and its submissions are unaffected.');
});

// GET /api/results/:examinationId  - preview (pre- or post-finalization)
const getResult = asyncHandler(async (req, res) => {
  const exam = await Examination.findById(req.params.examinationId).populate('class', 'name section academicSession');
  if (!exam) return fail(res, 'Examination not found', 404);

  if (exam.status === EXAM_STATUS.FINALIZED) {
    const finalized = await ExamResult.findOne({ examination: exam._id });
    if (!finalized) {
      return ok(res, {
        examination: exam,
        result: null,
        isFinalized: true,
        message:
          'This examination was finalized, but its result data was deleted. A Super Admin can reopen the examination, then re-finalize to regenerate it.',
      });
    }
    return ok(res, { examination: exam, result: finalized, isFinalized: true });
  }

  // Live preview computed on the fly, not persisted
  const submittedCount = await Submission.countDocuments({ examination: exam._id });
  if (submittedCount < exam.subjects.length) {
    return ok(res, {
      examination: exam,
      result: null,
      isFinalized: false,
      message: `${submittedCount}/${exam.subjects.length} subjects submitted so far.`,
    });
  }

  const { studentResults, stats } = await computeResultSnapshot(exam);
  return ok(res, { examination: exam, result: { students: studentResults, stats }, isFinalized: false });
});

// PUT /api/results/:examinationId/students/:studentId/decision
// The Admin's explicit final call on one student's overall result. This is
// the ONLY thing that sets Pass/Fail overall — never automatic from subject
// failures. Requires the result to already be finalized (there's nothing to
// decide on a live preview).
const setStudentDecision = asyncHandler(async (req, res) => {
  const { examinationId, studentId } = req.params;
  const { decision } = req.body;

  if (!['pass', 'fail'].includes(decision)) {
    return fail(res, 'Decision must be "pass" or "fail"', 400);
  }

  const exam = await Examination.findById(examinationId);
  if (!exam) return fail(res, 'Examination not found', 404);
  if (exam.status !== EXAM_STATUS.FINALIZED) {
    return fail(res, 'This result must be finalized before an overall decision can be recorded', 400);
  }

  const resultDoc = await ExamResult.findOne({ examination: examinationId });
  if (!resultDoc) return fail(res, 'Finalized result not found', 404);

  const studentEntry = resultDoc.students.find((s) => s.student.toString() === studentId);
  if (!studentEntry) return fail(res, 'Student not found in this result', 404);

  studentEntry.overallDecision = decision;
  studentEntry.decidedBy = req.user._id;
  studentEntry.decidedAt = new Date();
  studentEntry.decidedFailedSubjectsSnapshot = studentEntry.failedSubjects;
  studentEntry.decidedWasStruckOff = !!studentEntry.struckOffInfo;
  studentEntry.needsReview = false;

  // Recompute the aggregate pass/fail/pending counts to reflect this change.
  const { computeExamStats } = require('../services/calculationService');
  resultDoc.stats = computeExamStats(resultDoc.students, exam.subjects);
  resultDoc.markModified('stats');

  await resultDoc.save();

  await logAction({
    user: req.user,
    action: AUDIT_ACTIONS.RESULT_FINALIZED,
    description: `Marked ${studentEntry.studentName} (Roll ${studentEntry.rollNumber}) overall ${decision.toUpperCase()} for "${exam.name}"`,
    metadata: { examinationId: exam._id, studentId, decision },
    req,
  });

  return ok(res, resultDoc, `${studentEntry.studentName} marked overall ${decision.toUpperCase()}`);
});

module.exports = { finalizeResult, reopenResult, deleteResult, getResult, setStudentDecision };
