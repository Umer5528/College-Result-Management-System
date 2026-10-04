const mongoose = require("mongoose");

const globalSubjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, default: "" },
    identityKey: { type: String, required: true, unique: true, index: true },
    aliases: { type: [String], default: [] },
    totalMarks: { type: Number, required: true, min: 1 },
    passingMarks: { type: Number, required: true, min: 0 },
    defaultTotalMarks: { type: Number, min: 1 },
    defaultPassingMarks: { type: Number, min: 0 },
    active: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

globalSubjectSchema.virtual('isActive').get(function () {
  return this.active;
});

globalSubjectSchema.pre("validate", function (next) {
  // Sync totalMarks <-> defaultTotalMarks
  if (this.totalMarks !== undefined && this.totalMarks !== null) {
    this.defaultTotalMarks = this.totalMarks;
  } else if (this.defaultTotalMarks !== undefined && this.defaultTotalMarks !== null) {
    this.totalMarks = this.defaultTotalMarks;
  }

  // Sync passingMarks <-> defaultPassingMarks
  if (this.passingMarks !== undefined && this.passingMarks !== null) {
    this.defaultPassingMarks = this.passingMarks;
  } else if (this.defaultPassingMarks !== undefined && this.defaultPassingMarks !== null) {
    this.passingMarks = this.defaultPassingMarks;
  }

  if (this.passingMarks > this.totalMarks) {
    return next(new Error("Passing marks cannot exceed total marks"));
  }
  next();
});

module.exports = mongoose.model("GlobalSubject", globalSubjectSchema);
