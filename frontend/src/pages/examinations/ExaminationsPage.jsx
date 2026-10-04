import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Copy, FileText, Layers } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/ui/PageContainer.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import { ExamStatusBadge } from '../../components/ui/Badge.jsx';
import { SkeletonTable } from '../../components/ui/Skeleton.jsx';
import { EmptyState, ErrorState } from '../../components/ui/EmptyState.jsx';
import { examinationService } from '../../services/examinationService.js';
import { classService } from '../../services/classService.js';
import ExamWizardModal from './ExamWizardModal.jsx';
import CreateFromPreviousModal from './CreateFromPreviousModal.jsx';
import BulkExamModal from './BulkExamModal.jsx';

function ProgressBar({ submitted, total }) {
  const pct = total > 0 ? Math.round((submitted / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="h-1.5 flex-1 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full bg-brand-gradient rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400 shrink-0">
        {submitted}/{total}
      </span>
    </div>
  );
}

export default function ExaminationsPage() {
  const [classes, setClasses] = useState([]);
  const [exams, setExams] = useState(null);
  const [error, setError] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [fromPreviousExam, setFromPreviousExam] = useState(null);

  useEffect(() => {
    classService.list().then((res) => setClasses(res.data));
  }, []);

  const load = () => {
    setError(false);
    examinationService
      .list()
      .then((res) => setExams(res.data))
      .catch(() => setError(true));
  };

  useEffect(load, []);

  return (
    <PageContainer>
      <PageHeader
        title="Examinations"
        description="Create exams, generate secure teacher links, and track submissions."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" icon={Layers} onClick={() => setBulkModalOpen(true)}>
              Bulk Create Exams
            </Button>
            <Button icon={Plus} onClick={() => setWizardOpen(true)}>
              Create Exam
            </Button>
          </div>
        }
      />

      {error ? (
        <ErrorState description="We couldn't load examinations." onRetry={load} />
      ) : exams === null ? (
        <SkeletonTable rows={6} cols={5} />
      ) : exams.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No examinations yet"
          description="Create your first examination to start collecting results."
          action={
            <div className="flex items-center gap-2">
              <Button variant="secondary" icon={Layers} onClick={() => setBulkModalOpen(true)}>
                Bulk Create Exams
              </Button>
              <Button icon={Plus} onClick={() => setWizardOpen(true)}>
                Create Exam
              </Button>
            </div>
          }
        />
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Examination</th>
                  <th>Class</th>
                  <th>Result Date</th>
                  <th>Progress</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {exams.map((exam) => (
                  <tr key={exam._id}>
                    <td>
                      <Link to={`/examinations/${exam._id}`} className="font-medium text-brand-600 hover:underline">
                        {exam.name}
                      </Link>
                      <p className="text-xs text-gray-400">{exam.examType}</p>
                    </td>
                    <td className="text-gray-500">
                      {exam.class?.name}
                      {exam.class?.section ? ` — ${exam.class.section}` : ''}
                    </td>
                    <td className="text-gray-500">{new Date(exam.resultDate).toLocaleDateString()}</td>
                    <td>
                      <ProgressBar submitted={exam.submissionProgress.submitted} total={exam.submissionProgress.total} />
                    </td>
                    <td>
                      <ExamStatusBadge status={exam.status} />
                    </td>
                    <td>
                      <Button size="sm" variant="ghost" icon={Copy} onClick={() => setFromPreviousExam(exam)}>
                        Copy
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <ExamWizardModal open={wizardOpen} onClose={() => setWizardOpen(false)} classes={classes} onCreated={load} />
      <BulkExamModal
        open={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        classes={classes}
        onCreated={load}
      />
      <CreateFromPreviousModal
        open={!!fromPreviousExam}
        onClose={() => setFromPreviousExam(null)}
        sourceExam={fromPreviousExam}
        onCreated={load}
      />
    </PageContainer>
  );
}
