/**
 * Pure calculation helpers used across submission handling and result
 * finalization. Kept side-effect free and independently testable.
 */

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/** attendance % = classesAttended / totalLecturesDelivered * 100, clamped [0,100] */
function calcAttendancePercentage(classesAttended, totalLecturesDelivered) {
  if (
    classesAttended === null ||
    classesAttended === undefined ||
    !totalLecturesDelivered ||
    totalLecturesDelivered <= 0
  ) {
    return null;
  }
  const pct = (classesAttended / totalLecturesDelivered) * 100;
  return round2(Math.min(100, Math.max(0, pct)));
}

function sameStringSet(a, b) {
  if (a.length !== b.length) return false;
  const bSet = new Set(b);
  return a.every((x) => bSet.has(x));
}

/**
 * Build the finalized per-student result set for one examination given:
 *  - students: student docs belonging to the class
 *  - subjectsConfig: examination.subjects (snapshot: subject, name, totalMarks, passingMarks)
 *  - submissionsBySubject: Map<subjectId string, Submission document>
 *  - previousDecisionsByStudentId: Map<studentId string, { overallDecision,
 *    decidedBy, decidedAt, decidedFailedSubjectsSnapshot, decidedWasStruckOff }>
 *    — carried forward from a prior finalize so an Admin's explicit Pass/Fail
 *    call is never silently reset by recalculation. If the newly computed
 *    failedSubjects/struck-off-ness no longer match what the decision was
 *    based on, needsReview is set instead of touching the decision itself.
 *
 * Strike-off is GLOBAL: a student with any active strike-off record (whether
 * it cited a specific subject or not) is struck off across every subject of
 * the exam, gated by student.status exactly like the original design. The
 * struck-off record's subject/reason is carried through purely for display
 * (struckOffInfo) — it never narrows the exclusion to just one subject.
 *
 * Overall Result auto-decision (never auto-FAILS from a subject failure or
 * from being struck off):
 *  Rule 1 — passed every subject, not struck off -> auto PASS.
 *  Rule 2 — one or more failed subjects, not struck off -> PENDING DECISION.
 *  Rule 3 — struck off -> PENDING DECISION.
 *  Rule 4 — both failed subjects and struck off -> PENDING DECISION.
 * Once an Admin has explicitly decided (pass/fail), that decision is always
 * carried forward untouched; recalculation only ever flags needsReview.
 */
