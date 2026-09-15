const mongoose = require('mongoose');
const { SUBMISSION_STATUS, STUDENT_STATUS } = require('../config/constants');

// One Submission = one subject's result entry for one examination, filed by a
// teacher through the anonymous secure link. A student struck off in THIS
// SPECIFIC SUBJECT is recorded with statusAtSubmission STRUCK_OFF, a reason
// snapshot, and null marks/attendance — but the same student can be perfectly
// active in every other subject's submission for the same examination.
const entrySchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    rollNumber: { type: String, required: true }, // snapshot, for stable display
    studentName: { type: String, required: true }, // snapshot
    // Scoped to THIS subject only — not a whole-student flag.
    statusAtSubmission: {
      type: String,
      enum: Object.values(STUDENT_STATUS),
      required: true,
    },
    struckOffReason: { type: String, default: '' }, // snapshot, only set when statusAtSubmission is struck_off
    struckOffSubjectName: { type: String, default: null }, // snapshot of the subject the strike-off cited, if any
    classesAttended: { type: Number, default: null },
    attendancePercentage: { type: Number, default: null },
    obtainedMarks: { type: Number, default: null },
    // Teacher enters "A"/"a" in the marks field to record an absent student.
    // obtainedMarks stays null and this flag is set instead.
    isAbsent: { type: Boolean, default: false },
  },
  { _id: false }
);

const submissionSchema = new mongoose.Schema(
  {
    examination: { type: mongoose.Schema.Types.ObjectId, ref: 'Examination', required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, required: true }, // matches examination.subjects[].subject
    subjectName: { type: String, required: true },
    teacherName: { type: String, required: true, trim: true },
    totalLecturesDelivered: { type: Number, required: true, min: 1 },
    entries: [entrySchema],
    status: {
      type: String,
      enum: Object.values(SUBMISSION_STATUS),
      default: SUBMISSION_STATUS.SUBMITTED,
    },
    submittedAt: { type: Date, default: Date.now },
    ipAddress: { type: String, default: '' },
  },
  { timestamps: true }
);

// A subject can only be submitted once per examination (duplicate protection).
// Admin/Super Admin "reopen" flow deletes/replaces this doc explicitly rather
// than allowing silent overwrite.
submissionSchema.index({ examination: 1, subject: 1 }, { unique: true });

module.exports = mongoose.model('Submission', submissionSchema);
