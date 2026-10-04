const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const Class = require("../models/Class");
const Examination = require("../models/Examination");
const GlobalSubject = require("../models/GlobalSubject");
const AuditLog = require("../models/AuditLog");
const { AUDIT_ACTIONS } = require("../config/constants");
const { ok, created, fail } = require("../utils/apiResponse");
const {
  normalizeSubjectName,
  getSubjectIdentity,
  resolveGlobalSubject,
  updateGlobalSubjectUniversal,
  migrateExistingClassSubjects,
} = require("../services/globalSubjectService");

const isObjectId = (value) =>
  typeof value === "string" && /^[a-f\d]{24}$/i.test(value);

// GET /api/global-subjects
const listGlobalSubjects = asyncHandler(async (req, res) => {
  const { search, activeOnly } = req.query;

  const query = {};
  if (activeOnly === "true") {
    query.active = true;
  }

  const globalSubjects = await GlobalSubject.find(query).sort({ name: 1 });
  const classes = await Class.find({ isArchived: false }).select(
    "name section academicSession isArchived subjects",
  );

  // Group class configurations by globalSubjectId
  const classBySubject = new Map();
  for (const klass of classes) {
    for (const conf of klass.subjects) {
      const key = (conf.globalSubjectId || conf.globalSubject)?.toString();
      if (!key) continue;
      if (!classBySubject.has(key)) classBySubject.set(key, []);
      classBySubject.get(key).push({
        classId: klass._id,
        classSubjectId: conf._id,
        name: klass.name,
        section: klass.section,
        academicSession: klass.academicSession,
        subjectName: conf.name,
        code: conf.code || "",
        totalMarks: conf.totalMarks,
        passingMarks: conf.passingMarks,
        inheritsGlobalConfig: conf.inheritsGlobalConfig !== false,
        isActive: conf.isActive,
      });
    }
  }

  const searchTerm = normalizeSubjectName(search || "");
  const data = globalSubjects
    .filter(
      (subject) =>
        !searchTerm ||
        normalizeSubjectName(subject.name).includes(searchTerm) ||
        (subject.code && normalizeSubjectName(subject.code).includes(searchTerm)) ||
        (subject.aliases || []).some((alias) =>
          normalizeSubjectName(alias).includes(searchTerm),
        ),
    )
    .map((subject) => {
      const configurations = classBySubject.get(subject._id.toString()) || [];
      const inheritingCount = configurations.filter(
        (c) => c.inheritsGlobalConfig,
      ).length;
      const overrideCount = configurations.filter(
        (c) => !c.inheritsGlobalConfig,
      ).length;

      return {
        ...subject.toObject(),
        totalMarks: subject.totalMarks ?? subject.defaultTotalMarks,
        passingMarks: subject.passingMarks ?? subject.defaultPassingMarks,
        configurations,
        configurationCount: configurations.length,
        inheritingCount,
        overrideCount,
      };
    });

  return ok(res, data);
});

// GET /api/global-subjects/:id
const getGlobalSubject = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isObjectId(id)) return fail(res, "Invalid subject ID", 400);

  const subject = await GlobalSubject.findById(id);
  if (!subject) return fail(res, "Global subject not found", 404);

  const classes = await Class.find({
    $or: [{ "subjects.globalSubjectId": id }, { "subjects.globalSubject": id }],
  }).select("name section academicSession isArchived subjects");

  const configurations = [];
  for (const klass of classes) {
    for (const conf of klass.subjects) {
      const match =
        conf.globalSubjectId?.toString() === id ||
        conf.globalSubject?.toString() === id;
      if (match) {
        configurations.push({
          classId: klass._id,
          classSubjectId: conf._id,
          name: klass.name,
          section: klass.section,
          academicSession: klass.academicSession,
          isArchived: klass.isArchived,
          subjectName: conf.name,
          totalMarks: conf.totalMarks,
          passingMarks: conf.passingMarks,
          inheritsGlobalConfig: conf.inheritsGlobalConfig !== false,
          isActive: conf.isActive,
        });
      }
    }
  }

  const result = {
    ...subject.toObject(),
    totalMarks: subject.totalMarks ?? subject.defaultTotalMarks,
    passingMarks: subject.passingMarks ?? subject.defaultPassingMarks,
    configurations,
    configurationCount: configurations.length,
    inheritingCount: configurations.filter((c) => c.inheritsGlobalConfig).length,
    overrideCount: configurations.filter((c) => !c.inheritsGlobalConfig).length,
  };

  return ok(res, result);
});

