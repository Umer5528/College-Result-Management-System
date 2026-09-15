const mongoose = require('mongoose');

// Singleton-style document: only one settings doc should exist.
const collegeSettingsSchema = new mongoose.Schema(
  {
    collegeName: { type: String, default: '' },
    logoUrl: { type: String, default: '' },
    address: { type: String, default: '' },
    city: { type: String, default: '' },
    province: { type: String, default: '' },
    country: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    website: { type: String, default: '' },
    principalName: { type: String, default: '' },
    academicSession: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CollegeSettings', collegeSettingsSchema);
