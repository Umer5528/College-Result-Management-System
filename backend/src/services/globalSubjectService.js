const mongoose = require("mongoose");
const GlobalSubject = require("../models/GlobalSubject");
const Class = require("../models/Class");
const AuditLog = require("../models/AuditLog");
const { AUDIT_ACTIONS } = require("../config/constants");

const normalizePart = (value) =>
  String(value || "")
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, " ");
const normalizeSubjectName = normalizePart;

function getSubjectIdentity(name, code = "") {
  const normalizedCode = normalizePart(code);
  return normalizedCode
    ? `code:${normalizedCode}`
    : `name:${normalizePart(name)}`;
}

/**
 * Resolve or create a GlobalSubject safely without duplicate keys.
 */
async function resolveGlobalSubject(
  { name, code = "", totalMarks, passingMarks, userId = null },
  session = null,
) {
  const identityKey = getSubjectIdentity(name, code);
  const options = session ? { session } : {};

  // Try finding by exact identity key
  let subject = await GlobalSubject.findOne({ identityKey }, null, options);
  if (subject) return subject;

  // Try finding by exact name match if no code was given
  const normalizedName = normalizePart(name);
  if (!code || !code.trim()) {
    subject = await GlobalSubject.findOne(
      {
        $or: [
          { identityKey: `name:${normalizedName}` },
          { aliases: normalizedName },
        ],
      },
      null,
      options,
    );
    if (subject) return subject;
  } else {
    // If code was given, try finding by normalized code
    const normalizedCode = normalizePart(code);
    subject = await GlobalSubject.findOne(
      {
        $or: [
          { identityKey: `code:${normalizedCode}` },
          { code: new RegExp(`^${normalizedCode}$`, "i") },
        ],
      },
      null,
      options,
    );
    if (subject) return subject;
  }

  // Create new GlobalSubject
  try {
    const newDoc = new GlobalSubject({
      name: String(name).trim(),
      code: String(code || "").trim(),
      identityKey,
      aliases: [normalizedName],
      totalMarks: Number(totalMarks) || 100,
      passingMarks: Number(passingMarks) || 33,
      defaultTotalMarks: Number(totalMarks) || 100,
      defaultPassingMarks: Number(passingMarks) || 33,
      active: true,
      createdBy: userId,
    });
    await newDoc.save(options);
    return newDoc;
  } catch (error) {
    if (error.code === 11000) {
      // Handled duplicate race condition
      return await GlobalSubject.findOne({ identityKey }, null, options);
    }
    throw error;
  }
}

/**
 * Universal update service:
 * When a global subject is updated:
 * - Update GlobalSubject entity
 * - Update all class subject configurations that inherit global values (inheritsGlobalConfig === true)
 * - DO NOT update class overrides (inheritsGlobalConfig === false)
 * - Return summary:
 *   - totalClasses: total classes with this subject
 *   - classesUpdated: count of classes modified
 *   - overridesPreserved: count of class configurations whose overrides were kept intact
 *   - updatedClassList: list of class names and sections updated
 *   - overridesList: list of class names where overrides were preserved
 */
