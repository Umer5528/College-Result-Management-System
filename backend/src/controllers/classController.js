const asyncHandler = require('express-async-handler');
const Class = require('../models/Class');
const Student = require('../models/Student');
const { ok, created, fail } = require('../utils/apiResponse');
const { logAction } = require('../services/auditService');
const { AUDIT_ACTIONS } = require('../config/constants');

// GET /api/classes
const listClasses = asyncHandler(async (req, res) => {
  const { session, includeArchived } = req.query;
  const filter = {};
  if (session) filter.academicSession = session;
  if (!includeArchived) filter.isArchived = false;

  const classes = await Class.find(filter).sort({ createdAt: -1 });
  const withCounts = await Promise.all(
    classes.map(async (c) => {
      const studentCount = await Student.countDocuments({ class: c._id, isArchived: false });
      return { ...c.toObject(), studentCount };
    })
  );
  return ok(res, withCounts);
});

// GET /api/classes/:id
const getClass = asyncHandler(async (req, res) => {
  const klass = await Class.findById(req.params.id);
  if (!klass) return fail(res, 'Class not found', 404);
  return ok(res, klass);
});

const GlobalSubject = require('../models/GlobalSubject');
const { resolveGlobalSubject } = require('../services/globalSubjectService');

// POST /api/classes
const createClass = asyncHandler(async (req, res) => {
  const { name, academicSession, description, subjects } = req.body;

  if (!Array.isArray(subjects) || subjects.length === 0) {
    return fail(res, 'At least one subject is required', 400);
  }

  const resolvedSubjects = [];
  for (const s of subjects) {
    if (Number(s.passingMarks) > Number(s.totalMarks)) {
      return fail(res, `Passing marks cannot exceed total marks for subject "${s.name}"`, 400);
    }
    let globalSubject;
    if (s.globalSubjectId) {
      globalSubject = await GlobalSubject.findById(s.globalSubjectId);
    }
    if (!globalSubject) {
      globalSubject = await resolveGlobalSubject({
        name: s.name,
        code: s.code,
        totalMarks: s.totalMarks,
        passingMarks: s.passingMarks,
        userId: req.user._id,
      });
    }

    const inheritsGlobal =
      s.inheritsGlobalConfig !== undefined
        ? Boolean(s.inheritsGlobalConfig)
        : Number(s.totalMarks) === Number(globalSubject.totalMarks) &&
          Number(s.passingMarks) === Number(globalSubject.passingMarks);

    resolvedSubjects.push({
      globalSubjectId: globalSubject._id,
      globalSubject: globalSubject._id,
      inheritsGlobalConfig: inheritsGlobal,
      name: s.name.trim(),
      code: (s.code || '').trim(),
      totalMarks: Number(s.totalMarks),
      passingMarks: Number(s.passingMarks),
      isActive: s.isActive !== undefined ? Boolean(s.isActive) : true,
    });
  }

  const klass = await Class.create({
    name: name.trim(),
    section: (req.body.section || '').trim(),
    academicSession: academicSession.trim(),
    description: description || '',
    subjects: resolvedSubjects,
    createdBy: req.user._id,
  });

  await logAction({
    user: req.user,
    action: AUDIT_ACTIONS.CLASS_CREATED,
    description: `Created class "${klass.name}" (${klass.academicSession})`,
    metadata: { classId: klass._id },
    req,
  });

  return created(res, klass, 'Class created');
});

// PUT /api/classes/:id
const updateClass = asyncHandler(async (req, res) => {
  const klass = await Class.findById(req.params.id);
  if (!klass) return fail(res, 'Class not found', 404);

  const { name, academicSession, description } = req.body;
  if (name) klass.name = name.trim();
  if (req.body.section !== undefined) klass.section = req.body.section.trim();
  if (academicSession) klass.academicSession = academicSession.trim();
  if (description !== undefined) klass.description = description;

  await klass.save();

  await logAction({
    user: req.user,
    action: AUDIT_ACTIONS.CLASS_EDITED,
    description: `Edited class "${klass.name}"`,
    metadata: { classId: klass._id },
    req,
  });

  return ok(res, klass, 'Class updated');
});

// POST /api/classes/:id/subjects
const addSubject = asyncHandler(async (req, res) => {
  const klass = await Class.findById(req.params.id);
  if (!klass) return fail(res, 'Class not found', 404);

  const { name, code, totalMarks, passingMarks, globalSubjectId, inheritsGlobalConfig } = req.body;
  if (Number(passingMarks) > Number(totalMarks)) {
    return fail(res, 'Passing marks cannot exceed total marks', 400);
  }

  let globalSubject;
  if (globalSubjectId) {
    globalSubject = await GlobalSubject.findById(globalSubjectId);
  }
  if (!globalSubject) {
    globalSubject = await resolveGlobalSubject({
      name,
      code,
      totalMarks,
      passingMarks,
      userId: req.user._id,
    });
  }

  const inheritsGlobal =
    inheritsGlobalConfig !== undefined
      ? Boolean(inheritsGlobalConfig)
      : Number(totalMarks) === Number(globalSubject.totalMarks) &&
        Number(passingMarks) === Number(globalSubject.passingMarks);

  klass.subjects.push({
    globalSubjectId: globalSubject._id,
    globalSubject: globalSubject._id,
    inheritsGlobalConfig: inheritsGlobal,
    name: name.trim(),
    code: (code || '').trim(),
    totalMarks: Number(totalMarks),
    passingMarks: Number(passingMarks),
    isActive: true,
  });
  await klass.save();

  await logAction({
    user: req.user,
    action: AUDIT_ACTIONS.SUBJECT_ADDED,
    description: `Added subject "${name}" to class "${klass.name}"`,
    metadata: { classId: klass._id, globalSubjectId: globalSubject._id, inheritsGlobalConfig: inheritsGlobal },
    req,
  });

  return created(res, klass, 'Subject added');
});

