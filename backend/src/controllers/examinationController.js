const asyncHandler = require('express-async-handler');
const Examination = require('../models/Examination');
const Class = require('../models/Class');
const Submission = require('../models/Submission');
const { ok, created, fail } = require('../utils/apiResponse');
const { generateSecureToken } = require('../utils/tokens');
const { logAction } = require('../services/auditService');
const { AUDIT_ACTIONS, EXAM_STATUS } = require('../config/constants');

// GET /api/examinations?classId=&session=&status=
const listExaminations = asyncHandler(async (req, res) => {
  const { classId, session, status } = req.query;
  const filter = {};
  if (classId) filter.class = classId;
  if (session) filter.academicSession = session;
  if (status) filter.status = status;

  const exams = await Examination.find(filter).populate('class', 'name section').sort({ resultDate: -1, createdAt: -1 });

  // Attach submission progress for each exam
  const withProgress = await Promise.all(
    exams.map(async (exam) => {
      const submittedCount = await Submission.countDocuments({ examination: exam._id });
      return {
        ...exam.toObject(),
        submissionProgress: { submitted: submittedCount, total: exam.subjects.length },
      };
    })
  );

  return ok(res, withProgress);
});

// GET /api/examinations/:id
const getExamination = asyncHandler(async (req, res) => {
  const exam = await Examination.findById(req.params.id).populate('class', 'name section academicSession');
  if (!exam) return fail(res, 'Examination not found', 404);

  const submissions = await Submission.find({ examination: exam._id }).select(
    'subject subjectName teacherName totalLecturesDelivered submittedAt status'
  );

  return ok(res, { examination: exam, submissions });
});

// POST /api/examinations
const createExamination = asyncHandler(async (req, res) => {
  const { name, examType, class: classId, academicSession, resultDate, subjectIds } = req.body;

  const klass = await Class.findById(classId);
  if (!klass) return fail(res, 'Class not found', 404);

  let subjectsSnapshot = klass.subjects.filter((s) => s.isActive);
  if (Array.isArray(subjectIds) && subjectIds.length > 0) {
    subjectsSnapshot = subjectsSnapshot.filter((s) => subjectIds.includes(s._id.toString()));
  }
  if (subjectsSnapshot.length === 0) {
    return fail(res, 'Selected class has no active subjects to include', 400);
  }

  const exam = await Examination.create({
    name: name.trim(),
    examType: examType || 'Monthly Test',
    class: classId,
    academicSession: academicSession || klass.academicSession,
    resultDate,
    subjects: subjectsSnapshot.map((s) => ({
      subject: s._id,
      name: s.name,
      code: s.code,
      totalMarks: s.totalMarks,
      passingMarks: s.passingMarks,
    })),
    status: EXAM_STATUS.DRAFT,
    createdBy: req.user._id,
  });

  await logAction({
    user: req.user,
    action: AUDIT_ACTIONS.EXAM_CREATED,
    description: `Created examination "${exam.name}" for class "${klass.name}"`,
    metadata: { examinationId: exam._id },
    req,
  });

  return created(res, exam, 'Examination created');
});

// POST /api/examinations/:id/create-from-previous
const createFromPrevious = asyncHandler(async (req, res) => {
  const previous = await Examination.findById(req.params.id);
  if (!previous) return fail(res, 'Source examination not found', 404);

  const { name, resultDate, examType } = req.body;
  if (!name || !resultDate) return fail(res, 'New exam name and result date are required', 400);

  const exam = await Examination.create({
    name: name.trim(),
    examType: examType || previous.examType,
    class: previous.class,
    academicSession: previous.academicSession,
    resultDate,
    subjects: previous.subjects, // copies config only, never marks/attendance/submissions
    status: EXAM_STATUS.DRAFT,
    createdFrom: previous._id,
    createdBy: req.user._id,
  });

  await logAction({
    user: req.user,
    action: AUDIT_ACTIONS.EXAM_CREATED,
    description: `Created examination "${exam.name}" from previous exam "${previous.name}"`,
    metadata: { examinationId: exam._id, sourceExaminationId: previous._id },
    req,
  });

  return created(res, exam, 'Examination created from previous exam');
});

// PUT /api/examinations/:id
const updateExamination = asyncHandler(async (req, res) => {
  const exam = await Examination.findById(req.params.id);
  if (!exam) return fail(res, 'Examination not found', 404);
  if (exam.status === EXAM_STATUS.FINALIZED) {
    return fail(res, 'Cannot edit a finalized examination. Reopen it first.', 400);
  }

  const { name, resultDate, examType } = req.body;
  if (name) exam.name = name.trim();
  if (resultDate) exam.resultDate = resultDate;
  if (examType) exam.examType = examType;
  await exam.save();

  await logAction({
    user: req.user,
    action: AUDIT_ACTIONS.EXAM_EDITED,
    description: `Edited examination "${exam.name}"`,
    req,
  });

  return ok(res, exam, 'Examination updated');
});

// POST /api/examinations/:id/generate-link
const generateSubmissionLink = asyncHandler(async (req, res) => {
  const exam = await Examination.findById(req.params.id);
  if (!exam) return fail(res, 'Examination not found', 404);

  exam.submissionToken = generateSecureToken();
  exam.isLinkActive = true;
  exam.linkExpiresAt = req.body.expiresAt || null;
  if (exam.status === EXAM_STATUS.DRAFT) exam.status = EXAM_STATUS.SUBMISSION_OPEN;
  await exam.save();

  await logAction({
    user: req.user,
    action: AUDIT_ACTIONS.SUBMISSION_LINK_GENERATED,
    description: `Generated submission link for "${exam.name}"`,
    req,
  });

  const base = process.env.PUBLIC_SUBMIT_BASE_URL || 'http://localhost:5173/submit-result';
  return ok(res, { token: exam.submissionToken, url: `${base}/${exam.submissionToken}` }, 'Submission link generated');
});

// PUT /api/examinations/:id/disable-link
const disableSubmissionLink = asyncHandler(async (req, res) => {
  const exam = await Examination.findById(req.params.id);
  if (!exam) return fail(res, 'Examination not found', 404);

  exam.isLinkActive = false;
  await exam.save();

  await logAction({
    user: req.user,
    action: AUDIT_ACTIONS.SUBMISSION_LINK_DISABLED,
    description: `Disabled submission link for "${exam.name}"`,
    req,
  });

  return ok(res, exam, 'Submission link disabled');
});

// GET /api/examinations/:id/progress
const getSubmissionProgress = asyncHandler(async (req, res) => {
  const exam = await Examination.findById(req.params.id);
  if (!exam) return fail(res, 'Examination not found', 404);

  const submissions = await Submission.find({ examination: exam._id });
  const submittedSubjectIds = new Set(submissions.map((s) => s.subject.toString()));

  const progress = exam.subjects.map((s) => ({
    subject: s.subject,
    name: s.name,
    submitted: submittedSubjectIds.has(s.subject.toString()),
  }));

  return ok(res, {
    total: exam.subjects.length,
    submittedCount: submittedSubjectIds.size,
    subjects: progress,
    allSubmitted: submittedSubjectIds.size === exam.subjects.length,
  });
});

module.exports = {
  listExaminations,
  getExamination,
  createExamination,
  createFromPrevious,
  updateExamination,
  generateSubmissionLink,
  disableSubmissionLink,
  getSubmissionProgress,
};
