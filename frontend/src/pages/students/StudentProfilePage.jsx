import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, User, Award } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/ui/PageContainer.jsx';
import Card from '../../components/ui/Card.jsx';
import { StudentStatusBadge, PassFailBadge } from '../../components/ui/Badge.jsx';
import { PageLoader } from '../../components/ui/Loading.jsx';
import { EmptyState, ErrorState } from '../../components/ui/EmptyState.jsx';
import { studentService } from '../../services/studentService.js';
import { getActiveStrikeOff } from '../../utils/strikeOff.js';

export default function StudentProfilePage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  const load = () => {
    setError(false);
    studentService
      .history(id)
      .then((res) => setData(res.data))
      .catch(() => setError(true));
  };

  useEffect(load, [id]);

  if (error) return <ErrorState description="We couldn't load this student's profile." onRetry={load} />;
  if (!data) return <PageLoader label="Loading student profile..." />;

  const { student, history } = data;

  return (
    <PageContainer>
      <Link to="/students" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3">
        <ArrowLeft className="h-4 w-4" /> Back to Students
      </Link>

      <Card className="mb-6">
        <div className="flex items-start gap-4">
          <span className="h-14 w-14 rounded-2xl bg-brand-gradient flex items-center justify-center shrink-0">
            <User className="h-7 w-7 text-white" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-gray-900">{student.name}</h1>
              <StudentStatusBadge
                status={student.status}
                subjectName={getActiveStrikeOff(student)?.subjectName}
                reason={getActiveStrikeOff(student)?.reason}
              />
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              Roll {student.rollNumber} · {student.class?.name}
              {student.class?.section ? ` — Section ${student.class.section}` : ''} · {student.academicSession}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-sm">
              <div>
                <p className="text-xs text-gray-400">Father's Name</p>
                <p className="font-medium text-gray-800">{student.fatherName || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Registration No.</p>
                <p className="font-medium text-gray-800">{student.registrationNumber || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Admission No.</p>
                <p className="font-medium text-gray-800">{student.admissionNumber || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Gender</p>
                <p className="font-medium text-gray-800 capitalize">{student.gender}</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold text-gray-900 text-sm mb-4">Result History</h2>
        {history.length === 0 ? (
          <EmptyState icon={Award} title="No finalized results yet" description="Results will appear here once examinations are finalized." />
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Examination</th>
                  <th>Class</th>
                  <th>Percentage</th>
                  <th>Rank</th>
                  <th>Failed Subject(s)</th>
                  <th>Overall Result</th>
                  <th>Student Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, idx) => (
                  <tr key={idx}>
                    <td className="font-medium text-gray-900">{h.examination?.name}</td>
                    <td className="text-gray-500">{h.examination?.class?.name}</td>
                    <td>{h.percentage != null ? `${h.percentage}%` : '—'}</td>
                    <td>{h.rank ?? '—'}</td>
                    <td>
                      {h.failedSubjects && h.failedSubjects.length ? (
                        <span className="text-danger-600 text-xs font-medium">{h.failedSubjects.join(', ')}</span>
                      ) : (
                        <span className="text-gray-400 text-xs">None</span>
                      )}
                    </td>
                    <td>
                      <PassFailBadge status={h.overallDecision} needsReview={h.needsReview} />
                    </td>
                    <td>
                      <StudentStatusBadge status={h.statusAtFinalization} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
