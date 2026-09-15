const Examination = require('../models/Examination');
const ExamResult = require('../models/ExamResult');
const Class = require('../models/Class');
const { round2 } = require('./calculationService');

/**
 * Builds an "Overall Performance Report" across multiple finalized
 * examinations and one or more classes.
 *
 * Rules honored:
 *  - Only finalized examinations are included (their snapshot is trustworthy
 *    and historically stable).
 *  - Classes are never blindly merged: each class's exams/subjects are kept
 *    scoped to that class. Cross-class comparison only uses
 *    percentage/average/passing-rate style metrics that are always comparable,
 *    plus a same-subject-name comparison where subject names coincide.
 *  - Struck-off students are excluded from trend/ranking/statistics metrics,
 *    consistent with single-exam finalization rules.
 */
async function buildOverallReport({ examinationIds, classIds }) {
  const examFilter = { _id: { $in: examinationIds }, status: 'finalized' };
  if (classIds && classIds.length > 0) examFilter.class = { $in: classIds };

  const examinations = await Examination.find(examFilter).populate('class', 'name section').sort({ resultDate: 1 });
  if (examinations.length === 0) {
    return {
      classes: [],
      examinations: [],
      subjectComparison: [],
      overallStats: null,
      message: 'No finalized examinations matched the selection.',
    };
  }

  const results = await ExamResult.find({ examination: { $in: examinations.map((e) => e._id) } });
  const resultByExam = new Map(results.map((r) => [r.examination.toString(), r]));

  // Group examinations by class
  const classIdsInvolved = [...new Set(examinations.map((e) => e.class._id.toString()))];
  const classDocs = await Class.find({ _id: { $in: classIdsInvolved } });
  const classById = new Map(classDocs.map((c) => [c._id.toString(), c]));

  const classSections = classIdsInvolved.map((cid) => {
    const classExams = examinations.filter((e) => e.class._id.toString() === cid);
    const examSummaries = classExams.map((exam) => {
      const result = resultByExam.get(exam._id.toString());
      return {
        examinationId: exam._id,
        name: exam.name,
        resultDate: exam.resultDate,
        stats: result ? result.stats : null,
      };
    });

    // Per-student trend within this class across its selected exams
    const studentTrendMap = new Map();
    classExams.forEach((exam) => {
      const result = resultByExam.get(exam._id.toString());
      if (!result) return;
      result.students.forEach((s) => {
        if (s.statusAtFinalization !== 'active' || s.percentage === null) return;
        if (!studentTrendMap.has(s.student.toString())) {
          studentTrendMap.set(s.student.toString(), {
            student: s.student,
            rollNumber: s.rollNumber,
            studentName: s.studentName,
            byExam: [],
          });
        }
        studentTrendMap.get(s.student.toString()).byExam.push({
          examinationId: exam._id,
          examinationName: exam.name,
          percentage: s.percentage,
        });
      });
    });

    let studentTrends = [...studentTrendMap.values()].map((t) => {
      const values = t.byExam.map((b) => b.percentage);
      const average = round2(values.reduce((a, b) => a + b, 0) / values.length);
      let trend = 'Stable';
      if (values.length >= 2) {
        const diff = values[values.length - 1] - values[0];
        if (diff > 2) trend = 'Improving';
        else if (diff < -2) trend = 'Declining';
      }
      return { ...t, overallAverage: average, trend };
    });

    // Rank within this class by overall average (competition ranking, ties share a rank)
    studentTrends = studentTrends.sort((a, b) => b.overallAverage - a.overallAverage);
    let lastAvg = null;
    let lastRank = 0;
    studentTrends.forEach((t, idx) => {
      if (t.overallAverage !== lastAvg) {
        lastRank = idx + 1;
        lastAvg = t.overallAverage;
      }
      t.rank = lastRank;
    });

    const topPerformers = studentTrends.slice(0, 5);
    const needsAttention = studentTrends.filter((t) => t.trend === 'Declining' || t.overallAverage < 40).slice(0, 5);

    return {
      class: { id: cid, name: classById.get(cid)?.name || 'Unknown', section: classById.get(cid)?.section || '' },
      examinations: examSummaries,
      studentTrends,
      topPerformers,
      needsAttention,
    };
  });

  // Cross-class subject comparison: only where subject names literally match,
  // averaged per class across the selected exams for that class.
  const subjectAverageByClassSubject = new Map(); // key: className::subjectName -> [{examName, average}]
  classSections.forEach((section) => {
    section.examinations.forEach((examSummary) => {
      if (!examSummary.stats) return;
      examSummary.stats.subjectStats.forEach((ss) => {
        const key = `${section.class.name}::${ss.subjectName}`;
        if (!subjectAverageByClassSubject.has(key)) subjectAverageByClassSubject.set(key, []);
        subjectAverageByClassSubject.get(key).push({ examinationName: examSummary.name, average: ss.average });
      });
    });
  });

  const subjectNamesInvolved = [
    ...new Set(
      classSections.flatMap((s) => s.examinations.flatMap((e) => (e.stats ? e.stats.subjectStats.map((ss) => ss.subjectName) : [])))
    ),
  ];

  const subjectComparison = subjectNamesInvolved
    .map((subjectName) => {
      const perClass = classSections.map((section) => {
        const key = `${section.class.name}::${subjectName}`;
        const entries = subjectAverageByClassSubject.get(key) || [];
        const overallAvg = entries.length ? round2(entries.reduce((a, b) => a + (b.average || 0), 0) / entries.length) : null;
        return { className: section.class.name, average: overallAvg, hasSubject: entries.length > 0 };
      });
      return { subjectName, perClass: perClass.filter((p) => p.hasSubject) };
    })
    .filter((sc) => sc.perClass.length > 0);

  // Combined overall statistics across every selected, finalized exam result
  // (independent of class grouping) — computed directly from raw student
  // entries so it stays accurate regardless of how many classes were chosen.
  let appeared = 0;
  let passed = 0;
  let failed = 0;
  const allPercentages = [];
  const allMarks = [];
  const allAttendances = [];
  const totalStudentsSet = new Set();

  results.forEach((r) => {
    r.students.forEach((s) => {
      totalStudentsSet.add(s.student.toString());
      if (s.statusAtFinalization !== 'active' || s.percentage === null) return;
      appeared += 1;
      if (s.overallDecision === 'pass') passed += 1;
      if (s.overallDecision === 'fail') failed += 1;
      allPercentages.push(s.percentage);
      if (s.totalObtained !== null && s.totalObtained !== undefined) allMarks.push(s.totalObtained);
      if (s.averageAttendance !== null && s.averageAttendance !== undefined) allAttendances.push(s.averageAttendance);
    });
  });

  const overallStats =
    appeared > 0
      ? {
          totalStudents: totalStudentsSet.size,
          appeared,
          passed,
          failed,
          pendingDecision: appeared - passed - failed,
          passingPercentage: round2((passed / appeared) * 100),
          failingPercentage: round2((failed / appeared) * 100),
          averagePercentage: round2(allPercentages.reduce((a, b) => a + b, 0) / allPercentages.length),
          highestPercentage: Math.max(...allPercentages),
          lowestPercentage: Math.min(...allPercentages),
          highestMarks: allMarks.length ? Math.max(...allMarks) : null,
          lowestMarks: allMarks.length ? Math.min(...allMarks) : null,
          attendanceAverage: allAttendances.length
            ? round2(allAttendances.reduce((a, b) => a + b, 0) / allAttendances.length)
            : null,
          attendanceHighest: allAttendances.length ? Math.max(...allAttendances) : null,
          attendanceLowest: allAttendances.length ? Math.min(...allAttendances) : null,
        }
      : null;

  return {
    classes: classSections,
    examinations: examinations.map((e) => ({
      id: e._id,
      name: e.name,
      className: e.class.name,
      classSection: e.class.section || '',
      resultDate: e.resultDate,
    })),
    subjectComparison,
    overallStats,
  };
}

module.exports = { buildOverallReport };
