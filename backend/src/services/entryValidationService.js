const { calcAttendancePercentage } = require('./calculationService');

/**
 * Parses and validates one student's raw {classesAttended, obtainedMarks}
 * input against a subject's total marks and the submission's total lectures
 * delivered. Shared by the public teacher-submission flow and the Admin
 * "edit a submitted result" flow so both enforce identical rules.
 *
 * Marks accepts a number, or the letter "A"/"a" meaning the student was
 * absent for the exam (stored as isAbsent, obtainedMarks stays null).
 *
 * Returns { error } on invalid input, otherwise the built entry fields
 * (excluding student/roll/name/status, which the caller already knows).
 */
function parseStudentEntry({ classesAttended: rawAttended, obtainedMarks: rawMarks }, { totalLectures, totalMarks, studentLabel }) {
  const classesAttended = rawAttended === '' || rawAttended === undefined || rawAttended === null ? null : Number(rawAttended);

  let isAbsent = false;
  let obtainedMarks = null;
  if (typeof rawMarks === 'string' && rawMarks.trim().toLowerCase() === 'a') {
    isAbsent = true;
  } else if (rawMarks !== '' && rawMarks !== undefined && rawMarks !== null) {
    obtainedMarks = Number(rawMarks);
  }

  if (classesAttended !== null) {
    if (!Number.isFinite(classesAttended) || classesAttended < 0) {
      return { error: `Invalid attendance value for ${studentLabel}` };
    }
    if (classesAttended > totalLectures) {
      return {
        error: `Classes attended (${classesAttended}) cannot exceed total lectures delivered (${totalLectures}) for ${studentLabel}`,
      };
    }
  }

  if (!isAbsent && obtainedMarks !== null) {
    if (!Number.isFinite(obtainedMarks) || obtainedMarks < 0) {
      return { error: `Invalid marks value for ${studentLabel}` };
    }
    if (obtainedMarks > totalMarks) {
      return { error: `Marks (${obtainedMarks}) for ${studentLabel} cannot exceed total marks (${totalMarks})` };
    }
  }

  return {
    classesAttended,
    attendancePercentage: calcAttendancePercentage(classesAttended, totalLectures),
    obtainedMarks: isAbsent ? null : obtainedMarks,
    isAbsent,
  };
}

module.exports = { parseStudentEntry };
