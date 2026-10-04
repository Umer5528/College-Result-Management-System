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

// DELETE /api/examinations/:id
// Permanently and completely removes the examination — unlike deleteResult
// (which only removes the finalized snapshot), this makes the exam itself
// vanish: its teacher submissions and any finalized ExamResult are cascaded
// away too. Does NOT touch the class, subjects, or students. Irreversible —
// the frontend must get strong explicit confirmation before calling this.
const deleteExamination = asyncHandler(async (req, res) => {
  const exam = await Examination.findById(req.params.id);
  if (!exam) return fail(res, 'Examination not found', 404);

  const ExamResult = require('../models/ExamResult');

  const [{ deletedCount: submissionsDeleted }] = await Promise.all([
    Submission.deleteMany({ examination: exam._id }),
  ]);
  await ExamResult.deleteOne({ examination: exam._id });

  const examName = exam.name;
  await Examination.deleteOne({ _id: exam._id });

  await logAction({
    user: req.user,
    action: AUDIT_ACTIONS.EXAM_DELETED,
    description: `Permanently deleted examination "${examName}" (${submissionsDeleted} submission(s) removed with it)`,
    metadata: { examinationId: exam._id, examName, submissionsDeleted },
    req,
  });

  return ok(res, null, `"${examName}" has been permanently deleted`);
});

// POST /api/examinations/bulk-preview
const bulkPreviewExaminations = asyncHandler(async (req, res) => {
  const { name, examType, classIds, academicSession, resultDate } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return fail(res, 'Exam name is required', 400);
  }
  if (!Array.isArray(classIds) || classIds.length === 0) {
    return fail(res, 'At least one class must be selected', 400);
  }
  if (!resultDate) {
    return fail(res, 'Result date is required', 400);
  }

  const classes = await Class.find({ _id: { $in: classIds } });
  if (classes.length === 0) {
    return fail(res, 'No valid classes found', 404);
  }

  const willCreate = [];
  const alreadyExists = [];
  const invalidClasses = [];

  for (const klass of classes) {
    const session = academicSession?.trim() || klass.academicSession;
    const existing = await Examination.findOne({
      class: klass._id,
      academicSession: session,
      name: name.trim(),
    });

    if (existing) {
      alreadyExists.push({
        classId: klass._id,
        className: klass.name,
        section: klass.section,
        academicSession: session,
        existingExamId: existing._id,
        status: existing.status,
      });
      continue;
    }

    const activeSubjects = (klass.subjects || []).filter((s) => s.isActive);
    if (activeSubjects.length === 0) {
      invalidClasses.push({
        classId: klass._id,
        className: klass.name,
        section: klass.section,
        reason: 'Class has no active subjects configured',
      });
      continue;
    }

    willCreate.push({
      classId: klass._id,
      className: klass.name,
      section: klass.section,
      academicSession: session,
      subjects: activeSubjects.map((s) => ({
        subjectId: s._id,
        name: s.name,
        code: s.code || '',
        totalMarks: s.totalMarks,
        passingMarks: s.passingMarks,
        inheritsGlobalConfig: s.inheritsGlobalConfig !== false,
      })),
    });
  }

  return ok(res, {
    canProceed: willCreate.length > 0,
    willCreate,
    alreadyExists,
    invalidClasses,
    summary: {
      totalRequested: classIds.length,
      willCreateCount: willCreate.length,
      alreadyExistsCount: alreadyExists.length,
      invalidCount: invalidClasses.length,
    },
  });
});

