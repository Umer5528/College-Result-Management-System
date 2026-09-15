const ExcelJS = require('exceljs');

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3B57' } }; // deep navy, institutional
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' } };
const SUBHEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EDF2' } };
const STRUCK_OFF_FONT = { color: { argb: 'FFB00020' }, bold: true };
const THIN_BORDER = {
  top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
};
const CENTER = { horizontal: 'center', vertical: 'middle', wrapText: true };
const LEFT = { horizontal: 'left', vertical: 'middle', wrapText: true };

/**
 * "Physics" / "Physics - Poor attendance" / "All Subjects - Left college" /
 * "—" (not struck off). Uses a line break so multiple struck-off records in
 * the future (re-strike history) could stack readably in one cell.
 */
function formatStruckOffCell(struckOffInfo) {
  if (!struckOffInfo) return '—';
  const label = struckOffInfo.subjectName || 'All Subjects';
  return struckOffInfo.reason ? `${label} - ${struckOffInfo.reason}` : label;
}

function addReportHeader(sheet, { settings, examination, klass }, mergeWidth = 8) {
  let row = 1;
  const addTitle = (text, size = 14, bold = true) => {
    sheet.mergeCells(row, 1, row, mergeWidth);
    const cell = sheet.getCell(row, 1);
    cell.value = text;
    cell.font = { size, bold, color: { argb: 'FF1F3B57' } };
    cell.alignment = { horizontal: 'center' };
    row += 1;
  };

  addTitle(settings?.collegeName || 'College Result Management System', 16);
  if (settings?.address || settings?.city) {
    addTitle([settings.address, settings.city, settings.province, settings.country].filter(Boolean).join(', '), 10, false);
  }
  addTitle(
    `${klass.name}${klass.section ? ` — Section ${klass.section}` : ''}  |  Academic Session: ${examination.academicSession}`,
    12
  );
  addTitle(`${examination.name} (${examination.examType})  —  Result Date: ${new Date(examination.resultDate).toDateString()}`, 11, false);
  addTitle(`Report Generated: ${new Date().toDateString()}`, 8, false);
  row += 1;
  return row;
}

/**
 * Builds the traditional college record-sheet layout: subject columns are
 * grouped under a merged "Subject: Teacher" header, with "T.Lec N" beneath
 * it, and the two real student-level columns (Att, Test) under that.
 * Attendance is always the actual lecture count — never a percentage.
 */
