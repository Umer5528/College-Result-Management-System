import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/ui/PageContainer.jsx';
import Card from '../../components/ui/Card.jsx';
import { ExamStatusBadge } from '../../components/ui/Badge.jsx';
import { SkeletonTable } from '../../components/ui/Skeleton.jsx';
import { EmptyState, ErrorState } from '../../components/ui/EmptyState.jsx';
import { examinationService } from '../../services/examinationService.js';

export default function ResultsPage() {
  const [exams, setExams] = useState(null);
  const [error, setError] = useState(false);

  const load = () => {
    setError(false);
    examinationService
      .list()
      .then((res) => setExams(res.data.filter((e) => e.submissionProgress.submitted > 0)))
      .catch(() => setError(true));
  };

  useEffect(load, []);

  return (
    <PageContainer>
      <PageHeader title="Results" description="Review, finalize, and revisit examination results." />

      {error ? (
        <ErrorState description="We couldn't load results." onRetry={load} />
      ) : exams === null ? (
        <SkeletonTable rows={6} cols={4} />
      ) : exams.length === 0 ? (
        <EmptyState icon={Award} title="No results yet" description="Results appear here once at least one subject has been submitted." />
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Examination</th>
                  <th>Class</th>
                  <th>Progress</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {exams.map((exam) => (
                  <tr key={exam._id}>
                    <td>
                      <Link to={`/results/${exam._id}`} className="font-medium text-brand-600 hover:underline">
                        {exam.name}
                      </Link>
                    </td>
                    <td className="text-gray-500">
                      {exam.class?.name}
                      {exam.class?.section ? ` — ${exam.class.section}` : ''}
                    </td>
                    <td className="text-gray-500">
                      {exam.submissionProgress.submitted}/{exam.submissionProgress.total} subjects
                    </td>
                    <td>
                      <ExamStatusBadge status={exam.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </PageContainer>
  );
}