function buildExamResult(students, subjectsConfig, submissionsBySubject, previousDecisionsByStudentId = new Map()) {
  const studentResults = students.map((student) => {
    const sid = student._id.toString();
    const isStruckOff = student.status === 'struck_off';
    const activeStrikeOff = typeof student.getActiveStrikeOff === 'function' ? student.getActiveStrikeOff() : null;
    const struckOffInfo = isStruckOff
      ? { subjectName: activeStrikeOff?.subjectName ?? null, reason: activeStrikeOff?.reason ?? '' }
      : null;

    const subjectResults = subjectsConfig.map((subj) => {
      const submission = submissionsBySubject.get(subj.subject.toString());
      let obtainedMarks = null;
      let attendancePercentage = null;
      let classesAttended = null;
      let lecturesDelivered = null;
      let teacherName = '';
      let isAbsent = false;
      if (submission) {
        const entry = submission.entries.find((e) => e.student.toString() === sid);
        if (entry) {
          lecturesDelivered = submission.totalLecturesDelivered;
          teacherName = submission.teacherName || '';
          if (!isStruckOff) {
            obtainedMarks = entry.obtainedMarks;
            attendancePercentage = entry.attendancePercentage;
            classesAttended = entry.classesAttended;
            isAbsent = !!entry.isAbsent;
          }
        }
      }
      // An absent student has no marks entered but still "appeared" for the
      // exam, so they fail that subject rather than being left pending.
      const isPass = isStruckOff
        ? null
        : isAbsent
        ? false
        : obtainedMarks === null || obtainedMarks === undefined
        ? null
        : obtainedMarks >= subj.passingMarks;
      return {
        subject: subj.subject,
        subjectName: subj.name,
        totalMarks: subj.totalMarks,
        passingMarks: subj.passingMarks,
        obtainedMarks,
        isAbsent,
        classesAttended,
        lecturesDelivered,
        teacherName,
        attendancePercentage,
        isPass,
      };
    });

    let totalObtained = null;
    let totalPossible = null;
    let percentage = null;
    let failedSubjects = [];
    let averageAttendance = null;

    if (!isStruckOff) {
      // "Completed" = has either a real mark or a recorded absence — both
      // count toward a finished subject entry (absence contributes 0 marks).
      const completed = subjectResults.filter(
        (s) => s.isAbsent || (s.obtainedMarks !== null && s.obtainedMarks !== undefined)
      );
      if (completed.length === subjectResults.length && subjectResults.length > 0) {
        totalObtained = completed.reduce((sum, s) => sum + (s.isAbsent ? 0 : s.obtainedMarks), 0);
        totalPossible = subjectResults.reduce((sum, s) => sum + s.totalMarks, 0);
        percentage = totalPossible > 0 ? round2((totalObtained / totalPossible) * 100) : null;
        failedSubjects = subjectResults.filter((s) => s.isPass === false).map((s) => s.subjectName);
        const attendances = completed
          .map((s) => s.attendancePercentage)
          .filter((a) => a !== null && a !== undefined);
        averageAttendance = attendances.length
          ? round2(attendances.reduce((a, b) => a + b, 0) / attendances.length)
          : null;
      }
    }

    // Carry forward any existing Admin decision for this student rather than
    // resetting it every time the result is (re)computed. Otherwise, apply
    // Rules 1-4 fresh.
    const previous = previousDecisionsByStudentId.get(sid);
    let overallDecision;
    let decidedBy = null;
    let decidedAt = null;
    let decidedFailedSubjectsSnapshot = [];
    let decidedWasStruckOff = false;
    let needsReview = false;

    if (previous && previous.overallDecision && previous.overallDecision !== 'pending') {
      overallDecision = previous.overallDecision;
      decidedBy = previous.decidedBy || null;
      decidedAt = previous.decidedAt || null;
      decidedFailedSubjectsSnapshot = previous.decidedFailedSubjectsSnapshot || [];
      decidedWasStruckOff = !!previous.decidedWasStruckOff;
      const sameFailed = sameStringSet(decidedFailedSubjectsSnapshot, failedSubjects);
      needsReview = !(sameFailed && decidedWasStruckOff === isStruckOff);
    } else if (!isStruckOff && percentage !== null && failedSubjects.length === 0) {
      // Rule 1: passed everything, not struck off -> auto pass.
      overallDecision = 'pass';
    } else {
      // Rules 2/3/4 (failed subject(s), struck off, or both), or data simply
      // isn't complete enough to decide yet -> pending.
      overallDecision = 'pending';
    }

    return {
      student: student._id,
      rollNumber: student.rollNumber,
      studentName: student.name,
      statusAtFinalization: student.status,
      subjectResults,
      totalObtained,
      totalPossible,
      percentage,
      failedSubjects,
      struckOffInfo,
      rank: null,
      averageAttendance,
      overallDecision,
      decidedBy,
      decidedAt,
      decidedFailedSubjectsSnapshot,
      decidedWasStruckOff,
      needsReview,
    };
  });

  // Rank only non-struck-off students with a complete, calculated
  // percentage. Ties share the same rank (competition ranking, e.g. 1,2,2,4).
  const rankable = studentResults
    .filter((s) => s.statusAtFinalization === 'active' && s.percentage !== null)
    .sort((a, b) => b.percentage - a.percentage);

  let lastPercentage = null;
  let lastRank = 0;
  rankable.forEach((s, idx) => {
    if (s.percentage !== lastPercentage) {
      lastRank = idx + 1;
      lastPercentage = s.percentage;
    }
    s.rank = lastRank;
  });

  const stats = computeExamStats(studentResults, subjectsConfig);

  return { studentResults, stats };
}