function buildResultSheet(workbook, { settings, examination, klass, result, fatherContactByStudentId }) {
  const sheet = workbook.addWorksheet('Result');
  const subjects = examination.subjects;

  const LEFT_HEADERS = ['R#', 'Name of Students', "Father's Contact"];
  const RIGHT_HEADERS = [
    'Total Obtained',
    'Total Possible',
    'Percentage',
    'Rank',
    'Failed Subject(s)',
    'Overall Result',
    'Struck Off in Subject(s)',
  ];
  const leftCount = LEFT_HEADERS.length;
  const rightCount = RIGHT_HEADERS.length;
  const totalCols = leftCount + subjects.length * 2 + rightCount;

  const titleEndRow = addReportHeader(sheet, { settings, examination, klass }, totalCols);

  // Teacher name + total lectures delivered per subject, pulled from any
  // student's snapshot (identical for every student in that subject).
  const subjectMeta = subjects.map((subj) => {
    const withData = result.students.find((s) =>
      s.subjectResults.some((sr) => sr.subjectName === subj.name && sr.lecturesDelivered != null)
    );
    const sr = withData?.subjectResults.find((x) => x.subjectName === subj.name);
    return { name: subj.name, teacherName: sr?.teacherName || '', lecturesDelivered: sr?.lecturesDelivered ?? null };
  });

  const rowA = titleEndRow; // Subject: Teacher
  const rowB = rowA + 1; // T.Lec N
  const rowC = rowB + 1; // Att | Test

  // Left fixed columns span all three header rows vertically.
  LEFT_HEADERS.forEach((label, i) => {
    const col = i + 1;
    sheet.mergeCells(rowA, col, rowC, col);
    const cell = sheet.getCell(rowA, col);
    cell.value = label;
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = CENTER;
  });

  // Subject groups
  subjectMeta.forEach((subj, j) => {
    const colStart = leftCount + j * 2 + 1;
    const colEnd = colStart + 1;

    sheet.mergeCells(rowA, colStart, rowA, colEnd);
    const groupCell = sheet.getCell(rowA, colStart);
    groupCell.value = subj.teacherName ? `${subj.name}: ${subj.teacherName}` : subj.name;
    groupCell.fill = HEADER_FILL;
    groupCell.font = HEADER_FONT;
    groupCell.alignment = CENTER;

    sheet.mergeCells(rowB, colStart, rowB, colEnd);
    const lecCell = sheet.getCell(rowB, colStart);
    lecCell.value = `T.Lec ${subj.lecturesDelivered ?? '—'}`;
    lecCell.fill = SUBHEADER_FILL;
    lecCell.font = { bold: true, color: { argb: 'FF1F3B57' }, size: 9 };
    lecCell.alignment = CENTER;

    const attCell = sheet.getCell(rowC, colStart);
    attCell.value = 'Att';
    const testCell = sheet.getCell(rowC, colEnd);
    testCell.value = 'Test';
    [attCell, testCell].forEach((c) => {
      c.fill = SUBHEADER_FILL;
      c.font = { bold: true, color: { argb: 'FF1F3B57' }, size: 9 };
      c.alignment = CENTER;
    });
  });

  // Right fixed columns, also spanning all three header rows.
  RIGHT_HEADERS.forEach((label, i) => {
    const col = leftCount + subjects.length * 2 + i + 1;
    sheet.mergeCells(rowA, col, rowC, col);
    const cell = sheet.getCell(rowA, col);
    cell.value = label;
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = CENTER;
  });

  sheet.getRow(rowA).height = 32;
  sheet.getRow(rowB).height = 16;
  sheet.getRow(rowC).height = 16;

  // ---- Data rows ----
  let rowIdx = rowC + 1;
  const students = [...result.students].sort((a, b) => {
    if (a.statusAtFinalization !== b.statusAtFinalization) return a.statusAtFinalization === 'struck_off' ? 1 : -1;
    return (a.rank || 9999) - (b.rank || 9999);
  });

  students.forEach((s) => {
    const isStruckOff = s.statusAtFinalization === 'struck_off';
    const fatherContact = fatherContactByStudentId?.get(s.student.toString()) || '';

    let col = 1;
    const setCell = (value, alignment = CENTER) => {
      const cell = sheet.getCell(rowIdx, col);
      cell.value = value;
      cell.border = THIN_BORDER;
      cell.alignment = alignment;
      if (isStruckOff) cell.font = STRUCK_OFF_FONT;
      col += 1;
    };

    setCell(s.rollNumber);
    setCell(s.studentName, LEFT);
    setCell(fatherContact || '—');

    subjects.forEach((subj) => {
      const sr = s.subjectResults.find((x) => x.subjectName === subj.name);
      if (isStruckOff) {
        setCell('—');
        setCell('—');
      } else if (sr?.isAbsent) {
        setCell(sr.classesAttended ?? '—');
        setCell('Absent');
      } else {
        setCell(sr?.classesAttended ?? '—');
        setCell(sr?.obtainedMarks ?? '—');
      }
    });

    setCell(isStruckOff ? '—' : s.totalObtained ?? '—');
    setCell(isStruckOff ? '—' : s.totalPossible ?? '—');
    setCell(isStruckOff ? '—' : s.percentage != null ? `${s.percentage}%` : '—');
    setCell(isStruckOff ? '—' : s.rank ?? '—');
    setCell(isStruckOff ? '—' : s.failedSubjects && s.failedSubjects.length ? s.failedSubjects.join(', ') : '—');
    setCell(
      s.overallDecision === 'pass' ? 'PASSED' : s.overallDecision === 'fail' ? 'FAILED' : 'PENDING DECISION'
    );
    setCell(formatStruckOffCell(s.struckOffInfo));

    sheet.getRow(rowIdx).height = 18;
    rowIdx += 1;
  });

  // Column widths
  sheet.getColumn(1).width = 8; // R#
  sheet.getColumn(2).width = 24; // Name
  sheet.getColumn(3).width = 16; // Father's contact
  for (let j = 0; j < subjects.length; j++) {
    sheet.getColumn(leftCount + j * 2 + 1).width = 8; // Att
    sheet.getColumn(leftCount + j * 2 + 2).width = 8; // Test
  }
  const rightStart = leftCount + subjects.length * 2 + 1;
  sheet.getColumn(rightStart).width = 12; // Total Obtained
  sheet.getColumn(rightStart + 1).width = 12; // Total Possible
  sheet.getColumn(rightStart + 2).width = 11; // Percentage
  sheet.getColumn(rightStart + 3).width = 8; // Rank
  sheet.getColumn(rightStart + 4).width = 11; // Status
  sheet.getColumn(rightStart + 5).width = 22; // Struck off

  // Freeze the header rows and the first two identity columns so both stay
  // visible while scrolling through a wide subject list.
  sheet.views = [{ state: 'frozen', xSplit: 2, ySplit: rowC }];

  // Print setup: landscape, fit-to-width, repeat header rows, tight margins —
  // suitable for handing a printed copy to a principal/HOD.
  sheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
  };
  sheet.pageSetup.printArea = `A1:${sheet.getColumn(totalCols).letter}${rowIdx - 1}`;
  sheet.pageSetup.printTitlesRow = `${rowA}:${rowC}`;
}

