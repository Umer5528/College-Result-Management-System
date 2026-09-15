const asyncHandler = require('express-async-handler');
const ExcelJS = require('exceljs');
const Student = require('../models/Student');
const Class = require('../models/Class');
const { ok, created, fail } = require('../utils/apiResponse');
const { logAction } = require('../services/auditService');
const { AUDIT_ACTIONS, STUDENT_STATUS } = require('../config/constants');
const { parseTextImport, matchField } = require('../services/textImportParser');

// GET /api/students?search=&classId=&status=&page=&limit=
const listStudents = asyncHandler(async (req, res) => {
  const { search, classId, status, page = 1, limit = 25 } = req.query;
  const filter = { isArchived: false };
  if (classId) filter.class = classId;
  if (status) filter.status = status;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { rollNumber: { $regex: search, $options: 'i' } },
      { registrationNumber: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [students, total] = await Promise.all([
    Student.find(filter).populate('class', 'name section academicSession').sort({ rollNumber: 1 }).skip(skip).limit(Number(limit)),
    Student.countDocuments(filter),
  ]);

  return ok(res, { students, total, page: Number(page), limit: Number(limit) });
});

// GET /api/students/search?q=
const quickSearch = asyncHandler(async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return ok(res, []);

  const students = await Student.find({
    isArchived: false,
    $or: [{ name: { $regex: q, $options: 'i' } }, { rollNumber: { $regex: q, $options: 'i' } }],
  })
    .populate('class', 'name')
    .limit(15);

  return ok(res, students);
});

// GET /api/students/:id
const getStudent = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id).populate('class', 'name section academicSession subjects');
  if (!student) return fail(res, 'Student not found', 404);
  return ok(res, student);
});

// POST /api/students
const createStudent = asyncHandler(async (req, res) => {
  const {
    name,
    fatherName,
    fatherContact,
    rollNumber,
    registrationNumber,
    admissionNumber,
    class: classId,
    academicSession,
    gender,
    admissionDate,
  } = req.body;

  const klass = await Class.findById(classId);
  if (!klass) return fail(res, 'Class not found', 404);

  const dup = await Student.findOne({ rollNumber, class: classId, academicSession, isArchived: false });
  if (dup) return fail(res, `Roll number ${rollNumber} already exists in this class/session`, 409);

  const student = await Student.create({
    name,
    fatherName,
    fatherContact,
    rollNumber,
    registrationNumber,
    admissionNumber,
    class: classId,
    academicSession,
    gender,
    admissionDate,
    createdBy: req.user._id,
  });

  await logAction({
    user: req.user,
    action: AUDIT_ACTIONS.STUDENT_CREATED,
    description: `Registered student ${student.name} (Roll ${student.rollNumber})`,
    metadata: { studentId: student._id },
    req,
  });

  return created(res, student, 'Student registered');
});

// PUT /api/students/:id
const updateStudent = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) return fail(res, 'Student not found', 404);

  const editable = ['name', 'fatherName', 'fatherContact', 'rollNumber', 'registrationNumber', 'admissionNumber', 'gender', 'admissionDate'];
  editable.forEach((f) => {
    if (req.body[f] !== undefined) student[f] = req.body[f];
  });

  await student.save();

  await logAction({
    user: req.user,
    action: AUDIT_ACTIONS.STUDENT_EDITED,
    description: `Edited student ${student.name} (Roll ${student.rollNumber})`,
    metadata: { studentId: student._id },
    req,
  });

  return ok(res, student, 'Student updated');
});

