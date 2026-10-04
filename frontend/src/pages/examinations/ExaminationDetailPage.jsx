import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Link2, Copy, Ban, RefreshCcw, CheckCircle2, Clock, Award, Pencil, Trash2 } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/ui/PageContainer.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { ExamStatusBadge } from '../../components/ui/Badge.jsx';
import { PageLoader } from '../../components/ui/Loading.jsx';
import { ErrorState } from '../../components/ui/EmptyState.jsx';
import ConfirmModal from '../../components/ui/ConfirmModal.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { examinationService } from '../../services/examinationService.js';
import { useToast } from '../../context/ToastContext.jsx';

export default function ExaminationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [disableConfirmOpen, setDisableConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    setError(false);
    examinationService
      .get(id)
      .then((res) => setData(res.data))
      .catch(() => setError(true));
  };

  useEffect(load, [id]);

  const handleGenerateLink = async () => {
    setActionLoading(true);
    try {
      const res = await examinationService.generateLink(id);
      setLinkUrl(res.data.url);
      toast.success('Teacher submission link generated');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisableLink = async () => {
    setActionLoading(true);
    try {
      await examinationService.disableLink(id);
      toast.success('Submission link disabled');
      setDisableConfirmOpen(false);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteExam = async () => {
    setDeleting(true);
    try {
      await examinationService.delete(id);
      toast.success(`"${data.examination.name}" has been permanently deleted`);
      navigate('/examinations', { replace: true });
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Something went wrong. Please try again.');
      setDeleting(false);
    }
  };

  if (error) return <ErrorState description="We couldn't load this examination." onRetry={load} />;
  if (!data) return <PageLoader label="Loading examination..." />;

  const { examination, submissions } = data;
  const submittedSubjectIds = new Set(submissions.map((s) => s.subject.toString()));
  const submittedCount = submittedSubjectIds.size;
  const total = examination.subjects.length;
  const allSubmitted = submittedCount === total;

  const activeUrl =
    linkUrl ||
    (examination?.isLinkActive && examination?.submissionToken
      ? `${window.location.origin}/submit-result/${examination.submissionToken}`
      : '');

  const copyLink = () => {
    const urlToCopy = activeUrl || linkUrl;
    if (!urlToCopy) return;
    navigator.clipboard.writeText(urlToCopy);
    toast.success('Link copied to clipboard');
  };

  return (
    <PageContainer>
      <Link to="/examinations" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3">
        <ArrowLeft className="h-4 w-4" /> Back to Examinations
      </Link>
      <PageHeader
        title={examination.name}
        description={`${examination.class?.name}${examination.class?.section ? ` — Section ${examination.class.section}` : ''} · ${new Date(
          examination.resultDate
        ).toDateString()}`}
        actions={
          <>
            <ExamStatusBadge status={examination.status} />
            <Button variant="danger" icon={Trash2} onClick={() => setDeleteConfirmOpen(true)}>
              Delete Exam
            </Button>
          </>
        }
      />

      <div className="grid lg:grid-cols-3 gap-6 min-w-0">
        {/* Submission link management */}
        <Card className="lg:col-span-2 min-w-0">
          <h2 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-2">
            <Link2 className="h-4 w-4" /> Teacher Submission Link
          </h2>
          {examination.isLinkActive ? (
            <div className="space-y-3 min-w-0">
              <p className="text-sm text-gray-500">
                Share this link with teachers so they can submit results — no account needed.
              </p>
              {activeUrl ? (
                <div className="flex items-center gap-2 rounded-xl bg-gray-50 border border-gray-200 p-2 sm:px-3.5 sm:py-2.5 min-w-0 max-w-full">
                  <input
                    type="text"
                    readOnly
                    value={activeUrl}
                    onFocus={(e) => e.target.select()}
                    className="flex-1 min-w-0 w-full bg-transparent text-xs font-mono text-gray-700 outline-none overflow-x-auto whitespace-nowrap cursor-text"
                    aria-label="Teacher submission link"
                  />
                  <Button size="sm" variant="secondary" icon={Copy} onClick={copyLink} className="shrink-0">
                    Copy
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-gray-400">The link is active. Regenerate below to get a fresh copy-able URL.</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" icon={RefreshCcw} loading={actionLoading} onClick={handleGenerateLink}>
                  Regenerate Link
                </Button>
                <Button size="sm" variant="danger" icon={Ban} onClick={() => setDisableConfirmOpen(true)}>
                  Disable Link
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-gray-500 mb-4">No active submission link yet.</p>
              <Button icon={Link2} loading={actionLoading} onClick={handleGenerateLink}>
                Generate Teacher Link
              </Button>
            </div>
          )}
        </Card>

        {/* Result action */}
        <Card className="min-w-0">
          <h2 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-2">
            <Award className="h-4 w-4" /> Result
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            {allSubmitted
              ? 'All subjects submitted — ready to review and finalize.'
              : `${submittedCount}/${total} subjects submitted so far.`}
          </p>
          <Button className="w-full" disabled={submittedCount === 0} onClick={() => navigate(`/results/${examination._id}`)}>
            {examination.status === 'finalized' ? 'View Finalized Result' : 'Review & Finalize Result'}
          </Button>
        </Card>
      </div>

      {/* Subject progress */}
      <Card className="mt-6">
        <h2 className="font-semibold text-gray-900 text-sm mb-4">Subject Submission Progress</h2>
        <div className="space-y-2">
          {examination.subjects.map((s) => {
            const submitted = submittedSubjectIds.has(s.subject.toString());
            const submission = submissions.find((sub) => sub.subject.toString() === s.subject.toString());
            return (
              <div
                key={s.subject}
                className="flex items-center justify-between rounded-xl border border-gray-100 px-3.5 py-2.5"
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">{s.name}</p>
                  {submission && <p className="text-xs text-gray-400">by {submission.teacherName}</p>}
                </div>
                {submitted ? (
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-success-600">
                      <CheckCircle2 className="h-4 w-4" /> Submitted
                    </span>
                    {examination.status !== 'finalized' && (
                      <Link to={`/examinations/${examination._id}/subjects/${s.subject}/edit`}>
                        <Button size="sm" variant="ghost" icon={Pencil}>
                          Edit
                        </Button>
                      </Link>
                    )}
                  </div>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-warning-600">
                    <Clock className="h-4 w-4" /> Pending
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <ConfirmModal
        open={disableConfirmOpen}
        onClose={() => setDisableConfirmOpen(false)}
        onConfirm={handleDisableLink}
        loading={actionLoading}
        title="Disable Submission Link"
        message="Teachers will no longer be able to use this link to submit results. You can generate a new one anytime."
        confirmLabel="Disable Link"
      />

      <Modal
        open={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setDeleteConfirmText('');
        }}
        title="Permanently Delete Examination"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setDeleteConfirmOpen(false);
                setDeleteConfirmText('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              icon={Trash2}
              disabled={deleteConfirmText.trim() !== examination.name}
              loading={deleting}
              onClick={handleDeleteExam}
            >
              Permanently Delete
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <p className="text-gray-600">
            This will <strong>completely and permanently delete</strong> "{examination.name}" — the examination itself,
            every teacher submission for it, and its finalized result (if any). This cannot be undone.
          </p>
          <ul className="list-disc pl-5 text-gray-500 space-y-1">
            <li>The examination record will vanish entirely</li>
            <li>All submitted marks and attendance for this exam will be deleted</li>
            <li>Any finalized result/report for this exam will be deleted</li>
            <li>The class, subjects, and students are not affected</li>
          </ul>
          <div>
            <label className="label">
              Type <strong>{examination.name}</strong> to confirm
            </label>
            <input
              className="input"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={examination.name}
              autoComplete="off"
            />
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}
