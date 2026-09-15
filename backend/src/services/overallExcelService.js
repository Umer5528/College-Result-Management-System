const ExcelJS = require('exceljs');

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' } };

function addTitleBlock(sheet, { settings, report }, mergeWidth = 6) {
  let row = 1;
  sheet.mergeCells(row, 1, row, mergeWidth);
  sheet.getCell(row, 1).value = settings?.collegeName || 'College Result Management System';
  sheet.getCell(row, 1).font = { bold: true, size: 16 };
  sheet.getCell(row, 1).alignment = { horizontal: 'center' };
  row += 1;

  sheet.mergeCells(row, 1, row, mergeWidth);
  sheet.getCell(row, 1).value = 'Overall Performance Report';
  sheet.getCell(row, 1).font = { bold: true, size: 13 };
  sheet.getCell(row, 1).alignment = { horizontal: 'center' };
  row += 1;

  sheet.mergeCells(row, 1, row, mergeWidth);
  sheet.getCell(row, 1).value = `Report Generated: ${new Date().toDateString()}`;
  sheet.getCell(row, 1).font = { size: 8, color: { argb: 'FF888888' } };
  sheet.getCell(row, 1).alignment = { horizontal: 'center' };
  row += 2;
  return row;
}

function styleHeaderRow(sheet, rowIndex) {
  sheet.getRow(rowIndex).eachCell((c) => {
    c.fill = HEADER_FILL;
    c.font = HEADER_FONT;
  });
}