// PUT /api/students/:id/strike-off
// Requires at least ONE of subjectId or a non-empty reason (backend enforces
// this independently of the frontend). Strike-off is GLOBAL: regardless of
// whether a subject was cited, an active record locks the student out of
// marks/attendance entry in every subject of their class.
const strikeOffStudent = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id).populate('class', 'subjects');
  if (!student) return fail(res, 'Student not found', 404);
  if (student.status === STUDENT_STATUS.STRUCK_OFF) {
    return fail(res, 'Student is already struck off', 400);
  }

  const { subjectId } = req.body;
  const reason = (req.body.reason || '').trim();

  if (!subjectId && !reason) {
    return fail(res, 'Please select a subject or provide a reason for striking off this student.', 400);
  }

  let subjectName = null;
  if (subjectId) {
    const subject = student.class?.subjects?.id(subjectId);
    if (!subject) return fail(res, 'Selected subject was not found in this student\'s class', 404);
    subjectName = subject.name;
  }

  student.strikeOffRecords.push({
    subject: subjectId || null,
    subjectName,
    reason,
    isActive: true,
    struckOffAt: new Date(),
    struckOffBy: req.user._id,
    struckOffByName: req.user.name,
  });
  student.status = STUDENT_STATUS.STRUCK_OFF;
  // Keep the legacy summary fields in sync for anything still reading them.
  student.struckOffAt = new Date();
  student.struckOffReason = subjectName ? `${subjectName}${reason ? ` - ${reason}` : ''}` : reason;
  await student.save();

  const label = subjectName ? `in ${subjectName}` : 'for all subjects';
  await logAction({
    user: req.user,
    action: AUDIT_ACTIONS.STUDENT_STRUCK_OFF,
    description: `Marked ${student.name} (Roll ${student.rollNumber}) as STRUCK OFF ${label}${reason ? ` — ${reason}` : ''}`,
    metadata: { studentId: student._id, subjectId: subjectId || null, subjectName, reason },
    req,
  });

  return ok(res, student, `${student.name} marked as Struck Off`);
});

// PUT /api/students/:id/restore
const restoreStudent = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) return fail(res, 'Student not found', 404);
  if (student.status === STUDENT_STATUS.ACTIVE) {
    return fail(res, 'Student is already active', 400);
  }

  const activeRecord = student.strikeOffRecords.find((r) => r.isActive);
  if (activeRecord) {
    activeRecord.isActive = false;
    activeRecord.restoredAt = new Date();
    activeRecord.restoredBy = req.user._id;
    activeRecord.restoredByName = req.user.name;
  }
  student.status = STUDENT_STATUS.ACTIVE;
  student.struckOffAt = null;
  student.struckOffReason = '';
  await student.save();

  await logAction({
    user: req.user,
    action: AUDIT_ACTIONS.STUDENT_RESTORED,
    description: `Restored ${student.name} (Roll ${student.rollNumber}) to ACTIVE`,
    metadata: { studentId: student._id },
    req,
  });

  return ok(res, student, `${student.name} restored to Active`);
});

// PUT /api/students/:id/archive
const archiveStudent = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) return fail(res, 'Student not found', 404);
  student.isArchived = true;
  await student.save();
  return ok(res, student, 'Student archived');
});

// DELETE /api/students/:id
// Permanent delete. Safe to do even after the student has exam history:
// Submission entries and finalized ExamResult snapshots store the student's
// name/roll number/marks denormalized at the time, so removing the live
// Student document never corrupts historical records.
const deleteStudent = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) return fail(res, 'Student not found', 404);

  await Student.deleteOne({ _id: student._id });

  await logAction({
    user: req.user,
    action: AUDIT_ACTIONS.STUDENT_DELETED,
    description: `Deleted student ${student.name} (Roll ${student.rollNumber})`,
    metadata: { studentId: student._id },
    req,
  });

  return ok(res, null, `${student.name} was deleted`);
});