// PUT /api/classes/:id/subjects/:subjectId
const updateSubject = asyncHandler(async (req, res) => {
  const klass = await Class.findById(req.params.id);
  if (!klass) return fail(res, 'Class not found', 404);

  const subject = klass.subjects.id(req.params.subjectId);
  if (!subject) return fail(res, 'Subject not found', 404);

  const { name, code, totalMarks, passingMarks, isActive, inheritsGlobalConfig, globalSubjectId } = req.body;

  if (globalSubjectId && globalSubjectId !== subject.globalSubjectId?.toString()) {
    subject.globalSubjectId = globalSubjectId;
    subject.globalSubject = globalSubjectId;
  }

  // Ensure subject has a global subject link if missing
  if (!subject.globalSubjectId) {
    const gs = await resolveGlobalSubject({
      name: name || subject.name,
      code: code || subject.code,
      totalMarks: totalMarks || subject.totalMarks,
      passingMarks: passingMarks || subject.passingMarks,
      userId: req.user._id,
    });
    subject.globalSubjectId = gs._id;
    subject.globalSubject = gs._id;
  }

  const linkedGlobal = await GlobalSubject.findById(subject.globalSubjectId);

  if (inheritsGlobalConfig === true && linkedGlobal) {
    // Explicitly restore global inheritance!
    subject.inheritsGlobalConfig = true;
    subject.totalMarks = linkedGlobal.totalMarks;
    subject.passingMarks = linkedGlobal.passingMarks;
    if (linkedGlobal.code) subject.code = linkedGlobal.code;
  } else if (inheritsGlobalConfig === false) {
    subject.inheritsGlobalConfig = false;
  }

  if (name !== undefined) subject.name = name.trim();
  if (code !== undefined) subject.code = code.trim();
  if (totalMarks !== undefined) subject.totalMarks = Number(totalMarks);
  if (passingMarks !== undefined) subject.passingMarks = Number(passingMarks);
  if (isActive !== undefined) subject.isActive = isActive;

  if (subject.passingMarks > subject.totalMarks) {
    return fail(res, 'Passing marks cannot exceed total marks', 400);
  }

  // Detect override if marks differ from linked global subject
  if (linkedGlobal && (totalMarks !== undefined || passingMarks !== undefined)) {
    const differs =
      Number(subject.totalMarks) !== Number(linkedGlobal.totalMarks) ||
      Number(subject.passingMarks) !== Number(linkedGlobal.passingMarks);

    if (differs && subject.inheritsGlobalConfig) {
      subject.inheritsGlobalConfig = false;
      await logAction({
        user: req.user,
        action: AUDIT_ACTIONS.SUBJECT_OVERRIDE_CHANGED,
        description: `Created class override for subject "${subject.name}" in "${klass.name}" (${subject.totalMarks}/${subject.passingMarks} vs global ${linkedGlobal.totalMarks}/${linkedGlobal.passingMarks})`,
        metadata: { classId: klass._id, subjectId: subject._id, globalSubjectId: linkedGlobal._id },
        req,
      });
    }
  }

  await klass.save();
  return ok(res, klass, 'Subject updated');
});

// PUT /api/classes/:id/archive
const archiveClass = asyncHandler(async (req, res) => {
  const klass = await Class.findById(req.params.id);
  if (!klass) return fail(res, 'Class not found', 404);
  klass.isArchived = true;
  await klass.save();
  return ok(res, klass, 'Class archived');
});

// GET /api/classes/:id/students (convenience)
const getClassStudents = asyncHandler(async (req, res) => {
  const students = await Student.find({ class: req.params.id, isArchived: false }).sort({
    rollNumber: 1,
  });
  return ok(res, students);
});

// DELETE /api/classes/:id
// Permanently removes the class and cascades: all its students, all its
// examinations, and every submission/finalized result tied to those
// examinations. This is destructive and cannot be undone, so the frontend
// must get explicit confirmation before calling this.
const deleteClass = asyncHandler(async (req, res) => {
  const klass = await Class.findById(req.params.id);
  if (!klass) return fail(res, 'Class not found', 404);

  const Examination = require('../models/Examination');
  const Submission = require('../models/Submission');
  const ExamResult = require('../models/ExamResult');

  const examinations = await Examination.find({ class: klass._id });
  const examIds = examinations.map((e) => e._id);

  await Submission.deleteMany({ examination: { $in: examIds } });
  await ExamResult.deleteMany({ examination: { $in: examIds } });
  await Examination.deleteMany({ class: klass._id });
  const { deletedCount: studentsDeleted } = await Student.deleteMany({ class: klass._id });
  await Class.deleteOne({ _id: klass._id });

  await logAction({
    user: req.user,
    action: AUDIT_ACTIONS.CLASS_DELETED,
    description: `Deleted class "${klass.name}" and cascaded ${studentsDeleted} student(s), ${examinations.length} examination(s)`,
    metadata: { classId: klass._id, studentsDeleted, examinationsDeleted: examinations.length },
    req,
  });

  return ok(res, null, `"${klass.name}" and all its students and examinations were deleted`);
});

module.exports = {
  listClasses,
  getClass,
  createClass,
  updateClass,
  addSubject,
  updateSubject,
  archiveClass,
  deleteClass,
  getClassStudents,
};
