const mongoose = require('mongoose');

// Subjects are embedded inside a Class because they are tightly scoped to it
// (a subject's totalMarks/passingMarks only make sense within its class), but
// each subject keeps its own _id so it can be referenced independently from
// Examinations, Submissions and Results.
const subjectSchema = new mongoose.Schema(
  {
    globalSubjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'GlobalSubject', default: null },
    globalSubject: { type: mongoose.Schema.Types.ObjectId, ref: 'GlobalSubject', default: null },
    inheritsGlobalConfig: { type: Boolean, default: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, default: '' },
    totalMarks: { type: Number, required: true, min: 1 },
    passingMarks: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

subjectSchema.pre('validate', function (next) {
  if (this.globalSubjectId && !this.globalSubject) {
    this.globalSubject = this.globalSubjectId;
  } else if (this.globalSubject && !this.globalSubjectId) {
    this.globalSubjectId = this.globalSubject;
  }
  if (this.passingMarks > this.totalMarks) {
    return next(new Error('Passing marks cannot exceed total marks'));
  }
  next();
});

const classSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // e.g. "Pre Medical 1st Year"
    section: { type: String, trim: true, default: '' }, // e.g. "A" - optional subdivision of a class
    academicSession: { type: String, required: true, trim: true }, // e.g. "2026-27"
    description: { type: String, default: '' },
    subjects: [subjectSchema],
    isArchived: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

classSchema.index({ name: 1, section: 1, academicSession: 1 }, { unique: true });

module.exports = mongoose.model('Class', classSchema);
