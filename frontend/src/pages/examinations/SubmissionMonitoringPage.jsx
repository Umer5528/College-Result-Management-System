import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/ui/PageContainer.jsx';
import Card from '../../components/ui/Card.jsx';
import { SkeletonCard } from '../../components/ui/Skeleton.jsx';
import { EmptyState, ErrorState } from '../../components/ui/EmptyState.jsx';
import { examinationService } from '../../services/examinationService.js';

const ACTIVE_STATUSES = ['submission_open', 'submission_in_progress', 'ready_for_review'];

export default function SubmissionMonitoringPage() {
  const [exams, setExams] = useState(null);
  const [error, setError] = useState(false);

  const load = () => {
    setError(false);
    examinationService
      .list()
      .then((res) => setExams(res.data.filter((e) => ACTIVE_STATUSES.includes(e.status))))
      .catch(() => setError(true));
  };

  useEffect(load, []);

  return (
    <PageContainer>
      <PageHeader title="Submission Monitoring" description="Live progress for every examination currently collecting results." />

      {error ? (
        <ErrorState description="We couldn't load submission progress." onRetry={load} />
      ) : exams === null ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : exams.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nothing in progress"
          description="Once you generate a submission link for an exam, its progress will show up here."
        />
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {exams.map((exam) => {
            const pct =
              exam.submissionProgress.total > 0
                ? Math.round((exam.submissionProgress.submitted / exam.submissionProgress.total) * 100)
                : 0;
            return (
              <Link key={exam._id} to={`/examinations/${exam._id}`}>
                <Card hover>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-gray-900">{exam.name}</p>
                      <p className="text-xs text-gray-500">
                        {exam.class?.name}
                        {exam.class?.section ? ` — ${exam.class.section}` : ''}
                      </p>
                    </div>
                    <span className="text-lg font-bold text-brand-600">{pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full bg-brand-gradient rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    {exam.submissionProgress.submitted} of {exam.submissionProgress.total} subjects submitted
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