function buildStatisticsSheet(workbook, { settings, examination, klass, result }) {
  const sheet = workbook.addWorksheet('Statistics');
  let row = addReportHeader(sheet, { settings, examination, klass }, 7);
  const stats = result.stats;

  sheet.mergeCells(row, 1, row, 4);
  sheet.getCell(row, 1).value = 'RESULT STATISTICS';
  sheet.getCell(row, 1).font = { bold: true, size: 12, color: { argb: 'FF1F3B57' } };
  row += 1;

  const summaryRows = [
    ['Total Students', stats.totalEnrolled],
    ['Active Students', stats.activeStudents],
    ['Struck Off Students', stats.struckOffStudents],
    ['Students Appeared', stats.appeared],
    ['Students Passed', stats.passed],
    ['— Automatically Passed', stats.autoPassed],
    ['— Explicitly Passed by Admin', stats.explicitlyPassed],
    ['Students Failed (Explicitly by Admin)', stats.explicitlyFailed],
    ['Pending Admin Decision', stats.pendingDecision],
    ['— With Failed Subject(s)', stats.studentsWithFailedSubjects],
    ['— With Active Strike-Off', stats.studentsWithActiveStrikeOff],
    ['Pass Percentage (of total enrolled)', stats.passingPercentage != null ? `${stats.passingPercentage}%` : '—'],
    ['Fail Percentage (of total enrolled)', stats.failingPercentage != null ? `${stats.failingPercentage}%` : '—'],
    ['Overall Average Percentage', stats.averagePercentage != null ? `${stats.averagePercentage}%` : '—'],
    ['Highest Percentage', stats.highestPercentage != null ? `${stats.highestPercentage}%` : '—'],
    ['Lowest Percentage', stats.lowestPercentage != null ? `${stats.lowestPercentage}%` : '—'],
    ['Highest Marks (Obtained)', stats.highestMarks ?? '—'],
    ['Lowest Marks (Obtained)', stats.lowestMarks ?? '—'],
    ['Average Marks (Obtained)', stats.averageMarks ?? '—'],
    ['Highest Scorer', stats.highestScorer || '—'],
    ['Lowest Scorer', stats.lowestScorer || '—'],
  ];
  summaryRows.forEach(([label, value]) => {
    sheet.getCell(row, 1).value = label;
    sheet.getCell(row, 1).font = { bold: true };
    sheet.getCell(row, 2).value = value;
    row += 1;
  });

  row += 1;
  sheet.mergeCells(row, 1, row, 7);
  sheet.getCell(row, 1).value = 'SUBJECT-WISE STATISTICS';
  sheet.getCell(row, 1).font = { bold: true, size: 12, color: { argb: 'FF1F3B57' } };
  row += 1;

  const subjHeaderRow = row;
  sheet.getRow(subjHeaderRow).values = ['Subject', 'Average', 'Highest', 'Lowest', 'Passed', 'Failed', 'Pass %', 'Fail %'];
  sheet.getRow(subjHeaderRow).eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
  });
  row += 1;

  stats.subjectStats.forEach((ss) => {
    sheet.getRow(row).values = [
      ss.subjectName,
      ss.average ?? '—',
      ss.highest ?? '—',
      ss.lowest ?? '—',
      ss.passed ?? '—',
      ss.failed ?? '—',
      ss.passingPercentage != null ? `${ss.passingPercentage}%` : '—',
      ss.failingPercentage != null ? `${ss.failingPercentage}%` : '—',
    ];
    row += 1;
  });

  sheet.columns.forEach((c) => {
    c.width = 18;
  });
  sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
}

/**
 * Traditional college record-sheet workbook: Result (grouped subject
 * headers, T.Lec, raw Att/Test columns) + Statistics.
 */
async function buildExamResultWorkbook({ settings, examination, klass, result, fatherContactByStudentId }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = settings?.collegeName || 'College Result Management System';
  workbook.created = new Date();

  buildResultSheet(workbook, { settings, examination, klass, result, fatherContactByStudentId });
  buildStatisticsSheet(workbook, { settings, examination, klass, result });

  return workbook;
}

module.exports = { buildExamResultWorkbook };
