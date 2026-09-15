import React, { useEffect, useState } from 'react';
import { BarChart3, FileSpreadsheet, FileText, Search } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/ui/PageContainer.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { PassFailBadge, RankDisplay } from '../../components/ui/Badge.jsx';
import { EmptyState, ErrorState } from '../../components/ui/EmptyState.jsx';
import { PageLoader } from '../../components/ui/Loading.jsx';
import { classService } from '../../services/classService.js';
import { examinationService } from '../../services/examinationService.js';
import { reportService } from '../../services/reportServices.js';
import { useToast } from '../../context/ToastContext.jsx';

function TrendTag({ trend }) {
  const tone = trend === 'Improving' ? 'text-success-600' : trend === 'Declining' ? 'text-danger-600' : 'text-gray-400';
  return <span className={`text-xs font-semibold ${tone}`}>{trend}</span>;
}

export default function OverallReportsPage() {
  const toast = useToast();
  const [classes, setClasses] = useState([]);
  const [finalizedExams, setFinalizedExams] = useState([]);
  const [selectedClassIds, setSelectedClassIds] = useState([]);
  const [selectedExamIds, setSelectedExamIds] = useState([]);
  const [report, setReport] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [downloadingType, setDownloadingType] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    classService.list().then((res) => setClasses(res.data));
    examinationService
      .list({ status: 'finalized' })
      .then((res) => setFinalizedExams(res.data))
      .catch(() => setError(true));
  }, []);

  const toggleClass = (id) => {
    setSelectedClassIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const toggleExam = (id) => {
    setSelectedExamIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const selectAllClasses = () => setSelectedClassIds(selectedClassIds.length === classes.length ? [] : classes.map((c) => c._id));

  const visibleExams = selectedClassIds.length
    ? finalizedExams.filter((e) => selectedClassIds.includes(e.class?._id))
    : finalizedExams;

  const handleGenerate = async () => {
    if (selectedExamIds.length === 0) {
      toast.error('Select at least one examination');
      return;
    }
    setGenerating(true);
    try {
      const res = await reportService.overall({ examinationIds: selectedExamIds, classIds: selectedClassIds });
      setReport(res.data);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (type) => {
    setDownloadingType(type);
    try {
      const payload = { examinationIds: selectedExamIds, classIds: selectedClassIds };
      const res = type === 'excel' ? await reportService.overallExcel(payload) : await reportService.overallPdf(payload);
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', `Overall_Performance_Report.${type === 'excel' ? 'xlsx' : 'pdf'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
      toast.success('Report downloaded successfully.');
    } catch (err) {
      toast.error("We couldn't download the report. Please try again.");
    } finally {
      setDownloadingType(null);
    }
  };

  if (error) return <ErrorState description="We couldn't load examinations." onRetry={() => window.location.reload()} />;

  return (
    <PageContainer>
      <PageHeader title="Overall Reports" description="Compare performance across multiple examinations and classes." />

      <Card className="mb-6">
        <p className="label mb-2">1. Select Classes/Groups</p>
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={selectAllClasses}
            className={`badge ${selectedClassIds.length === classes.length ? 'bg-brand-500 text-white' : 'badge-neutral'}`}
          >
            Select All
          </button>
          {classes.map((c) => (
            <button
              key={c._id}
              onClick={() => toggleClass(c._id)}
              className={`badge ${selectedClassIds.includes(c._id) ? 'bg-brand-500 text-white' : 'badge-neutral'}`}
            >
              {c.name}
              {c.section ? ` — ${c.section}` : ''}
            </button>
          ))}
        </div>

        <p className="label mb-2">2. Select Examination(s)</p>
        {visibleExams.length === 0 ? (
          <p className="text-sm text-gray-400 mb-4">No finalized examinations match your class selection yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2 mb-4">
            {visibleExams.map((e) => (
              <button
                key={e._id}
                onClick={() => toggleExam(e._id)}
                className={`badge ${selectedExamIds.includes(e._id) ? 'bg-brand-500 text-white' : 'badge-neutral'}`}
              >
                {e.name} · {e.class?.name}
              </button>
            ))}
          </div>
        )}

        <Button icon={Search} loading={generating} onClick={handleGenerate}>
          Generate Report
        </Button>
      </Card>

      {generating ? (
        <PageLoader label="Generating report..." />
      ) : report ? (
        report.classes.length === 0 ? (
          <EmptyState icon={BarChart3} title="No data" description={report.message || 'No finalized examinations matched your selection.'} />
        ) : (
          <>
            <div className="flex justify-end gap-2 mb-6">
              <Button variant="secondary" icon={FileSpreadsheet} loading={downloadingType === 'excel'} disabled={!!downloadingType} onClick={() => handleDownload('excel')}>
                {downloadingType === 'excel' ? 'Generating Excel...' : 'Download Excel'}
              </Button>
              <Button variant="secondary" icon={FileText} loading={downloadingType === 'pdf'} disabled={!!downloadingType} onClick={() => handleDownload('pdf')}>
                {downloadingType === 'pdf' ? 'Generating PDF...' : 'Download PDF'}
              </Button>
            </div>

            {report.overallStats && (
              <Card className="mb-6">
                <h2 className="font-semibold text-gray-900 text-sm mb-3">Combined Overall Statistics</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-gray-400">Total Students</p>
                    <p className="font-semibold">{report.overallStats.totalStudents}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Appeared</p>
                    <p className="font-semibold">{report.overallStats.appeared}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Passed / Failed</p>
                    <p className="font-semibold">
                      {report.overallStats.passed} / {report.overallStats.failed}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Average %</p>
                    <p className="font-semibold">{report.overallStats.averagePercentage}%</p>
                  </div>
                </div>
              </Card>
            )}

            {report.classes.map((section) => (
              <Card key={section.class.id} className="mb-6 p-0 overflow-hidden">
                <div className="px-5 pt-5 pb-2">
                  <h2 className="font-semibold text-gray-900 text-sm">
                    {section.class.name}
                    {section.class.section ? ` — Section ${section.class.section}` : ''}
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="table-base">
                    <thead>
                      <tr>
                        <th>Roll No</th>
                        <th>Student</th>
                        {section.examinations.map((e) => (
                          <th key={e.examinationId}>{e.name}</th>
                        ))}
                        <th>Overall Avg</th>
                        <th>Rank</th>
                        <th>Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.studentTrends.map((t) => {
                        const byExam = new Map(t.byExam.map((b) => [b.examinationName, b.percentage]));
                        return (
                          <tr key={t.student}>
                            <td className="font-medium">{t.rollNumber}</td>
                            <td>{t.studentName}</td>
                            {section.examinations.map((e) => (
                              <td key={e.examinationId}>{byExam.has(e.name) ? `${byExam.get(e.name)}%` : '—'}</td>
                            ))}
                            <td className="font-semibold">{t.overallAverage}%</td>
                            <td><RankDisplay rank={t.rank} /></td>
                            <td>
                              <TrendTag trend={t.trend} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            ))}

            {report.subjectComparison.length > 0 && (
              <Card className="p-0 overflow-hidden">
                <div className="px-5 pt-5 pb-2">
                  <h2 className="font-semibold text-gray-900 text-sm">Subject Comparison Across Classes</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="table-base">
                    <thead>
                      <tr>
                        <th>Subject</th>
                        {report.classes.map((c) => (
                          <th key={c.class.id}>{c.class.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.subjectComparison.map((sc) => {
                        const byClass = new Map(sc.perClass.map((p) => [p.className, p.average]));
                        return (
                          <tr key={sc.subjectName}>
                            <td className="font-medium">{sc.subjectName}</td>
                            {report.classes.map((c) => (
                              <td key={c.class.id}>{byClass.has(c.class.name) ? `${byClass.get(c.class.name)}%` : '—'}</td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </>
        )
      ) : (
        <EmptyState icon={BarChart3} title="No report generated yet" description="Select classes and examinations above, then click Generate Report." />
      )}
    </PageContainer>
  );
}
