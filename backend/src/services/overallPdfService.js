const PDFDocument = require('pdfkit');
const { drawTable, addPageNumbers, MARGIN, DARK } = require('./pdfService');

function buildOverallReportPdf({ settings, report }) {
  const doc = new PDFDocument({ margin: MARGIN, size: 'A4', layout: 'landscape', bufferPages: true });

  doc.fontSize(16).fillColor(DARK).text(settings?.collegeName || 'College Result Management System', { align: 'center' });
  doc.fontSize(13).text('Overall Performance Report', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(9).fillColor('#555');
  report.examinations.forEach((e) => {
    doc.text(`${e.name} — ${e.className} (${new Date(e.resultDate).toDateString()})`, { align: 'center' });
  });
  doc.moveDown(1);

  report.classes.forEach((section, idx) => {
    if (idx > 0) doc.addPage({ layout: 'landscape', margin: MARGIN });
    doc.fontSize(13).fillColor(DARK).text(`Class: ${section.class.name}`, MARGIN);
    doc.moveDown(0.3);

    doc.fontSize(11).text('Examination-wise Statistics', MARGIN);
    const examRows = section.examinations.map((e) => [
      e.name,
      e.stats?.appeared ?? '-',
      e.stats?.passed ?? '-',
      e.stats?.failed ?? '-',
      e.stats?.passingPercentage != null ? `${e.stats.passingPercentage}%` : '-',
      e.stats?.averagePercentage != null ? `${e.stats.averagePercentage}%` : '-',
    ]);
    let y = drawTable(doc, {
      headers: ['Examination', 'Appeared', 'Passed', 'Failed', 'Passing %', 'Average %'],
      rows: examRows,
      colWidths: [160, 90, 90, 90, 90, 90],
      startY: doc.y + 6,
    });

    y += 20;
    if (y > doc.page.height - 150) {
      doc.addPage({ layout: 'landscape', margin: MARGIN });
      y = MARGIN;
    }
    doc.fontSize(11).fillColor(DARK).text('Student Performance Trend', MARGIN, y);
    y += 16;

    const examNames = section.examinations.map((e) => e.name);
    const trendRows = section.studentTrends
      .sort((a, b) => b.overallAverage - a.overallAverage)
      .map((t) => {
        const byExamMap = new Map(t.byExam.map((b) => [b.examinationName, b.percentage]));
        return [
          t.rollNumber,
          t.studentName,
          ...examNames.map((name) => (byExamMap.has(name) ? `${byExamMap.get(name)}%` : '-')),
          `${t.overallAverage}%`,
          t.trend,
        ];
      });
    const trendColWidths = [50, 110, ...examNames.map(() => 70), 70, 70];
    drawTable(doc, {
      headers: ['Roll', 'Name', ...examNames, 'Avg', 'Trend'],
      rows: trendRows,
      colWidths: trendColWidths,
      startY: y,
    });
  });

  if (report.subjectComparison.length > 0) {
    doc.addPage({ layout: 'landscape', margin: MARGIN });
    doc.fontSize(13).fillColor(DARK).text('Subject-wise Comparison Across Classes', MARGIN);
    const allClassNames = report.classes.map((c) => c.class.name);
    const rows = report.subjectComparison.map((sc) => {
      const byClass = new Map(sc.perClass.map((p) => [p.className, p.average]));
      return [sc.subjectName, ...allClassNames.map((cn) => (byClass.has(cn) ? byClass.get(cn) : '-'))];
    });
    drawTable(doc, {
      headers: ['Subject', ...allClassNames],
      rows,
      colWidths: [140, ...allClassNames.map(() => 100)],
      startY: doc.y + 10,
    });
  }

  if (report.overallStats) {
    doc.addPage({ layout: 'landscape', margin: MARGIN });
    doc.fontSize(13).fillColor(DARK).text('Combined Overall Statistics', MARGIN);
    const os = report.overallStats;
    let y = doc.y + 10;
    doc.fontSize(9).fillColor('#000');
    [
      `Total Students: ${os.totalStudents}    Appeared: ${os.appeared}    Passed: ${os.passed}    Failed: ${os.failed}`,
      `Pass %: ${os.passingPercentage}%    Fail %: ${os.failingPercentage}%    Average %: ${os.averagePercentage}%`,
      `Highest %: ${os.highestPercentage}%    Lowest %: ${os.lowestPercentage}%`,
      `Highest Overall Marks: ${os.highestMarks ?? '-'}    Lowest Overall Marks: ${os.lowestMarks ?? '-'}`,
      `Attendance — Average: ${os.attendanceAverage ?? '-'}%    Highest: ${os.attendanceHighest ?? '-'}%    Lowest: ${os.attendanceLowest ?? '-'}%`,
    ].forEach((line) => {
      doc.text(line, MARGIN, y);
      y += 16;
    });
  }

  report.classes.forEach((section) => {
    if (section.topPerformers.length === 0) return;
    doc.addPage({ layout: 'landscape', margin: MARGIN });
    doc.fontSize(13).fillColor(DARK).text(`Top Performers — ${section.class.name}`, MARGIN);
    let y = drawTable(doc, {
      headers: ['Rank', 'Roll', 'Name', 'Overall Average'],
      rows: section.topPerformers.map((t) => [t.rank, t.rollNumber, t.studentName, `${t.overallAverage}%`]),
      colWidths: [60, 70, 160, 120],
      startY: doc.y + 10,
    });
    if (section.needsAttention.length > 0) {
      y += 24;
      doc.fontSize(11).fillColor('#B00020').text('Students Needing Attention', MARGIN, y);
      y += 16;
      drawTable(doc, {
        headers: ['Roll', 'Name', 'Overall Average', 'Trend'],
        rows: section.needsAttention.map((t) => [t.rollNumber, t.studentName, `${t.overallAverage}%`, t.trend]),
        colWidths: [70, 160, 120, 100],
        startY: y,
      });
    }
  });

  addPageNumbers(doc);
  doc.end();
  return doc;
}

module.exports = { buildOverallReportPdf };
