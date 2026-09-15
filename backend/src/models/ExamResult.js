const mongoose = require('mongoose');
const { STUDENT_STATUS } = require('../config/constants');

// Finalizing an examination computes this snapshot ONCE and stores it. Even if
// a student is struck off later, or class subjects change, this document keeps
// the exact numbers/ranks that were true at finalization time. Re-finalizing
// (after an authorized reopen) recomputes and replaces this document.
const subjectResultSchema = new mongoose.Schema(
  {
    subject: { type: mongoose.Schema.Types.ObjectId, required: true },
    subjectName: { type: String, required: true },
    totalMarks: { type: Number, required: true },
    passingMarks: { type: Number, required: true },
    obtainedMarks: { type: Number, default: null },
    isAbsent: { type: Boolean, default: false },
    classesAttended: { type: Number, default: null },
    lecturesDelivered: { type: Number, default: null },
    teacherName: { type: String, default: '' },
    attendancePercentage: { type: Number, default: null },
    isPass: { type: Boolean, default: null },
  },
  { _id: false }
);

const studentResultSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    rollNumber: { type: String, required: true },
    studentName: { type: String, required: true },
    // Whole-student flag (struck-off is GLOBAL — one active strike-off
    // record means struck off in every subject). This IS what gates ranking,
    // stats, and marks entry.
    statusAtFinalization: {
      type: String,
      enum: Object.values(STUDENT_STATUS),
      required: true,
    },
    subjectResults: [subjectResultSchema],
    totalObtained: { type: Number, default: null },
    totalPossible: { type: Number, default: null },
    percentage: { type: Number, default: null },
    // Objective, subject-level fact — computed fresh on every finalize.
    // Never auto-fails the student overall; that's the Admin's call below.
    failedSubjects: { type: [String], default: [] },
    // The struck-off record's context, if the student is currently struck
    // off — null otherwise. subjectName is null when the strike-off cited
    // "All Subjects" rather than one specific subject.
    struckOffInfo: {
      type: { subjectName: { type: String, default: null }, reason: { type: String, default: '' } },
      default: null,
    },
    rank: { type: Number, default: null }, // null for struck-off students (excluded from ranking)
    averageAttendance: { type: Number, default: null },
    // The Admin's explicit final call — the ONLY thing that determines
    // "Overall Result" when it isn't auto-decided. Auto-set to 'pass' when a
    // student passed everything and isn't struck off; otherwise starts
    // 'pending' until the Admin decides. Never silently overwritten by
    // recalculation once explicitly set.
    overallDecision: { type: String, enum: ['pending', 'pass', 'fail'], default: 'pending' },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    decidedAt: { type: Date, default: null },
    // Snapshots of failedSubjects/struck-off-ness at decision time, so a
    // later re-finalize (after marks were corrected, or the student was
    // restored/re-struck-off) can detect drift without silently overriding
    // what the Admin decided.
    decidedFailedSubjectsSnapshot: { type: [String], default: [] },
    decidedWasStruckOff: { type: Boolean, default: false },
    needsReview: { type: Boolean, default: false },
  },
  { _id: false }
);

const examResultSchema = new mongoose.Schema(
  {
    examination: { type: mongoose.Schema.Types.ObjectId, ref: 'Examination', required: true, unique: true },
    students: [studentResultSchema],
    stats: {
      totalEnrolled: Number,
      activeStudents: Number,
      struckOffStudents: Number,
      appeared: Number,
      passed: Number,
      failed: Number,
      pendingDecision: Number,
      // Finalization-summary breakdown (Section 8 of the spec).
      autoPassed: Number,
      explicitlyPassed: Number,
      explicitlyFailed: Number,
      studentsWithFailedSubjects: Number,
      studentsWithActiveStrikeOff: Number,
      passingPercentage: Number,
      failingPercentage: Number,
      averagePercentage: Number,
      highestPercentage: Number,
      lowestPercentage: Number,
      highestScorer: String,
      lowestScorer: String,
      highestMarks: Number,
      lowestMarks: Number,
      averageMarks: Number,
      attendanceAverage: Number,
      attendanceHighest: Number,
      attendanceLowest: Number,
      subjectStats: [
        {
          subject: mongoose.Schema.Types.ObjectId,
          subjectName: String,
          average: Number,
          highest: Number,
          lowest: Number,
          passed: Number,
          failed: Number,
          passingPercentage: Number,
          failingPercentage: Number,
          averageAttendance: Number,
          highestAttendance: Number,
          lowestAttendance: Number,
        },
      ],
    },
    finalizedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    finalizedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ExamResult', examResultSchema);