async function updateGlobalSubjectUniversal(
  subjectId,
  { name, code, totalMarks, passingMarks, active },
  user = null,
  clientIp = "",
  externalSession = null,
) {
  const session = externalSession || (await mongoose.startSession());
  const ownsSession = !externalSession;

  try {
    let result;
    const execute = async () => {
      const subject = await GlobalSubject.findById(subjectId).session(session);
      if (!subject) {
        const error = new Error("Global subject not found");
        error.status = 404;
        throw error;
      }

      const previous = {
        name: subject.name,
        code: subject.code,
        totalMarks: subject.totalMarks,
        passingMarks: subject.passingMarks,
        active: subject.active,
      };

      if (name !== undefined && name.trim()) {
        const oldNorm = normalizePart(subject.name);
        const newNorm = normalizePart(name);
        if (oldNorm !== newNorm) {
          if (!subject.aliases.includes(oldNorm)) subject.aliases.push(oldNorm);
          if (!subject.aliases.includes(newNorm)) subject.aliases.push(newNorm);
        }
        subject.name = name.trim();
      }

      if (code !== undefined) {
        subject.code = code.trim();
      }

      if (totalMarks !== undefined) {
        subject.totalMarks = Number(totalMarks);
        subject.defaultTotalMarks = Number(totalMarks);
      }

      if (passingMarks !== undefined) {
        subject.passingMarks = Number(passingMarks);
        subject.defaultPassingMarks = Number(passingMarks);
      }

      if (active !== undefined) {
        subject.active = Boolean(active);
      }

      await subject.save({ session });

      // Find all classes containing this global subject
      const classes = await Class.find({
        $or: [
          { "subjects.globalSubjectId": subject._id },
          { "subjects.globalSubject": subject._id },
        ],
      }).session(session);

      let classesUpdated = 0;
      let overridesPreserved = 0;
      const updatedClassList = [];
      const overridesList = [];

      for (const klass of classes) {
        let classChanged = false;
        for (const s of klass.subjects) {
          const isTarget =
            s.globalSubjectId?.toString() === subject._id.toString() ||
            s.globalSubject?.toString() === subject._id.toString();

          if (!isTarget) continue;

          // Check if class inherits global config
          if (s.inheritsGlobalConfig !== false) {
            // Inheriting: update to global values!
            s.name = subject.name;
            if (subject.code) s.code = subject.code;
            s.totalMarks = subject.totalMarks;
            s.passingMarks = subject.passingMarks;
            classChanged = true;
          } else {
            // Overridden: keep custom marks intact!
            // We can optionally keep the name updated for consistency
            if (s.name !== subject.name) {
              s.name = subject.name;
              classChanged = true;
            }
            overridesPreserved += 1;
            overridesList.push({
              classId: klass._id,
              className: klass.name,
              section: klass.section,
              totalMarks: s.totalMarks,
              passingMarks: s.passingMarks,
            });
          }
        }

        if (classChanged) {
          await klass.save({ session, validateModifiedOnly: true });
          classesUpdated += 1;
          updatedClassList.push({
            classId: klass._id,
            className: klass.name,
            section: klass.section,
          });
        }
      }

      // Record audit log
      if (user) {
        await AuditLog.create(
          [
            {
              user: user._id,
              userLabel: user.name || user.email || "Admin",
              action: AUDIT_ACTIONS.GLOBAL_SUBJECT_UPDATED,
              description: `Universally updated global subject "${subject.name}" (${subject.totalMarks} total / ${subject.passingMarks} pass) across classes`,
              metadata: {
                subjectId: subject._id,
                subjectName: subject.name,
                previous,
                next: {
                  name: subject.name,
                  code: subject.code,
                  totalMarks: subject.totalMarks,
                  passingMarks: subject.passingMarks,
                  active: subject.active,
                },
                totalClassesAffected: classes.length,
                classesUpdated,
                overridesPreserved,
                updatedClassList,
                overridesList,
              },
              ipAddress: clientIp || "",
            },
          ],
          { session },
        );
      }

      result = {
        subject,
        summary: {
          totalClasses: classes.length,
          classesUpdated,
          overridesPreserved,
          updatedClassList,
          overridesList,
        },
      };
    };

    if (ownsSession) {
      await session.withTransaction(execute);
    } else {
      await execute();
    }

    return result;
  } finally {
    if (ownsSession) {
      await session.endSession();
    }
  }
}

/**
 * Migration helper:
 * Safely migrate all existing class subjects to GlobalSubject registry.
 * - Detects duplicate names / codes and links them to a single canonical GlobalSubject
 * - Sets globalSubjectId and globalSubject
 * - If class subject's marks match global defaults -> inheritsGlobalConfig = true
 * - If class subject's marks differ -> inheritsGlobalConfig = false (override preserved!)
 * - Preserves existing Class.subjects embedded _id values
 * - Historical examinations & results are untouched
 */
async function migrateExistingClassSubjects(session = null) {
  const classes = await Class.find({}).session(session);
  let totalSubjectsProcessed = 0;
  let newlyMapped = 0;
  let alreadyMapped = 0;
  let overridesDetected = 0;

  for (const klass of classes) {
    let classModified = false;
    for (const subject of klass.subjects) {
      totalSubjectsProcessed += 1;
      const existingRef = subject.globalSubjectId || subject.globalSubject;

      if (existingRef) {
        alreadyMapped += 1;
        // Ensure both fields and boolean are set
        if (!subject.globalSubjectId) subject.globalSubjectId = existingRef;
        if (!subject.globalSubject) subject.globalSubject = existingRef;
        if (subject.inheritsGlobalConfig === undefined) {
          subject.inheritsGlobalConfig = true;
          classModified = true;
        }
        continue;
      }

      const globalSubject = await resolveGlobalSubject(
        {
          name: subject.name,
          code: subject.code,
          totalMarks: subject.totalMarks,
          passingMarks: subject.passingMarks,
        },
        session,
      );

      subject.globalSubjectId = globalSubject._id;
      subject.globalSubject = globalSubject._id;

      // Check if marks match global subject defaults
      const marksMatch =
        Number(subject.totalMarks) === Number(globalSubject.totalMarks) &&
        Number(subject.passingMarks) === Number(globalSubject.passingMarks);

      subject.inheritsGlobalConfig = marksMatch;
      if (!marksMatch) overridesDetected += 1;

      newlyMapped += 1;
      classModified = true;
    }

    if (classModified) {
      await klass.save({ session, validateModifiedOnly: true });
    }
  }

  return {
    totalClasses: classes.length,
    totalSubjectsProcessed,
    newlyMapped,
    alreadyMapped,
    overridesDetected,
  };
}

module.exports = {
  getSubjectIdentity,
  normalizeSubjectName,
  resolveGlobalSubject,
  updateGlobalSubjectUniversal,
  migrateExistingClassSubjects,
};
