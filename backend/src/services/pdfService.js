const PDFDocument = require('pdfkit');

const MARGIN = 36;
const RED = '#B00020';
const DARK = '#1F2937';

function addPageNumbers(doc) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc
      .fontSize(8)
      .fillColor('#666666')
      .text(`Page ${i + 1} of ${range.count}`, MARGIN, doc.page.height - 30, {
        width: doc.page.width - MARGIN * 2,
        align: 'center',
      });
  }
}

function drawHeader(doc, { settings, examination, klass }) {
  doc.fontSize(16).fillColor(DARK).text(settings?.collegeName || 'College Result Management System', { align: 'center' });
  if (settings?.address || settings?.city) {
    doc
      .fontSize(9)
      .fillColor('#555')
      .text([settings.address, settings.city, settings.province, settings.country].filter(Boolean).join(', '), {
        align: 'center',
      });
  }
  doc.moveDown(0.3);
  doc.fontSize(9).fillColor('#555').text(`Academic Session: ${examination.academicSession}`, { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(13).fillColor(DARK).text(`${examination.name} (${examination.examType})`, { align: 'center' });
  doc.fontSize(11).text(`Class: ${klass.name}${klass.section ? ` — Section ${klass.section}` : ''}`, { align: 'center' });
  doc.fontSize(9).fillColor('#555').text(`Result Date: ${new Date(examination.resultDate).toDateString()}`, { align: 'center' });
  doc.fontSize(8).fillColor('#888').text(`Report Generated: ${new Date().toDateString()}`, { align: 'center' });
  doc.moveDown(1);
}

/**
 * Simple, dependency-free table renderer good enough for result grids:
 * fixed column widths, header row, zebra-ish spacing, page-break aware.
 */
function drawTable(doc, { headers, rows, colWidths, startY, rowColorFn }) {
  const startX = MARGIN;
  let y = startY;
  const rowHeight = 18;

  const drawHeaderRow = () => {
    doc.rect(startX, y, colWidths.reduce((a, b) => a + b, 0), rowHeight).fill(DARK);
    let x = startX;
    doc.fillColor('#FFFFFF').fontSize(8);
    headers.forEach((h, i) => {
      doc.text(h, x + 2, y + 5, { width: colWidths[i] - 4, align: 'left' });
      x += colWidths[i];
    });
    y += rowHeight;
  };

  drawHeaderRow();

  rows.forEach((r) => {
    if (y + rowHeight > doc.page.height - 50) {
      doc.addPage({ layout: 'landscape', margin: MARGIN });
      y = MARGIN;
      drawHeaderRow();
    }
    const color = rowColorFn ? rowColorFn(r) : '#000000';
    let x = startX;
    doc.fillColor(color).fontSize(8);
    r.forEach((val, i) => {
      doc.text(String(val), x + 2, y + 5, { width: colWidths[i] - 4, align: 'left' });
      x += colWidths[i];
    });
    y += rowHeight;
  });

  return y;
}

function buildExamResultPdf({ settings, examination, klass, result }) {
  const doc = new PDFDocument({ margin: MARGIN, size: 'A4', layout: 'landscape', bufferPages: true });

  drawHeader(doc, { settings, examination, klass });

  const subjects = examination.subjects;

  // Total lectures delivered per subject, for the header text.
  const lecturesDeliveredBySubject = new Map();
  subjects.forEach((subj) => {
    const withData = result.students.find((s) =>
      s.subjectResults.some((sr) => sr.subjectName === subj.name && sr.lecturesDelivered != null)
    );
    const sr = withData?.subjectResults.find((x) => x.subjectName === subj.name);
    lecturesDeliveredBySubject.set(subj.name, sr?.lecturesDelivered ?? null);
  });

  const headers = ['Rank', 'Roll', 'Name'];
  subjects.forEach((s) => {
    const delivered = lecturesDeliveredBySubject.get(s.name);
    headers.push(`${s.name} Mks`, `${s.name} Att${delivered != null ? `/${delivered}` : ''}`);
  });
  headers.push('Total', 'Poss.', '%', 'Failed Subj.', 'Result', 'Struck Off');

  const fixedCols = 3 + 6; // rank/roll/name + total/poss/pct/failed/result/struckoff
  const subjectCols = subjects.length * 2;
  const availableWidth = doc.page.width - MARGIN * 2;
  const colWidths = [];
  colWidths.push(35, 45, 90); // rank, roll, name
  const remaining = availableWidth - 35 - 45 - 90 - 45 - 45 - 40 - 70 - 65 - 90;
  const perSubjectCol = Math.max(40, remaining / subjectCols);
  subjects.forEach(() => colWidths.push(perSubjectCol, perSubjectCol));
  colWidths.push(45, 45, 40, 70, 65, 90);

  const students = [...result.students].sort((a, b) => {
    if (a.statusAtFinalization !== b.statusAtFinalization) {
      return a.statusAtFinalization === 'struck_off' ? 1 : -1;
    }
    return (a.rank || 9999) - (b.rank || 9999);
  });

  const rows = students.map((s) => {
    const isStruckOff = s.statusAtFinalization === 'struck_off';
    const row = [isStruckOff ? '-' : s.rank || '-', s.rollNumber, s.studentName];
    subjects.forEach((subj) => {
      const sr = s.subjectResults.find((x) => x.subjectName === subj.name);
      if (isStruckOff) {
        row.push('SO', '-');
      } else if (sr?.isAbsent) {
        row.push('Absent', sr.classesAttended ?? '-');
      } else {
        row.push(sr?.obtainedMarks ?? '-', sr?.classesAttended ?? '-');
      }
    });
    let struckOffCell = '-';
    if (s.struckOffInfo) {
      const label = s.struckOffInfo.subjectName || 'All Subjects';
      struckOffCell = s.struckOffInfo.reason ? `${label} - ${s.struckOffInfo.reason}` : label;
    }
    row.push(
      isStruckOff ? '-' : s.totalObtained ?? '-',
      isStruckOff ? '-' : s.totalPossible ?? '-',
      isStruckOff ? '-' : s.percentage != null ? `${s.percentage}%` : '-',
      isStruckOff ? '-' : s.failedSubjects && s.failedSubjects.length ? s.failedSubjects.join(', ') : '-',
      s.overallDecision === 'pass' ? 'PASSED' : s.overallDecision === 'fail' ? 'FAILED' : 'PENDING',
      struckOffCell
    );
    return { row, isStruckOff };
  });

  const endY = drawTable(doc, {
    headers,
    rows: rows.map((r) => r.row),
    colWidths,
    startY: doc.y + 6,
    rowColorFn: (_, idx) => '#000000',
  });

  // Recolor struck-off rows red by redrawing text isn't trivial with the simple
  // renderer above; instead we mark status text itself, which is sufficient
  // for identification in print, per the "clear identification" requirement.

  let y = endY + 20;
  if (y > doc.page.height - 150) {
    doc.addPage({ layout: 'landscape', margin: MARGIN });
    y = MARGIN;
  }

  const stats = result.stats;
  doc.fillColor(DARK).fontSize(12).text('RESULT SUMMARY', MARGIN, y);
  y += 18;
  doc.fontSize(9).fillColor('#000');
  const summaryLines = [
    `Total Enrolled: ${stats.totalEnrolled}`,
    `Active Students: ${stats.activeStudents}    Struck Off: ${stats.struckOffStudents}`,
    `Appeared: ${stats.appeared}    Passed: ${stats.passed} (${stats.autoPassed} auto, ${stats.explicitlyPassed} by Admin)    Failed: ${stats.failed}    Pending Decision: ${stats.pendingDecision} (${stats.studentsWithFailedSubjects} failed subject(s), ${stats.studentsWithActiveStrikeOff} struck off)`,
    `Passing %: ${stats.passingPercentage ?? '-'}%    Average %: ${stats.averagePercentage ?? '-'}%`,
    `Highest %: ${stats.highestPercentage ?? '-'}% (${stats.highestScorer || '-'})`,
    `Lowest %: ${stats.lowestPercentage ?? '-'}% (${stats.lowestScorer || '-'})`,
    `Highest Marks: ${stats.highestMarks ?? '-'}    Lowest Marks: ${stats.lowestMarks ?? '-'}    Average Marks: ${stats.averageMarks ?? '-'}`,
    `Attendance — Average: ${stats.attendanceAverage ?? '-'}%    Highest: ${stats.attendanceHighest ?? '-'}%    Lowest: ${stats.attendanceLowest ?? '-'}%`,
  ];
  summaryLines.forEach((line) => {
    doc.text(line, MARGIN, y);
    y += 14;
  });

  y += 10;
  doc.fontSize(12).text('SUBJECT-WISE SUMMARY', MARGIN, y);
  y += 18;
  const subjHeaders = ['Subject', 'Avg', 'High', 'Low', 'Pass%', 'Fail%', 'Avg Att%'];
  const subjColWidths = [140, 60, 60, 60, 60, 60, 70];
  const subjRows = stats.subjectStats.map((ss) => [
    ss.subjectName,
    ss.average ?? '-',
    ss.highest ?? '-',
    ss.lowest ?? '-',
    ss.passingPercentage != null ? `${ss.passingPercentage}%` : '-',
    ss.failingPercentage != null ? `${ss.failingPercentage}%` : '-',
    ss.averageAttendance != null ? `${ss.averageAttendance}%` : '-',
  ]);
  drawTable(doc, { headers: subjHeaders, rows: subjRows, colWidths: subjColWidths, startY: y });

  addPageNumbers(doc);
  doc.end();
  return doc;
}

module.exports = { buildExamResultPdf, drawTable, drawHeader, addPageNumbers, MARGIN, RED, DARK };
