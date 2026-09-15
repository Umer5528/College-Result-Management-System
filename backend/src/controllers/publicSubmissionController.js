const asyncHandler = require('express-async-handler');
const Examination = require('../models/Examination');
const Student = require('../models/Student');
const Submission = require('../models/Submission');
const CollegeSettings = require('../models/CollegeSettings');
const { ok, fail } = require('../utils/apiResponse');
const { parseStudentEntry } = require('../services/entryValidationService');
const { logAction } = require('../services/auditService');
const { AUDIT_ACTIONS, STUDENT_STATUS, EXAM_STATUS } = require('../config/constants');

// Shared guard: resolves an active, non-expired examination by its public
// token. Never leaks the internal examination ObjectId-based lookup path.
async function resolveExamByToken(token) {
  const exam = await Examination.findOne({ submissionToken: token });
  if (!exam) return { error: 'This submission link is invalid.' };
  if (!exam.isLinkActive) return { error: 'This submission link has been disabled by the Admin.' };
  if (exam.linkExpiresAt && new Date() > new Date(exam.linkExpiresAt)) {
    return { error: 'This submission link has expired.' };
  }
  if (exam.status === EXAM_STATUS.FINALIZED || exam.status === EXAM_STATUS.ARCHIVED) {
    return { error: 'This examination has already been finalized. Results can no longer be submitted.' };
  }
  return { exam };
}

// GET /api/public/submit/:token
// Returns examination info + subject list (without exposing internal ids
// beyond what's needed) so the teacher can pick their subject.
const getExamInfo = asyncHandler(async (req, res) => {
  const { exam, error } = await resolveExamByToken(req.params.token);
  if (error) return fail(res, error, 404);

  const [settings, submissions] = await Promise.all([
    CollegeSettings.findOne(),
    Submission.find({ examination: exam._id }).select('subject'),
  ]);
  const submittedSubjectIds = new Set(submissions.map((s) => s.subject.toString()));

  const klass = await exam.populate('class', 'name section');

  return ok(res, {
    collegeName: settings?.collegeName || '',
    logoUrl: settings?.logoUrl || '',
    examinationName: exam.name,
    examType: exam.examType,
    className: klass.class.name,
    classSection: klass.class.section || '',
    resultDate: exam.resultDate,
    subjects: exam.subjects.map((s) => ({
      subjectId: s.subject,
      name: s.name,
      totalMarks: s.totalMarks,
      passingMarks: s.passingMarks,
      alreadySubmitted: submittedSubjectIds.has(s.subject.toString()),
    })),
  });
});

// GET /api/public/submit/:token/subject/:subjectId
// Returns the student roster (active + struck-off) for entering marks.
const getSubjectRoster = asyncHandler(async (req, res) => {
  const { exam, error } = await resolveExamByToken(req.params.token);
  if (error) return fail(res, error, 404);

  const subjectConfig = exam.subjects.find((s) => s.subject.toString() === req.params.subjectId);
  if (!subjectConfig) return fail(res, 'This subject does not belong to this examination.', 404);

  const alreadySubmitted = await Submission.findOne({ examination: exam._id, subject: subjectConfig.subject });
  if (alreadySubmitted) {
    return fail(res, `${subjectConfig.name} has already been submitted for this examination.`, 409);
  }

  const students = await Student.find({ class: exam.class, isArchived: false }).sort({ rollNumber: 1 });

  return ok(res, {
    subject: { subjectId: subjectConfig.subject, name: subjectConfig.name, totalMarks: subjectConfig.totalMarks },
    students: students.map((s) => {
      const strikeOff = s.getActiveStrikeOff();
      return {
        studentId: s._id,
        rollNumber: s.rollNumber,
        name: s.name,
        // Strike-off is GLOBAL: a struck-off student is locked in every
        // subject, regardless of which subject (if any) the strike-off cited.
        status: strikeOff ? 'struck_off' : 'active',
        struckOffSubjectName: strikeOff ? strikeOff.subjectName : null,
        struckOffReason: strikeOff ? strikeOff.reason : '',
      };
    }),
  });
});