// POST /api/examinations/bulk
const bulkCreateExaminations = asyncHandler(async (req, res) => {
  const { name, examType, classIds, academicSession, resultDate, skipExisting = false, generateLinks = false } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return fail(res, 'Exam name is required', 400);
  }
  if (!Array.isArray(classIds) || classIds.length === 0) {
    return fail(res, 'At least one class must be selected', 400);
  }
  if (!resultDate) {
    return fail(res, 'Result date is required', 400);
  }

  const classes = await Class.find({ _id: { $in: classIds } });
  if (classes.length === 0) {
    return fail(res, 'No valid classes found', 404);
  }

  const duplicates = [];
  const eligible = [];
  const invalid = [];

  for (const klass of classes) {
    const session = academicSession?.trim() || klass.academicSession;
    const existing = await Examination.findOne({
      class: klass._id,
      academicSession: session,
      name: name.trim(),
    });

    if (existing) {
      duplicates.push({
        classId: klass._id,
        className: klass.name,
        section: klass.section,
        existingExamId: existing._id,
      });
    } else {
      const activeSubjects = (klass.subjects || []).filter((s) => s.isActive);
      if (activeSubjects.length === 0) {
        invalid.push({
          classId: klass._id,
          className: klass.name,
          section: klass.section,
          reason: 'No active subjects',
        });
      } else {
        eligible.push({ klass, session, activeSubjects });
      }
    }
  }

  // Duplicate protection: if duplicates exist and admin didn't explicitly choose skipExisting
  if (duplicates.length > 0 && !skipExisting) {
    return fail(
      res,
      `Examination "${name.trim()}" already exists for ${duplicates.length} of the selected classes.`,
      409,
      {
        alreadyExists: duplicates,
        willCreateCount: eligible.length,
      }
    );
  }

  if (eligible.length === 0) {
    return fail(res, 'No new examinations to create (all selected classes either already exist or have no subjects)', 400, {
      alreadyExists: duplicates,
      invalid,
    });
  }

  // Create examinations inside a transaction
  const mongoose = require('mongoose');
  const mongoSession = await mongoose.startSession();
  const createdExams = [];

  try {
    await mongoSession.withTransaction(async () => {
      for (const { klass, session: sess, activeSubjects } of eligible) {
        const token = generateSecureToken();
        const exam = new Examination({
          name: name.trim(),
          examType: examType || 'Monthly Test',
          class: klass._id,
          academicSession: sess,
          resultDate,
          subjects: activeSubjects.map((s) => ({
            subject: s._id,
            name: s.name,
            code: s.code || '',
            totalMarks: s.totalMarks,
            passingMarks: s.passingMarks,
          })),
          status: generateLinks ? EXAM_STATUS.SUBMISSION_OPEN : EXAM_STATUS.DRAFT,
          submissionToken: token,
          isLinkActive: Boolean(generateLinks),
          createdBy: req.user._id,
        });

        await exam.save({ session: mongoSession });

        await logAction({
          user: req.user,
          action: AUDIT_ACTIONS.EXAM_CREATED,
          description: `Created examination "${exam.name}" for class "${klass.name}" via bulk creation`,
          metadata: { examinationId: exam._id, bulk: true },
          req,
        });

        createdExams.push({
          _id: exam._id,
          name: exam.name,
          className: klass.name,
          section: klass.section,
          submissionToken: exam.submissionToken,
          subjectsCount: exam.subjects.length,
          status: exam.status,
        });
      }

      await logAction({
        user: req.user,
        action: AUDIT_ACTIONS.BULK_EXAM_CREATED,
        description: `Bulk created ${createdExams.length} examination(s) for "${name.trim()}"`,
        metadata: {
          examName: name.trim(),
          createdCount: createdExams.length,
          skippedDuplicatesCount: duplicates.length,
          createdExamIds: createdExams.map((e) => e._id),
          skippedDuplicates: duplicates,
        },
        req,
      });
    });
  } finally {
    await mongoSession.endSession();
  }

  return created(
    res,
    {
      createdExaminations: createdExams,
      skippedDuplicates: duplicates,
      summary: {
        totalRequested: classIds.length,
        createdCount: createdExams.length,
        skippedCount: duplicates.length,
      },
    },
    `Successfully created ${createdExams.length} examination(s)${duplicates.length > 0 ? ` (${duplicates.length} duplicate(s) skipped)` : ''}`
  );
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
  deleteExamination,
  bulkPreviewExaminations,
  bulkCreateExaminations,
};