function computeExamStats(studentResults, subjectsConfig) {
  const totalEnrolled = studentResults.length;
  const activeStudents = studentResults.filter((s) => s.statusAtFinalization === 'active').length;
  const struckOffStudents = totalEnrolled - activeStudents;

  // Pass/Fail/Pending are decision states defined for EVERY student
  // (including struck-off ones, who default to 'pending' until the Admin
  // decides) — not gated by having a computable percentage.
  const passed = studentResults.filter((s) => s.overallDecision === 'pass').length;
  const failed = studentResults.filter((s) => s.overallDecision === 'fail').length;
  const pendingDecision = studentResults.filter((s) => s.overallDecision === 'pending').length;
  const autoPassed = studentResults.filter((s) => s.overallDecision === 'pass' && !s.decidedBy).length;
  const explicitlyPassed = studentResults.filter((s) => s.overallDecision === 'pass' && !!s.decidedBy).length;
  const explicitlyFailed = studentResults.filter((s) => s.overallDecision === 'fail' && !!s.decidedBy).length;
  const studentsWithFailedSubjects = studentResults.filter((s) => s.failedSubjects.length > 0).length;
  const studentsWithActiveStrikeOff = studentResults.filter((s) => !!s.struckOffInfo).length;

  // Percentage-based stats (average/highest/lowest/etc.) only make sense for
  // students who actually have a computable percentage.
  const appearedList = studentResults.filter((s) => s.statusAtFinalization === 'active' && s.percentage !== null);
  const appeared = appearedList.length;

  const percentages = appearedList.map((s) => s.percentage);
  const highest = percentages.length ? Math.max(...percentages) : null;
  const lowest = percentages.length ? Math.min(...percentages) : null;
  const average = percentages.length
    ? round2(percentages.reduce((a, b) => a + b, 0) / percentages.length)
    : null;

  const highestScorer = appearedList.find((s) => s.percentage === highest)?.studentName || '';
  const lowestScorer = appearedList.find((s) => s.percentage === lowest)?.studentName || '';

  // Raw obtained-marks stats (distinct from the percentage-based ones above -
  // useful because subjects/total-possible marks can differ across exams).
  const totalMarksObtained = appearedList.map((s) => s.totalObtained).filter((v) => v !== null && v !== undefined);
  const highestMarks = totalMarksObtained.length ? Math.max(...totalMarksObtained) : null;
  const lowestMarks = totalMarksObtained.length ? Math.min(...totalMarksObtained) : null;
  const averageMarks = totalMarksObtained.length
    ? round2(totalMarksObtained.reduce((a, b) => a + b, 0) / totalMarksObtained.length)
    : null;

  // Exam-level attendance stats, aggregated from each appeared student's
  // own average attendance across their subjects.
  const attendances = appearedList.map((s) => s.averageAttendance).filter((v) => v !== null && v !== undefined);
  const attendanceAverage = attendances.length
    ? round2(attendances.reduce((a, b) => a + b, 0) / attendances.length)
    : null;
  const attendanceHighest = attendances.length ? Math.max(...attendances) : null;
  const attendanceLowest = attendances.length ? Math.min(...attendances) : null;

  const subjectStats = subjectsConfig.map((subj) => {
    const marksForSubject = [];
    const attendanceForSubject = [];
    let subjPassed = 0;
    let subjFailed = 0;

    studentResults.forEach((s) => {
      if (s.statusAtFinalization !== 'active') return;
      const sr = s.subjectResults.find((x) => x.subject.toString() === subj.subject.toString());
      if (sr && sr.obtainedMarks !== null && sr.obtainedMarks !== undefined) {
        marksForSubject.push(sr.obtainedMarks);
        if (sr.isPass) subjPassed += 1;
        else subjFailed += 1;
      }
      if (sr && sr.attendancePercentage !== null && sr.attendancePercentage !== undefined) {
        attendanceForSubject.push(sr.attendancePercentage);
      }
    });

    const subjAppeared = marksForSubject.length;
    return {
      subject: subj.subject,
      subjectName: subj.name,
      average: subjAppeared ? round2(marksForSubject.reduce((a, b) => a + b, 0) / subjAppeared) : null,
      highest: subjAppeared ? Math.max(...marksForSubject) : null,
      lowest: subjAppeared ? Math.min(...marksForSubject) : null,
      passed: subjPassed,
      failed: subjFailed,
      passingPercentage: subjAppeared ? round2((subjPassed / subjAppeared) * 100) : null,
      failingPercentage: subjAppeared ? round2((subjFailed / subjAppeared) * 100) : null,
      averageAttendance: attendanceForSubject.length
        ? round2(attendanceForSubject.reduce((a, b) => a + b, 0) / attendanceForSubject.length)
        : null,
      highestAttendance: attendanceForSubject.length ? Math.max(...attendanceForSubject) : null,
      lowestAttendance: attendanceForSubject.length ? Math.min(...attendanceForSubject) : null,
    };
  });

  return {
    totalEnrolled,
    activeStudents,
    struckOffStudents,
    appeared,
    passed,
    failed,
    pendingDecision,
    autoPassed,
    explicitlyPassed,
    explicitlyFailed,
    studentsWithFailedSubjects,
    studentsWithActiveStrikeOff,
    // Denominator is every enrolled student (passed+failed+pendingDecision
    // always sums to totalEnrolled), so this reads as "% of the whole roster
    // confirmed passed/failed so far" rather than being skewed by how many
    // decisions are still pending.
    passingPercentage: totalEnrolled ? round2((passed / totalEnrolled) * 100) : null,
    failingPercentage: totalEnrolled ? round2((failed / totalEnrolled) * 100) : null,
    averagePercentage: average,
    highestPercentage: highest,
    lowestPercentage: lowest,
    highestScorer,
    lowestScorer,
    highestMarks,
    lowestMarks,
    averageMarks,
    attendanceAverage,
    attendanceHighest,
    attendanceLowest,
    subjectStats,
  };
}

module.exports = { round2, calcAttendancePercentage, buildExamResult, computeExamStats };
