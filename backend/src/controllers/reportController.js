const asyncHandler = require('express-async-handler');
const Examination = require('../models/Examination');
const ExamResult = require('../models/ExamResult');
const CollegeSettings = require('../models/CollegeSettings');
const Student = require('../models/Student');
const { fail } = require('../utils/apiResponse');
const { ok } = require('../utils/apiResponse');
const { buildExamResultWorkbook } = require('../services/excelService');
const { buildExamResultPdf } = require('../services/pdfService');
const { buildOverallReport } = require('../services/overallReportService');
const { buildOverallReportWorkbook } = require('../services/overallExcelService');
const { buildOverallReportPdf } = require('../services/overallPdfService');
const { logAction } = require('../services/auditService');
const { AUDIT_ACTIONS } = require('../config/constants');

async function loadFinalizedExam(examinationId) {
  const exam = await Examination.findById(examinationId).populate('class', 'name section academicSession');
  if (!exam) return { error: 'Examination not found' };
  if (exam.status !== 'finalized') return { error: 'Examination result has not been finalized yet' };
  const result = await ExamResult.findOne({ examination: exam._id });
  if (!result) return { error: 'Finalized result data not found' };
  return { exam, result };
}

// GET /api/reports/:examinationId/excel
const exportExamExcel = asyncHandler(async (req, res) => {
  const { exam, result, error } = await loadFinalizedExam(req.params.examinationId);
  if (error) return fail(res, error, 400);

  const settings = await CollegeSettings.findOne();
  const students = await Student.find({ class: exam.class._id }).select('fatherContact');
  const fatherContactByStudentId = new Map(students.map((s) => [s._id.toString(), s.fatherContact || '']));

  const workbook = await buildExamResultWorkbook({
    settings,
    examination: exam,
    klass: exam.class,
    result,
    fatherContactByStudentId,
  });

  await logAction({
    user: req.user,
    action: AUDIT_ACTIONS.REPORT_GENERATED,
    description: `Generated Excel report for "${exam.name}"`,
    req,
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${exam.name.replace(/\s+/g, '_')}_Result.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
});

// GET /api/reports/:examinationId/pdf
const exportExamPdf = asyncHandler(async (req, res) => {
  const { exam, result, error } = await loadFinalizedExam(req.params.examinationId);
  if (error) return fail(res, error, 400);

  const settings = await CollegeSettings.findOne();
  const doc = buildExamResultPdf({ settings, examination: exam, klass: exam.class, result });

  await logAction({
    user: req.user,
    action: AUDIT_ACTIONS.REPORT_GENERATED,
    description: `Generated PDF report for "${exam.name}"`,
    req,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${exam.name.replace(/\s+/g, '_')}_Result.pdf"`);
  doc.pipe(res);
});

// POST /api/reports/overall  { examinationIds: [], classIds: [] }
const getOverallReport = asyncHandler(async (req, res) => {
  const { examinationIds, classIds } = req.body;
  if (!Array.isArray(examinationIds) || examinationIds.length === 0) {
    return fail(res, 'Select at least one examination', 400);
  }

  const report = await buildOverallReport({ examinationIds, classIds: classIds || [] });
  return ok(res, report);
});

// POST /api/reports/overall/excel
const exportOverallExcel = asyncHandler(async (req, res) => {
  const { examinationIds, classIds } = req.body;
  if (!Array.isArray(examinationIds) || examinationIds.length === 0) {
    return fail(res, 'Select at least one examination', 400);
  }
  const report = await buildOverallReport({ examinationIds, classIds: classIds || [] });
  const settings = await CollegeSettings.findOne();
  const workbook = await buildOverallReportWorkbook({ settings, report });

  await logAction({
    user: req.user,
    action: AUDIT_ACTIONS.REPORT_GENERATED,
    description: 'Generated Overall Performance Report (Excel)',
    req,
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="Overall_Performance_Report.xlsx"');
  await workbook.xlsx.write(res);
  res.end();
});

// POST /api/reports/overall/pdf
const exportOverallPdf = asyncHandler(async (req, res) => {
  const { examinationIds, classIds } = req.body;
  if (!Array.isArray(examinationIds) || examinationIds.length === 0) {
    return fail(res, 'Select at least one examination', 400);
  }
  const report = await buildOverallReport({ examinationIds, classIds: classIds || [] });
  const settings = await CollegeSettings.findOne();
  const doc = buildOverallReportPdf({ settings, report });

  await logAction({
    user: req.user,
    action: AUDIT_ACTIONS.REPORT_GENERATED,
    description: 'Generated Overall Performance Report (PDF)',
    req,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="Overall_Performance_Report.pdf"');
  doc.pipe(res);
});

module.exports = { exportExamExcel, exportExamPdf, getOverallReport, exportOverallExcel, exportOverallPdf };