// GET /api/students/:id/history - full result history across examinations
const getStudentHistory = asyncHandler(async (req, res) => {
  const ExamResult = require('../models/ExamResult');
  const Examination = require('../models/Examination');

  const student = await Student.findById(req.params.id).populate('class', 'name section academicSession');
  if (!student) return fail(res, 'Student not found', 404);

  const results = await ExamResult.find({ 'students.student': student._id }).populate({
    path: 'examination',
    select: 'name examType resultDate academicSession class',
    populate: { path: 'class', select: 'name' },
  });

  const history = results
    .map((r) => {
      const entry = r.students.find((s) => s.student.toString() === student._id.toString());
      if (!entry) return null;
      return {
        examination: r.examination,
        percentage: entry.percentage,
        rank: entry.rank,
        failedSubjects: entry.failedSubjects,
        struckOffInfo: entry.struckOffInfo,
        overallDecision: entry.overallDecision,
        needsReview: entry.needsReview,
        statusAtFinalization: entry.statusAtFinalization,
        subjectResults: entry.subjectResults,
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.examination?.resultDate) - new Date(b.examination?.resultDate));

  return ok(res, { student, history });
});

// POST /api/students/bulk-import  (multipart file handled by route middleware -> req.file.buffer)
const bulkImportStudents = asyncHandler(async (req, res) => {
  if (!req.file) return fail(res, 'Excel file is required', 400);
  const { classId, academicSession } = req.body;
  const klass = await Class.findById(classId);
  if (!klass) return fail(res, 'Class not found', 404);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(req.file.buffer);
  const sheet = workbook.worksheets[0];

  const results = { imported: 0, duplicates: [], invalid: [] };
  const headerRow = sheet.getRow(1).values; // 1-indexed, index 0 empty

  // Alias-aware header matching (e.g. "Roll No", "R#", "Father Contact" all
  // resolve to the same canonical field) so the office doesn't need to match
  // one exact spelling.
  const colIndexFor = (field) => headerRow.findIndex((v) => matchField(v) === field);

  const nameCol = colIndexFor('name');
  const fatherCol = colIndexFor('fatherName');
  const fatherContactCol = colIndexFor('fatherContact');
  const rollCol = colIndexFor('rollNumber');
  const regCol = colIndexFor('registrationNumber');
  const admissionCol = colIndexFor('admissionNumber');

  if (nameCol === -1 || rollCol === -1) {
    return fail(res, 'Excel must contain at least a Roll Number and a Student Name column', 400);
  }

  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    if (!row || row.values.length === 0) continue;

    const name = row.values[nameCol]?.toString().trim();
    const rollNumber = row.values[rollCol]?.toString().trim();
    if (!name || !rollNumber) {
      if (row.values.some((v) => v)) results.invalid.push({ row: i, reason: 'Missing name or roll number' });
      continue;
    }

    const dup = await Student.findOne({ rollNumber, class: classId, academicSession, isArchived: false });
    if (dup) {
      results.duplicates.push({ row: i, rollNumber });
      continue;
    }

    try {
      await Student.create({
        name,
        fatherName: fatherCol !== -1 ? row.values[fatherCol]?.toString().trim() : '',
        fatherContact: fatherContactCol !== -1 ? row.values[fatherContactCol]?.toString().trim() : '',
        rollNumber,
        registrationNumber: regCol !== -1 ? row.values[regCol]?.toString().trim() : '',
        admissionNumber: admissionCol !== -1 ? row.values[admissionCol]?.toString().trim() : '',
        class: classId,
        academicSession,
        createdBy: req.user._id,
      });
      results.imported += 1;
    } catch (err) {
      results.invalid.push({ row: i, reason: err.message });
    }
  }

  await logAction({
    user: req.user,
    action: AUDIT_ACTIONS.STUDENTS_BULK_IMPORTED,
    description: `Bulk imported ${results.imported} students into class ${klass.name}`,
    metadata: results,
    req,
  });

  return ok(res, results, 'Bulk import complete');
});

/**
 * Shared row-validation used by both the preview and the real text import,
 * so what the Admin previews is exactly what gets saved.
 */
async function validateTextImportRows(rows, classId, academicSession) {
  const seenRollNumbers = new Set();
  const validated = [];

  for (const row of rows) {
    const { lineNumber, rollNumber, name, fatherName, fatherContact } = row;

    if (!rollNumber || !name) {
      validated.push({ lineNumber, rollNumber, name, fatherName, fatherContact, status: 'invalid', reason: 'Roll number and name are required' });
      continue;
    }
    if (seenRollNumbers.has(rollNumber)) {
      validated.push({ lineNumber, rollNumber, name, fatherName, fatherContact, status: 'duplicate', reason: 'Duplicate roll number in this batch' });
      continue;
    }
    seenRollNumbers.add(rollNumber);

    const dup = await Student.findOne({ rollNumber, class: classId, academicSession, isArchived: false });
    if (dup) {
      validated.push({ lineNumber, rollNumber, name, fatherName, fatherContact, status: 'duplicate', reason: 'Roll number already exists in this class' });
      continue;
    }

    validated.push({ lineNumber, rollNumber, name, fatherName, fatherContact, status: 'valid', reason: '' });
  }

  return validated;
}

