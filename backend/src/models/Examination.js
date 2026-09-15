const mongoose = require('mongoose');
const { EXAM_STATUS } = require('../config/constants');

const examinationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // e.g. "Monthly Test 1"
    examType: { type: String, default: 'Monthly Test', trim: true },
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    academicSession: { type: String, required: true, trim: true },
    resultDate: { type: Date, required: true },

    // Snapshot of subject config at creation time (subjectId + name + totalMarks +
    // passingMarks) so later edits to the Class's subjects never retroactively
    // change an already-created examination's configuration.
    subjects: [
      {
        subject: { type: mongoose.Schema.Types.ObjectId, required: true },
        name: { type: String, required: true },
        code: { type: String, default: '' },
        totalMarks: { type: Number, required: true },
        passingMarks: { type: Number, required: true },
      },
    ],

    status: {
      type: String,
      enum: Object.values(EXAM_STATUS),
      default: EXAM_STATUS.DRAFT,
    },

    // Secure public submission link
    submissionToken: { type: String, unique: true, sparse: true, index: true },
    isLinkActive: { type: Boolean, default: false },
    linkExpiresAt: { type: Date, default: null },

    createdFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'Examination', default: null },

    finalizedAt: { type: Date, default: null },
    finalizedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

examinationSchema.index({ class: 1, academicSession: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Examination', examinationSchema);
