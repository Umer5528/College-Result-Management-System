import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Lock,
  RotateCcw,
  Trash2,
  Users,
  TrendingUp,
  Clock,
} from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/ui/PageContainer.jsx';
import Card, { StatCard } from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { PassFailBadge, StudentStatusBadge, RankDisplay } from '../../components/ui/Badge.jsx';
import { PageLoader } from '../../components/ui/Loading.jsx';
import { EmptyState, ErrorState } from '../../components/ui/EmptyState.jsx';
import ConfirmModal from '../../components/ui/ConfirmModal.jsx';
import OverallDecisionModal from './OverallDecisionModal.jsx';
import { resultService, reportService } from '../../services/reportServices.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { downloadFile } from '../../utils/downloadFile.js';

export default function ResultDetailPage() {
  const { examinationId } = useParams();
  const toast = useToast();
  const { isSuperAdmin } = useAuth();

  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [reopenConfirmOpen, setReopenConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [downloadingType, setDownloadingType] = useState(null);
  const [decisionTarget, setDecisionTarget] = useState(null);
  const [decisionLoading, setDecisionLoading] = useState(false);

  const load = () => {
    setError(false);
    resultService
      .get(examinationId)
      .then((res) => setData(res.data))
      .catch(() => setError(true));
  };

  useEffect(load, [examinationId]);

  const handleFinalize = async () => {
    setFinalizing(true);
    try {
      await resultService.finalize(examinationId);
      toast.success('Result finalized successfully');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setFinalizing(false);
    }
  };

  const handleReopen = async () => {
    setReopening(true);
    try {
      await resultService.reopen(examinationId);
      toast.success('Result reopened for correction');
      setReopenConfirmOpen(false);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setReopening(false);
    }
  };

  const handleDeleteResult = async () => {
    setDeleting(true);
    try {
      await resultService.delete(examinationId);
      toast.success('Finalized result deleted');
      setDeleteConfirmOpen(false);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const handleDecide = async (decision) => {
    setDecisionLoading(true);
    try {
      await resultService.setDecision(examinationId, decisionTarget.student, decision);
      toast.success(`${decisionTarget.studentName} marked overall ${decision === 'pass' ? 'Passed' : 'Failed'}`);
      setDecisionTarget(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setDecisionLoading(false);
    }
  };

  if (error) return <ErrorState description="We couldn't load this result." onRetry={load} />;
  if (!data) return <PageLoader label="Loading result..." />;

  const { examination, result, isFinalized, message } = data;

  return (
    <PageContainer>
      <Link to={`/examinations/${examinationId}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3">
        <ArrowLeft className="h-4 w-4" /> Back to Examination
      </Link>
      <PageHeader
        title={`${examination.name} — Result`}
        description={`${examination.class?.name}${examination.class?.section ? ` — Section ${examination.class.section}` : ''}`}
        actions={
          !result ? null : isFinalized ? (
            <>
              <Button
                variant="secondary"
                icon={FileSpreadsheet}
                loading={downloadingType === 'excel'}
                disabled={!!downloadingType}
                onClick={async () => {
                  setDownloadingType('excel');
                  await downloadFile(reportService.examExcelUrl(examinationId), `${examination.name.replace(/\s+/g, '_')}_Result.xlsx`, toast);
                  setDownloadingType(null);
                }}
              >
                {downloadingType === 'excel' ? 'Generating Excel...' : 'Download Excel'}
              </Button>
              <Button
                variant="secondary"
                icon={FileText}
                loading={downloadingType === 'pdf'}
                disabled={!!downloadingType}
                onClick={async () => {
                  setDownloadingType('pdf');
                  await downloadFile(reportService.examPdfUrl(examinationId), `${examination.name.replace(/\s+/g, '_')}_Result.pdf`, toast);
                  setDownloadingType(null);
                }}
              >
                {downloadingType === 'pdf' ? 'Generating PDF...' : 'Download PDF'}
              </Button>
              {isSuperAdmin && (
                <Button variant="danger" icon={RotateCcw} onClick={() => setReopenConfirmOpen(true)}>
                  Reopen
                </Button>
              )}
              <Button variant="danger" icon={Trash2} onClick={() => setDeleteConfirmOpen(true)}>
                Delete Result
              </Button>
            </>
          ) : (
            <Button icon={Lock} loading={finalizing} onClick={handleFinalize}>
              Finalize Result
            </Button>
          )
        }
      />

      {!result ? (
        <EmptyState icon={Award} title="Not ready yet" description={message} />
      ) : (
        <>
          {isFinalized && (
            <div className="flex items-center gap-2 rounded-xl bg-success-50 text-success-700 text-sm font-medium px-4 py-2.5 mb-6">
              <CheckCircle2 className="h-4 w-4" /> This result has been finalized.
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Total Students" value={result.stats.totalEnrolled} icon={Users} tone="brand" />
            <StatCard label="Appeared" value={result.stats.appeared} icon={Users} tone="brand" delay={0.03} />
            <StatCard label="Passed" value={result.stats.passed} icon={CheckCircle2} tone="success" delay={0.06} />
            <StatCard label="Failed" value={result.stats.failed} icon={Award} tone="danger" delay={0.09} />
            <StatCard label="Pending Decision" value={result.stats.pendingDecision} icon={Clock} tone="warning" delay={0.1} />
            <StatCard label="Struck Off" value={result.stats.struckOffStudents} icon={Users} tone="danger" delay={0.12} />
            <StatCard label="Average %" value={`${result.stats.averagePercentage ?? '—'}%`} icon={TrendingUp} tone="insight" delay={0.15} />
            <StatCard label="Highest %" value={`${result.stats.highestPercentage ?? '—'}%`} icon={TrendingUp} tone="success" delay={0.18} />
            <StatCard label="Lowest %" value={`${result.stats.lowestPercentage ?? '—'}%`} icon={TrendingUp} tone="warning" delay={0.21} />
          </div>

          <div className="grid sm:grid-cols-3 gap-4 mb-6 text-sm">
            <Card>
              <p className="text-xs text-gray-400">Highest / Lowest / Average Marks</p>
              <p className="font-semibold text-gray-900 mt-1">
                {result.stats.highestMarks ?? '—'} / {result.stats.lowestMarks ?? '—'} / {result.stats.averageMarks ?? '—'}
              </p>
            </Card>
            <Card>
              <p className="text-xs text-gray-400">Attendance Avg / High / Low</p>
              <p className="font-semibold text-gray-900 mt-1">
                {result.stats.attendanceAverage ?? '—'}% / {result.stats.attendanceHighest ?? '—'}% / {result.stats.attendanceLowest ?? '—'}%
              </p>
            </Card>
            <Card>
              <p className="text-xs text-gray-400">Pass % / Fail %</p>
              <p className="font-semibold text-gray-900 mt-1">
                {result.stats.passingPercentage ?? '—'}% / {result.stats.failingPercentage ?? '—'}%
              </p>
            </Card>
          </div>

          {/* Subject-wise statistics */}
          <Card className="mb-6 p-0 overflow-hidden">
            <div className="px-5 pt-5 pb-2">
              <h2 className="font-semibold text-gray-900 text-sm">Subject-Wise Statistics</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Average</th>
                    <th>Highest</th>
                    <th>Lowest</th>
                    <th>Passed</th>
                    <th>Failed</th>
                    <th>Pass %</th>
                    <th>Avg Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {result.stats.subjectStats.map((ss) => (
                    <tr key={ss.subject}>
                      <td className="font-medium">{ss.subjectName}</td>
                      <td>{ss.average ?? '—'}</td>
                      <td>{ss.highest ?? '—'}</td>
                      <td>{ss.lowest ?? '—'}</td>
                      <td>{ss.passed ?? '—'}</td>
                      <td>{ss.failed ?? '—'}</td>
                      <td>{ss.passingPercentage != null ? `${ss.passingPercentage}%` : '—'}</td>
                      <td>{ss.averageAttendance != null ? `${ss.averageAttendance}%` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Full result table */}
          <Card className="p-0 overflow-hidden">
            <div className="px-5 pt-5 pb-2">
              <h2 className="font-semibold text-gray-900 text-sm">Complete Result</h2>
            </div>
            <div className="overflow-auto max-h-[65vh]">
              <table className="table-base table-sticky-header">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Roll No</th>
                    <th>Student</th>
                    {examination.subjects.map((s) => (
                      <th key={s.subject}>{s.name}</th>
                    ))}
                    <th>Total</th>
                    <th>%</th>
                    <th>Failed Subject(s)</th>
                    <th>Struck Off</th>
                    <th>Overall Result</th>
                  </tr>
                </thead>
                <tbody>
                  {[...result.students]
                    .sort((a, b) => {
                      if (a.statusAtFinalization !== b.statusAtFinalization) return a.statusAtFinalization === 'struck_off' ? 1 : -1;
                      return (a.rank || 9999) - (b.rank || 9999);
                    })
                    .map((s) => {
                      const isStruckOff = s.statusAtFinalization === 'struck_off';
                      return (
                        <tr key={s.student} className={isStruckOff ? 'row-struck-off' : ''}>
                          <td>{isStruckOff ? <span className="text-gray-400">—</span> : <RankDisplay rank={s.rank} />}</td>
                          <td className="font-medium">{s.rollNumber}</td>
                          <td>{s.studentName}</td>
                          {examination.subjects.map((subj) => {
                            const sr = s.subjectResults.find((x) => x.subjectName === subj.name);
                            return (
                              <td key={subj.subject}>
                                {isStruckOff ? (
                                  <span className="text-danger-500 font-semibold text-xs">STRUCK OFF</span>
                                ) : sr?.isAbsent ? (
                                  <span className="text-warning-600 font-semibold text-xs">Absent</span>
                                ) : (
                                  <>
                                    {sr?.obtainedMarks ?? '—'}
                                    <span className="text-gray-400 text-xs"> ({sr?.classesAttended ?? '—'} att.)</span>
                                  </>
                                )}
                              </td>
                            );
                          })}
                          <td>{isStruckOff ? '—' : s.totalObtained ?? '—'}</td>
                          <td>{isStruckOff ? '—' : s.percentage != null ? `${s.percentage}%` : '—'}</td>
                          <td>
                            {isStruckOff ? (
                              '—'
                            ) : s.failedSubjects && s.failedSubjects.length ? (
                              <span className="text-danger-600 text-xs font-medium">{s.failedSubjects.join(', ')}</span>
                            ) : (
                              <span className="text-gray-400 text-xs">None</span>
                            )}
                          </td>
                          <td>
                            {s.struckOffInfo ? (
                              <div>
                                <span className="text-danger-600 text-xs font-semibold">
                                  🔴 {s.struckOffInfo.subjectName || 'All Subjects'}
                                </span>
                                {s.struckOffInfo.reason && (
                                  <p className="text-[11px] text-danger-500">Reason: {s.struckOffInfo.reason}</p>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </td>
                          <td>
                            {isFinalized ? (
                              <button
                                onClick={() => setDecisionTarget(s)}
                                className="hover:opacity-80 transition-opacity"
                                title="Click to set the final overall decision"
                              >
                                <PassFailBadge status={s.overallDecision} needsReview={s.needsReview} />
                              </button>
                            ) : (
                              <PassFailBadge status={s.overallDecision} needsReview={s.needsReview} />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <ConfirmModal
        open={reopenConfirmOpen}
        onClose={() => setReopenConfirmOpen(false)}
        onConfirm={handleReopen}
        loading={reopening}
        title="Reopen Finalized Result"
        message="This will unlock the result for correction. You'll need to re-finalize it afterward. Continue?"
        confirmLabel="Reopen Result"
      />
      <ConfirmModal
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteResult}
        loading={deleting}
        title="Delete Finalized Result"
        message="This permanently deletes the finalized result. Teacher submissions are kept, so you can re-finalize later without anyone resubmitting. Continue?"
        confirmLabel="Delete Result"
      />
      <OverallDecisionModal
        open={!!decisionTarget}
        onClose={() => setDecisionTarget(null)}
        student={decisionTarget}
        onDecide={handleDecide}
        loading={decisionLoading}
      />
    </PageContainer>
  );
}
