import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/ui/PageContainer.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import { PageLoader } from '../../components/ui/Loading.jsx';
import { ErrorState } from '../../components/ui/EmptyState.jsx';
import { examinationService } from '../../services/examinationService.js';
import { submissionService } from '../../services/reportServices.js';
import { useToast } from '../../context/ToastContext.jsx';

function calcAttendance(attended, total) {
  const a = Number(attended);
  const t = Number(total);
  if (!Number.isFinite(a) || !Number.isFinite(t) || t <= 0) return null;
  return Math.round(Math.min(100, Math.max(0, (a / t) * 100)) * 100) / 100;
}

export default function EditSubmissionPage() {
  const { id: examinationId, subjectId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [exam, setExam] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [error, setError] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [totalLectures, setTotalLectures] = useState('');
  const [entries, setEntries] = useState({});
  const [validationError, setValidationError] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRefs = useRef({});

  useEffect(() => {
    Promise.all([examinationService.get(examinationId), submissionService.get(examinationId, subjectId)])
      .then(([examRes, subRes]) => {
        setExam(examRes.data.examination);
        const sub = subRes.data;
        setSubmission(sub);
        setTeacherName(sub.teacherName);
        setTotalLectures(String(sub.totalLecturesDelivered));
        const initialEntries = {};
        sub.entries.forEach((e) => {
          if (e.statusAtSubmission === 'active') {
            initialEntries[e.student] = {
              classesAttended: e.classesAttended ?? '',
              obtainedMarks: e.isAbsent ? 'A' : e.obtainedMarks ?? '',
              rollNumber: e.rollNumber,
              studentName: e.studentName,
            };
          }
        });
        setEntries(initialEntries);
      })
      .catch((err) => setError(err?.response?.data?.message || "We couldn't load this submission."));
  }, [examinationId, subjectId]);

  const subjectConfig = exam?.subjects.find((s) => s.subject.toString() === subjectId);

  const updateEntry = (studentId, field, value) => {
    setEntries((prev) => ({ ...prev, [studentId]: { ...prev[studentId], [field]: value } }));
  };

  const handleSave = async () => {
    setValidationError('');
    const lectures = Number(totalLectures);
    if (!teacherName.trim()) {
      setValidationError('Teacher name is required');
      return;
    }
    if (!Number.isFinite(lectures) || lectures <= 0) {
      setValidationError('Total lectures delivered must be a positive number');
      return;
    }

    setSaving(true);
    try {
      await submissionService.update(examinationId, subjectId, {
        teacherName: teacherName.trim(),
        totalLecturesDelivered: lectures,
        entries: Object.entries(entries).map(([studentId, e]) => ({
          studentId,
          classesAttended: e.classesAttended,
          obtainedMarks: e.obtainedMarks,
        })),
      });
      toast.success(`${subjectConfig?.name} submission updated`);
      navigate(`/examinations/${examinationId}`);
    } catch (err) {
      setValidationError(err?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (error) return <ErrorState description={error} onRetry={() => window.location.reload()} />;
  if (!exam || !submission) return <PageLoader label="Loading submission..." />;

  const studentEntries = Object.entries(entries);

  return (
    <PageContainer>
      <Link to={`/examinations/${examinationId}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3">
        <ArrowLeft className="h-4 w-4" /> Back to Examination
      </Link>
      <PageHeader
        title={`Edit Submission — ${subjectConfig?.name}`}
        description={`${exam.name} · Correcting what the teacher submitted. Changes apply immediately.`}
      />

      <Card className="mb-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Input label="Teacher Name" value={teacherName} onChange={(e) => setTeacherName(e.target.value)} />
          <Input
            label="Total Lectures Delivered"
            type="number"
            min="1"
            value={totalLectures}
            onChange={(e) => setTotalLectures(e.target.value)}
          />
        </div>
      </Card>

      <Card>
        <div className="space-y-2.5">
          {studentEntries.map(([studentId, e], idx) => {
            const attendancePct = calcAttendance(e.classesAttended, totalLectures);
            return (
              <div key={studentId} className="rounded-xl border border-gray-200 p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-800">
                    {e.rollNumber} · {e.studentName}
                  </p>
                  {attendancePct !== null && <span className="text-xs font-semibold text-brand-600">{attendancePct}%</span>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min="0"
                    placeholder="Classes attended"
                    className="input"
                    value={e.classesAttended}
                    onChange={(ev) => updateEntry(studentId, 'classesAttended', ev.target.value)}
                    ref={(el) => (inputRefs.current[`att-${idx}`] = el)}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter') {
                        ev.preventDefault();
                        inputRefs.current[`marks-${idx}`]?.focus();
                      }
                    }}
                  />
                  <input
                    type="text"
                    placeholder={`Marks /${subjectConfig?.totalMarks} or "A"`}
                    className={`input ${
                      typeof e.obtainedMarks === 'string' && e.obtainedMarks.trim().toLowerCase() === 'a'
                        ? 'border-warning-400 bg-warning-50'
                        : ''
                    }`}
                    value={e.obtainedMarks}
                    onChange={(ev) => updateEntry(studentId, 'obtainedMarks', ev.target.value)}
                    ref={(el) => (inputRefs.current[`marks-${idx}`] = el)}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter') {
                        ev.preventDefault();
                        inputRefs.current[`att-${idx + 1}`]?.focus();
                      }
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {validationError && <p className="error-text mt-4">{validationError}</p>}

        <div className="flex justify-end mt-5">
          <Button icon={Save} loading={saving} onClick={handleSave}>
            Save Corrections
          </Button>
        </div>
      </Card>
    </PageContainer>
  );
}