// POST /api/students/bulk-import-text/preview
// Parses + validates pasted text WITHOUT saving, so the Admin can review
// exactly what will be imported first.
const bulkImportTextPreview = asyncHandler(async (req, res) => {
  const { classId, academicSession, text } = req.body;
  if (!text || !text.trim()) return fail(res, 'Paste at least one line of student data', 400);

  const klass = await Class.findById(classId);
  if (!klass) return fail(res, 'Class not found', 404);

  const { rows, usedHeader } = parseTextImport(text);
  const validated = await validateTextImportRows(rows, classId, academicSession);

  const summary = {
    valid: validated.filter((r) => r.status === 'valid').length,
    duplicates: validated.filter((r) => r.status === 'duplicate').length,
    invalid: validated.filter((r) => r.status === 'invalid').length,
  };

  return ok(res, { rows: validated, usedHeader, summary });
});

// POST /api/students/bulk-import-text
// Accepts pasted text, one student per line, comma- or tab-separated:
//   rollNumber, name, fatherName[, fatherContact]
// with an optional header row in any recognized spelling. e.g.:
//   "1, Umer, Musharaf, 03331234567"  or just  "1, Umer, Musharaf"
const bulkImportStudentsText = asyncHandler(async (req, res) => {
  const { classId, academicSession, text } = req.body;
  if (!text || !text.trim()) return fail(res, 'Paste at least one line of student data', 400);

  const klass = await Class.findById(classId);
  if (!klass) return fail(res, 'Class not found', 404);

  const { rows } = parseTextImport(text);
  const validated = await validateTextImportRows(rows, classId, academicSession);

  const results = { imported: 0, duplicates: [], invalid: [] };

  for (const row of validated) {
    if (row.status === 'duplicate') {
      results.duplicates.push({ row: row.lineNumber, rollNumber: row.rollNumber });
      continue;
    }
    if (row.status === 'invalid') {
      results.invalid.push({ row: row.lineNumber, reason: row.reason });
      continue;
    }
    try {
      await Student.create({
        name: row.name,
        fatherName: row.fatherName || '',
        fatherContact: row.fatherContact || '',
        rollNumber: row.rollNumber,
        class: classId,
        academicSession,
        createdBy: req.user._id,
      });
      results.imported += 1;
    } catch (err) {
      results.invalid.push({ row: row.lineNumber, reason: err.message });
    }
  }

  await logAction({
    user: req.user,
    action: AUDIT_ACTIONS.STUDENTS_BULK_IMPORTED,
    description: `Bulk imported ${results.imported} students (pasted text) into class ${klass.name}`,
    metadata: results,
    req,
  });

  return ok(res, results, 'Bulk import complete');
});

// GET /api/students/export?classId=
const exportStudents = asyncHandler(async (req, res) => {
  const { classId } = req.query;
  const filter = { isArchived: false };
  if (classId) filter.class = classId;

  const students = await Student.find(filter).populate('class', 'name section academicSession').sort({ rollNumber: 1 });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Students');
  sheet.columns = [
    { header: 'Roll Number', key: 'rollNumber', width: 15 },
    { header: 'Name', key: 'name', width: 25 },
    { header: "Father's Name", key: 'fatherName', width: 25 },
    { header: "Father's Contact", key: 'fatherContact', width: 18 },
    { header: 'Registration Number', key: 'registrationNumber', width: 20 },
    { header: 'Admission Number', key: 'admissionNumber', width: 20 },
    { header: 'Class', key: 'className', width: 25 },
    { header: 'Academic Session', key: 'academicSession', width: 15 },
    { header: 'Status', key: 'status', width: 15 },
  ];
  sheet.getRow(1).font = { bold: true };

  students.forEach((s) => {
    const row = sheet.addRow({
      rollNumber: s.rollNumber,
      name: s.name,
      fatherName: s.fatherName,
      fatherContact: s.fatherContact,
      registrationNumber: s.registrationNumber,
      admissionNumber: s.admissionNumber,
      className: s.class?.name || '',
      academicSession: s.academicSession,
      status: s.status === 'struck_off' ? 'STRUCK OFF' : 'ACTIVE',
    });
    if (s.status === 'struck_off') {
      row.eachCell((cell) => {
        cell.font = { color: { argb: 'FFB00020' } };
      });
    }
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="students.xlsx"');
  await workbook.xlsx.write(res);
  res.end();
});

module.exports = {
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
};