async function buildOverallReportWorkbook({ settings, report }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = settings?.collegeName || 'College Result Management System';
  workbook.created = new Date();

  // ---------- Sheet 1: Overall Student Performance ----------
  const perfSheet = workbook.addWorksheet('Overall Student Performance');
  let row = addTitleBlock(perfSheet, { settings, report });

  report.classes.forEach((section) => {
    perfSheet.mergeCells(row, 1, row, 6);
    perfSheet.getCell(row, 1).value = `Class: ${section.class.name}${section.class.section ? ` — Section ${section.class.section}` : ''}`;
    perfSheet.getCell(row, 1).font = { bold: true, size: 12 };
    row += 1;

    const examNames = section.examinations.map((e) => e.name);
    const headerRow = row;
    perfSheet.getRow(headerRow).values = ['Roll No', 'Student Name', ...examNames, 'Overall Average', 'Rank', 'Trend'];
    styleHeaderRow(perfSheet, headerRow);
    row += 1;

    section.studentTrends.forEach((t) => {
      const byExamMap = new Map(t.byExam.map((b) => [b.examinationName, b.percentage]));
      perfSheet.getRow(row).values = [
        t.rollNumber,
        t.studentName,
        ...examNames.map((n) => (byExamMap.has(n) ? `${byExamMap.get(n)}%` : '—')),
        `${t.overallAverage}%`,
        t.rank,
        t.trend,
      ];
      row += 1;
    });
    row += 1;
  });
  perfSheet.columns.forEach((c) => (c.width = 16));
  perfSheet.getColumn(2).width = 24;

  // ---------- Sheet 2: Examination Statistics (comparison) ----------
  const examSheet = workbook.addWorksheet('Examination Statistics');
  row = addTitleBlock(examSheet, { settings, report });
  report.classes.forEach((section) => {
    examSheet.mergeCells(row, 1, row, 6);
    examSheet.getCell(row, 1).value = `Class: ${section.class.name}${section.class.section ? ` — Section ${section.class.section}` : ''}`;
    examSheet.getCell(row, 1).font = { bold: true, size: 12 };
    row += 1;
    const headerRow = row;
    examSheet.getRow(headerRow).values = ['Examination', 'Appeared', 'Passed', 'Failed', 'Passing %', 'Average %'];
    styleHeaderRow(examSheet, headerRow);
    row += 1;
    section.examinations.forEach((e) => {
      examSheet.getRow(row).values = [
        e.name,
        e.stats?.appeared ?? '—',
        e.stats?.passed ?? '—',
        e.stats?.failed ?? '—',
        e.stats?.passingPercentage != null ? `${e.stats.passingPercentage}%` : '—',
        e.stats?.averagePercentage != null ? `${e.stats.averagePercentage}%` : '—',
      ];
      row += 1;
    });
    row += 1;
  });
  if (report.overallStats) {
    examSheet.mergeCells(row, 1, row, 6);
    examSheet.getCell(row, 1).value = 'COMBINED OVERALL STATISTICS (all selected classes & examinations)';
    examSheet.getCell(row, 1).font = { bold: true, size: 12 };
    row += 1;
    const os = report.overallStats;
    [
      ['Total Students', os.totalStudents],
      ['Students Appeared', os.appeared],
      ['Students Passed', os.passed],
      ['Students Failed', os.failed],
      ['Overall Pass Percentage', `${os.passingPercentage}%`],
      ['Overall Fail Percentage', `${os.failingPercentage}%`],
      ['Average Percentage', `${os.averagePercentage}%`],
      ['Highest Percentage', `${os.highestPercentage}%`],
      ['Lowest Percentage', `${os.lowestPercentage}%`],
      ['Highest Overall Marks', os.highestMarks ?? '—'],
      ['Lowest Overall Marks', os.lowestMarks ?? '—'],
    ].forEach(([label, value]) => {
      examSheet.getCell(row, 1).value = label;
      examSheet.getCell(row, 1).font = { bold: true };
      examSheet.getCell(row, 2).value = value;
      row += 1;
    });
  }
  examSheet.columns.forEach((c) => (c.width = 20));

  // ---------- Sheet 3: Subject Statistics ----------
  if (report.subjectComparison.length > 0) {
    const subjSheet = workbook.addWorksheet('Subject Statistics');
    row = addTitleBlock(subjSheet, { settings, report });
    subjSheet.mergeCells(row, 1, row, 4);
    subjSheet.getCell(row, 1).value = 'SUBJECT-WISE COMPARISON ACROSS CLASSES (matching subject names)';
    subjSheet.getCell(row, 1).font = { bold: true, size: 12 };
    row += 2;
    const allClassNames = report.classes.map((c) => c.class.name);
    const headerRow = row;
    subjSheet.getRow(headerRow).values = ['Subject', ...allClassNames];
    styleHeaderRow(subjSheet, headerRow);
    row += 1;
    report.subjectComparison.forEach((sc) => {
      const byClass = new Map(sc.perClass.map((p) => [p.className, p.average]));
      subjSheet.getRow(row).values = [sc.subjectName, ...allClassNames.map((cn) => (byClass.has(cn) ? byClass.get(cn) : '—'))];
      row += 1;
    });
    subjSheet.columns.forEach((c) => (c.width = 18));
  }

  // ---------- Sheet 4: Attendance Statistics ----------
  const attSheet = workbook.addWorksheet('Attendance Statistics');
  row = addTitleBlock(attSheet, { settings, report });
  if (report.overallStats) {
    const os = report.overallStats;
    attSheet.mergeCells(row, 1, row, 4);
    attSheet.getCell(row, 1).value = 'COMBINED ATTENDANCE STATISTICS';
    attSheet.getCell(row, 1).font = { bold: true, size: 12 };
    row += 1;
    [
      ['Attendance Average', os.attendanceAverage != null ? `${os.attendanceAverage}%` : '—'],
      ['Attendance Highest', os.attendanceHighest != null ? `${os.attendanceHighest}%` : '—'],
      ['Attendance Lowest', os.attendanceLowest != null ? `${os.attendanceLowest}%` : '—'],
    ].forEach(([label, value]) => {
      attSheet.getCell(row, 1).value = label;
      attSheet.getCell(row, 1).font = { bold: true };
      attSheet.getCell(row, 2).value = value;
      row += 1;
    });
  }
  attSheet.columns.forEach((c) => (c.width = 22));

  // ---------- Sheet 5: Rankings ----------
  const rankSheet = workbook.addWorksheet('Rankings');
  row = addTitleBlock(rankSheet, { settings, report });
  report.classes.forEach((section) => {
    rankSheet.mergeCells(row, 1, row, 4);
    rankSheet.getCell(row, 1).value = `Top Performers — ${section.class.name}`;
    rankSheet.getCell(row, 1).font = { bold: true, size: 12 };
    row += 1;
    const headerRow = row;
    rankSheet.getRow(headerRow).values = ['Rank', 'Roll No', 'Student Name', 'Overall Average'];
    styleHeaderRow(rankSheet, headerRow);
    row += 1;
    section.topPerformers.forEach((t) => {
      rankSheet.getRow(row).values = [t.rank, t.rollNumber, t.studentName, `${t.overallAverage}%`];
      row += 1;
    });
    row += 1;

    if (section.needsAttention.length > 0) {
      rankSheet.mergeCells(row, 1, row, 4);
      rankSheet.getCell(row, 1).value = `Students Needing Attention — ${section.class.name}`;
      rankSheet.getCell(row, 1).font = { bold: true, size: 12, color: { argb: 'FFB00020' } };
      row += 1;
      const attnHeaderRow = row;
      rankSheet.getRow(attnHeaderRow).values = ['Roll No', 'Student Name', 'Overall Average', 'Trend'];
      styleHeaderRow(rankSheet, attnHeaderRow);
      row += 1;
      section.needsAttention.forEach((t) => {
        rankSheet.getRow(row).values = [t.rollNumber, t.studentName, `${t.overallAverage}%`, t.trend];
        row += 1;
      });
      row += 1;
    }
  });
  rankSheet.columns.forEach((c) => (c.width = 20));

  return workbook;
}

module.exports = { buildOverallReportWorkbook };