// POST /api/public/submit/:token/subject/:subjectId
const submitSubjectResult = asyncHandler(async (req, res) => {
  const { exam, error } = await resolveExamByToken(req.params.token);
  if (error) return fail(res, error, 404);

  const subjectConfig = exam.subjects.find((s) => s.subject.toString() === req.params.subjectId);
  if (!subjectConfig) return fail(res, 'This subject does not belong to this examination.', 404);

  const existing = await Submission.findOne({ examination: exam._id, subject: subjectConfig.subject });
  if (existing) {
    return fail(res, `${subjectConfig.name} has already been submitted for this examination.`, 409);
  }

  const { teacherName, totalLecturesDelivered, entries } = req.body;

  if (!teacherName || !teacherName.trim()) return fail(res, 'Teacher name is required', 400);
  const totalLectures = Number(totalLecturesDelivered);
  if (!Number.isFinite(totalLectures) || totalLectures <= 0) {
    return fail(res, 'Total lectures delivered must be a positive number', 400);
  }
  if (!Array.isArray(entries) || entries.length === 0) {
    return fail(res, 'At least one student entry is required', 400);
  }

  const students = await Student.find({ class: exam.class, isArchived: false });
  const studentMap = new Map(students.map((s) => [s._id.toString(), s]));

  const builtEntries = [];
  for (const e of entries) {
    const student = studentMap.get(e.studentId);
    if (!student) continue; // ignore unknown/stale ids rather than fail the whole batch

    const strikeOff = student.getActiveStrikeOff();
    if (strikeOff) {
      // Struck off GLOBALLY: preserved in the record as visible history, but
      // never accepts marks/attendance for ANY subject regardless of what
      // the client sent.
      builtEntries.push({
        student: student._id,
        rollNumber: student.rollNumber,
        studentName: student.name,
        statusAtSubmission: STUDENT_STATUS.STRUCK_OFF,
        struckOffReason: strikeOff.reason,
        struckOffSubjectName: strikeOff.subjectName,
        classesAttended: null,
        attendancePercentage: null,
        obtainedMarks: null,
        isAbsent: false,
      });
      continue;
    }

    const parsed = parseStudentEntry(
      { classesAttended: e.classesAttended, obtainedMarks: e.obtainedMarks },
      { totalLectures, totalMarks: subjectConfig.totalMarks, studentLabel: student.name }
    );
    if (parsed.error) return fail(res, parsed.error, 400);

    builtEntries.push({
      student: student._id,
      rollNumber: student.rollNumber,
      studentName: student.name,
      statusAtSubmission: STUDENT_STATUS.ACTIVE,
      classesAttended: parsed.classesAttended,
      attendancePercentage: parsed.attendancePercentage,
      obtainedMarks: parsed.obtainedMarks,
      isAbsent: parsed.isAbsent,
    });
  }

  const submission = await Submission.create({
    examination: exam._id,
    subject: subjectConfig.subject,
    subjectName: subjectConfig.name,
    teacherName: teacherName.trim(),
    totalLecturesDelivered: totalLectures,
    entries: builtEntries,
    ipAddress: req.ip,
  });

  if (exam.status === EXAM_STATUS.SUBMISSION_OPEN) {
    exam.status = EXAM_STATUS.SUBMISSION_IN_PROGRESS;
  }
  const allSubmittedCount = await Submission.countDocuments({ examination: exam._id });
  if (allSubmittedCount === exam.subjects.length) {
    exam.status = EXAM_STATUS.READY_FOR_REVIEW;
  }
  await exam.save();

  await logAction({
    userLabel: teacherName.trim(),
    action: AUDIT_ACTIONS.RESULT_SUBMITTED,
    description: `${teacherName.trim()} submitted ${subjectConfig.name} result for "${exam.name}"`,
    metadata: { examinationId: exam._id, subjectId: subjectConfig.subject },
    req,
  });

  return ok(res, { submissionId: submission._id }, `${subjectConfig.name} result submitted successfully.`);
});

module.exports = { getExamInfo, getSubjectRoster, submitSubjectResult };
