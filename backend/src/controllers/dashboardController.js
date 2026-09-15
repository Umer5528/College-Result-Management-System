const asyncHandler = require('express-async-handler');
const Student = require('../models/Student');
const Class = require('../models/Class');
const Examination = require('../models/Examination');
const Submission = require('../models/Submission');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { ok } = require('../utils/apiResponse');
const { ROLES, STUDENT_STATUS, EXAM_STATUS } = require('../config/constants');

// GET /api/dashboard
const getDashboard = asyncHandler(async (req, res) => {
  const [
    totalStudents,
    activeStudents,
    struckOffStudents,
    totalClasses,
    totalExaminations,
    pendingExams,
    completedExams,
  ] = await Promise.all([
    Student.countDocuments({ isArchived: false }),
    Student.countDocuments({ isArchived: false, status: STUDENT_STATUS.ACTIVE }),
    Student.countDocuments({ isArchived: false, status: STUDENT_STATUS.STRUCK_OFF }),
    Class.countDocuments({ isArchived: false }),
    Examination.countDocuments({}),
    Examination.countDocuments({ status: { $in: [EXAM_STATUS.SUBMISSION_OPEN, EXAM_STATUS.SUBMISSION_IN_PROGRESS] } }),
    Examination.countDocuments({ status: EXAM_STATUS.FINALIZED }),
  ]);

  const totalSubjects = (await Class.find({ isArchived: false })).reduce((sum, c) => sum + c.subjects.length, 0);

  const recentExams = await Examination.find({}).populate('class', 'name section').sort({ createdAt: -1 }).limit(8);
  const recentWithProgress = await Promise.all(
    recentExams.map(async (exam) => {
      const submitted = await Submission.countDocuments({ examination: exam._id });
      return {
        id: exam._id,
        name: exam.name,
        className: exam.class?.name,
        resultDate: exam.resultDate,
        status: exam.status,
        createdAt: exam.createdAt,
        progress: { submitted, total: exam.subjects.length },
      };
    })
  );

  const trendExams = await Examination.find({ status: EXAM_STATUS.FINALIZED }).sort({ resultDate: 1 }).limit(12);
  const ExamResult = require('../models/ExamResult');
  const trendResults = await ExamResult.find({ examination: { $in: trendExams.map((e) => e._id) } });
  const resultByExam = new Map(trendResults.map((r) => [r.examination.toString(), r]));
  const trends = trendExams.map((e) => {
    const r = resultByExam.get(e._id.toString());
    return {
      name: e.name,
      averagePercentage: r?.stats?.averagePercentage ?? null,
      passingPercentage: r?.stats?.passingPercentage ?? null,
    };
  });

  const payload = {
    cards: {
      totalStudents,
      activeStudents,
      struckOffStudents,
      totalClasses,
      totalSubjects,
      totalExaminations,
      pendingSubmissions: pendingExams,
      completedResults: completedExams,
    },
    recentExaminations: recentWithProgress,
    trends,
  };

  if (req.user.role === ROLES.SUPER_ADMIN) {
    const [totalAdmins, activeAdmins, recentAudit] = await Promise.all([
      User.countDocuments({ role: ROLES.ADMIN }),
      User.countDocuments({ role: ROLES.ADMIN, isActive: true }),
      AuditLog.find({}).sort({ createdAt: -1 }).limit(15),
    ]);
    payload.superAdmin = { totalAdmins, activeAdmins, recentAuditEvents: recentAudit };
  }

  return ok(res, payload);
});

module.exports = { getDashboard };
