const mongoose = require('mongoose');
const { STUDENT_STATUS } = require('../config/constants');

const studentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    fatherName: { type: String, default: '', trim: true },
    fatherContact: { type: String, default: '', trim: true },
    rollNumber: { type: String, required: true, trim: true },
    registrationNumber: { type: String, default: '', trim: true },
    admissionNumber: { type: String, default: '', trim: true },
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    academicSession: { type: String, required: true, trim: true },
    gender: { type: String, enum: ['male', 'female', 'other'], default: 'other' },
    admissionDate: { type: Date, default: Date.now },
    // Whole-student status. Kept as a convenience/legacy summary flag,
    // derive-synced from subjectStrikeOffs below (true if at least one
    // subject-level strike-off is currently active). Nothing in the
    // calculation engine gates on this anymore — it's for list badges,
    // dashboard counts, and simple filters only.
    // Whole-student status. Derive-synced from strikeOffRecords below (true
    // whenever there's at least one currently-active strike-off record —
    // strike-off is GLOBAL: one active record makes the student struck off
    // across every subject, not just the one (optionally) cited). Used for
    // list badges, dashboard counts, and — importantly — the calculation
    // engine's single struck-off gate.
    status: {
      type: String,
      enum: Object.values(STUDENT_STATUS),
      default: STUDENT_STATUS.ACTIVE,
    },
    // Legacy convenience fields, kept for backward compatibility; superseded
    // by strikeOffRecords below (no longer written to directly).
    struckOffAt: { type: Date, default: null },
    struckOffReason: { type: String, default: '' },
    // Full strike-off history. A record cites a subject and/or a reason (at
    // least one is required — enforced in the controller), but regardless of
    // which was given, an ACTIVE record means the student is struck off
    // everywhere. Restoring deactivates a record rather than deleting it, so
    // historical/audit information is never destroyed; striking off again
    // later creates a new active record.
    strikeOffRecords: [
      {
        subject: { type: mongoose.Schema.Types.ObjectId, default: null }, // null = "All Subjects"
        subjectName: { type: String, default: null }, // snapshot, null if no subject was selected
        reason: { type: String, default: '' },
        isActive: { type: Boolean, default: true },
        struckOffAt: { type: Date, default: Date.now },
        struckOffBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        struckOffByName: { type: String, default: '' }, // snapshot
        restoredAt: { type: Date, default: null },
        restoredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        restoredByName: { type: String, default: '' }, // snapshot
      },
    ],
    isArchived: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Prevent duplicate roll numbers within same class + session
studentSchema.index({ rollNumber: 1, class: 1, academicSession: 1 }, { unique: true });
studentSchema.index({ name: 'text' });

/** The single currently-active strike-off record, or null if the student is active. */
studentSchema.methods.getActiveStrikeOff = function () {
  return this.strikeOffRecords.find((s) => s.isActive) || null;
};

module.exports = mongoose.model('Student', studentSchema);