// POST /api/global-subjects
const createGlobalSubject = asyncHandler(async (req, res) => {
  const { name, code, totalMarks, passingMarks, active } = req.body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return fail(res, "Subject name is required", 400);
  }
  const tMarks = Number(totalMarks);
  const pMarks = Number(passingMarks);
  if (!Number.isFinite(tMarks) || tMarks <= 0) {
    return fail(res, "Total marks must be a positive number", 400);
  }
  if (!Number.isFinite(pMarks) || pMarks < 0) {
    return fail(res, "Passing marks must be a nonnegative number", 400);
  }
  if (pMarks > tMarks) {
    return fail(res, "Passing marks cannot exceed total marks", 400);
  }

  const identityKey = getSubjectIdentity(name, code);
  const existing = await GlobalSubject.findOne({ identityKey });
  if (existing) {
    return fail(res, `A global subject with this identity already exists ("${existing.name}")`, 400);
  }

  const subject = await GlobalSubject.create({
    name: name.trim(),
    code: (code || "").trim(),
    identityKey,
    aliases: [normalizeSubjectName(name)],
    totalMarks: tMarks,
    passingMarks: pMarks,
    defaultTotalMarks: tMarks,
    defaultPassingMarks: pMarks,
    active: active !== undefined ? Boolean(active) : true,
    createdBy: req.user._id,
  });

  await AuditLog.create({
    user: req.user._id,
    userLabel: req.user.name || req.user.email || "Admin",
    action: AUDIT_ACTIONS.GLOBAL_SUBJECT_CREATED,
    description: `Created global subject "${subject.name}" (${subject.totalMarks} total / ${subject.passingMarks} pass)`,
    metadata: {
      subjectId: subject._id,
      name: subject.name,
      code: subject.code,
      totalMarks: subject.totalMarks,
      passingMarks: subject.passingMarks,
    },
    ipAddress: req.ip || "",
  });

  return created(res, subject, "Global subject created successfully");
});

// PUT /api/global-subjects/:id
// Universal update: updates global subject and automatically cascades
// to all class subject configurations that inherit global values.
// Class overrides remain untouched.
const updateGlobalSubject = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, code, totalMarks, passingMarks, active } = req.body;

  if (!isObjectId(id)) return fail(res, "Invalid subject ID", 400);

  if (name !== undefined && (typeof name !== "string" || !name.trim())) {
    return fail(res, "Subject name cannot be empty", 400);
  }
  if (totalMarks !== undefined) {
    const t = Number(totalMarks);
    if (!Number.isFinite(t) || t <= 0) {
      return fail(res, "Total marks must be a positive number", 400);
    }
  }
  if (passingMarks !== undefined) {
    const p = Number(passingMarks);
    if (!Number.isFinite(p) || p < 0) {
      return fail(res, "Passing marks must be a nonnegative number", 400);
    }
  }

  // Pre-validate passing vs total
  const existing = await GlobalSubject.findById(id);
  if (!existing) return fail(res, "Global subject not found", 404);

  const effectiveTotal = totalMarks !== undefined ? Number(totalMarks) : (existing.totalMarks ?? existing.defaultTotalMarks);
  const effectivePassing = passingMarks !== undefined ? Number(passingMarks) : (existing.passingMarks ?? existing.defaultPassingMarks);

  if (effectivePassing > effectiveTotal) {
    return fail(res, "Passing marks cannot exceed total marks", 400);
  }

  const { subject, summary } = await updateGlobalSubjectUniversal(
    id,
    { name, code, totalMarks, passingMarks, active },
    req.user,
    req.ip,
  );

  return ok(
    res,
    { subject, summary },
    `Updated "${subject.name}" across ${summary.classesUpdated} class(es); ${summary.overridesPreserved} override(s) preserved.`,
  );
});

// DELETE /api/global-subjects/:id
const deleteGlobalSubject = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isObjectId(id)) return fail(res, "Invalid subject ID", 400);

  const subject = await GlobalSubject.findById(id);
  if (!subject) return fail(res, "Global subject not found", 404);

  // Check if any class uses this subject
  const classesUsing = await Class.countDocuments({
    $or: [{ "subjects.globalSubjectId": id }, { "subjects.globalSubject": id }],
  });
  if (classesUsing > 0) {
    return fail(
      res,
      `Cannot delete "${subject.name}" because it is currently used by ${classesUsing} class configuration(s). Deactivate it instead.`,
      400,
    );
  }

  await GlobalSubject.deleteOne({ _id: id });

  await AuditLog.create({
    user: req.user._id,
    userLabel: req.user.name || req.user.email || "Admin",
    action: AUDIT_ACTIONS.GLOBAL_SUBJECT_DELETED,
    description: `Deleted global subject "${subject.name}"`,
    metadata: { subjectId: id, name: subject.name, code: subject.code },
    ipAddress: req.ip || "",
  });

  return ok(res, null, `Global subject "${subject.name}" deleted`);
});

// POST /api/global-subjects/migrate
const migrateSubjects = asyncHandler(async (req, res) => {
  const result = await migrateExistingClassSubjects();

  await AuditLog.create({
    user: req.user._id,
    userLabel: req.user.name || req.user.email || "Admin",
    action: AUDIT_ACTIONS.GLOBAL_SUBJECT_MIGRATED,
    description: `Migrated class subjects to Global Subject registry: ${result.newlyMapped} newly mapped, ${result.alreadyMapped} already mapped, ${result.overridesDetected} overrides detected`,
    metadata: result,
    ipAddress: req.ip || "",
  });

  return ok(res, result, "Subject migration completed successfully");
});

// Legacy / compatibility endpoints
const updateGlobalSubjectDefaults = updateGlobalSubject;
const applySubjectConfigurations = updateGlobalSubject;

module.exports = {
  listGlobalSubjects,
  getGlobalSubject,
  createGlobalSubject,
  updateGlobalSubject,
  deleteGlobalSubject,
  migrateSubjects,
  updateGlobalSubjectDefaults,
  applySubjectConfigurations,
};
