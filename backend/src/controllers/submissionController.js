const asyncHandler = require('express-async-handler');
const Examination = require('../models/Examination');
const Submission = require('../models/Submission');
const Student = require('../models/Student');
const { ok, fail } = require('../utils/apiResponse');
const { parseStudentEntry } = require('../services/entryValidationService');
const { logAction } = require('../services/auditService');
const { AUDIT_ACTIONS, STUDENT_STATUS, EXAM_STATUS } = require('../config/constants');

// GET /api/submissions/:examinationId/:subjectId
// Full entry-level detail so the Admin can see exactly what a teacher
// submitted and correct a genuine mistake on the spot.
const getSubmission = asyncHandler(async (req, res) => {
  const { examinationId, subjectId } = req.params;
  const submission = await Submission.findOne({ examination: examinationId, subject: subjectId });
  if (!submission) return fail(res, 'No submission found for this subject yet', 404);
  return ok(res, submission);
});

// PUT /api/submissions/:examinationId/:subjectId
// Admin correction of an already-submitted subject's entries. Requires the
// examination to not be finalized (Super Admin must reopen it first) so a
// correction always flows through the same "reopen -> fix -> re-finalize"
// path as any other post-finalization change.
const updateSubmission = asyncHandler(async (req, res) => {
  const { examinationId, subjectId } = req.params;

  const exam = await Examination.findById(examinationId);
  if (!exam) return fail(res, 'Examination not found', 404);
  if (exam.status === EXAM_STATUS.FINALIZED) {
    return fail(res, 'This result is finalized. Reopen it first before editing a submission.', 400);
  }

  const subjectConfig = exam.subjects.find((s) => s.subject.toString() === subjectId);
  if (!subjectConfig) return fail(res, 'This subject does not belong to this examination', 404);

  const submission = await Submission.findOne({ examination: examinationId, subject: subjectId });
  if (!submission) return fail(res, 'No submission found for this subject yet', 404);

  const { teacherName, totalLecturesDelivered, entries } = req.body;
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
    if (!student) continue;

    const strikeOff = student.getActiveStrikeOff();
    if (strikeOff) {
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

  submission.teacherName = teacherName?.trim() || submission.teacherName;
  submission.totalLecturesDelivered = totalLectures;
  submission.entries = builtEntries;
  await submission.save();

  await logAction({
    user: req.user,
    action: AUDIT_ACTIONS.SUBMISSION_EDITED,
    description: `Admin corrected the "${subjectConfig.name}" submission for examination "${exam.name}"`,
    metadata: { examinationId: exam._id, subjectId },
    req,
  });

  return ok(res, submission, `${subjectConfig.name} submission updated`);
});

module.exports = { getSubmission, updateSubmission };
