import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, ChevronRight, ChevronLeft, Send, RefreshCcw, BookOpen } from 'lucide-react';
import PublicShell from './PublicShell.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import { PageLoader } from '../../components/ui/Loading.jsx';
import { publicService } from '../../services/publicService.js';

function calcAttendance(attended, total) {
  const a = Number(attended);
  const t = Number(total);
  if (!Number.isFinite(a) || !Number.isFinite(t) || t <= 0) return null;
  return Math.round(Math.min(100, Math.max(0, (a / t) * 100)) * 100) / 100;
}

export default function SubmitResultPage() {
  const { token } = useParams();

  const [phase, setPhase] = useState('loading'); // loading | error | select | entry | success
  const [errorMessage, setErrorMessage] = useState('');
  const [examInfo, setExamInfo] = useState(null);

  const [selectedSubject, setSelectedSubject] = useState(null);
  const [roster, setRoster] = useState(null);
  const [rosterError, setRosterError] = useState('');

  const [teacherName, setTeacherName] = useState('');
  const [totalLectures, setTotalLectures] = useState('');
  const [entries, setEntries] = useState({}); // studentId -> { classesAttended, obtainedMarks }
  const [step, setStep] = useState('setup'); // setup | marks | review
  const [validationError, setValidationError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const inputRefs = useRef({});

  const loadExamInfo = () => {
    setPhase('loading');
    publicService
      .getExamInfo(token)
      .then((res) => {
        setExamInfo(res.data);
        setPhase('select');
      })
      .catch((err) => {
        setErrorMessage(err?.response?.data?.message || "We couldn't open this submission link. Please check the link and try again.");
        setPhase('error');
      });
  };

  useEffect(loadExamInfo, [token]);

  const handleSelectSubject = (subject) => {
    if (subject.alreadySubmitted) return;
    setSelectedSubject(subject);
    setRosterError('');
    setRoster(null);
    setTeacherName('');
    setTotalLectures('');
    setEntries({});
    setStep('setup');
    publicService
      .getSubjectRoster(token, subject.subjectId)
      .then((res) => {
        setRoster(res.data.students);
        const initialEntries = {};
        res.data.students.forEach((s) => {
          if (s.status === 'active') initialEntries[s.studentId] = { classesAttended: '', obtainedMarks: '' };
        });
        setEntries(initialEntries);
      })
      .catch((err) => {
        setRosterError(err?.response?.data?.message || 'Something went wrong loading students. Please try again.');
      });
  };

  const activeStudents = useMemo(() => (roster || []).filter((s) => s.status === 'active'), [roster]);
  const struckOffStudents = useMemo(() => (roster || []).filter((s) => s.status === 'struck_off'), [roster]);

  const proceedToMarks = () => {
    const lectures = Number(totalLectures);
    if (!teacherName.trim()) {
      setValidationError('Please enter your name');
      return;
    }
    if (!Number.isFinite(lectures) || lectures <= 0) {
      setValidationError('Total lectures delivered must be a positive number');
      return;
    }
    setValidationError('');
    setStep('marks');
  };

  const updateEntry = (studentId, field, value) => {
    setEntries((prev) => ({ ...prev, [studentId]: { ...prev[studentId], [field]: value } }));
  };

  const entriesCompleted = activeStudents.filter((s) => {
    const e = entries[s.studentId];
    return e && e.classesAttended !== '' && e.obtainedMarks !== '';
  }).length;

  const validateMarksStep = () => {
    const lectures = Number(totalLectures);
    for (const s of activeStudents) {
      const e = entries[s.studentId];
      if (!e) continue;
      if (e.classesAttended !== '') {
        const attended = Number(e.classesAttended);
        if (!Number.isFinite(attended) || attended < 0) return `Invalid attendance for ${s.name}`;
        if (attended > lectures) return `Classes attended for ${s.name} cannot exceed ${lectures}`;
      }
      const isAbsentEntry = typeof e.obtainedMarks === 'string' && e.obtainedMarks.trim().toLowerCase() === 'a';
      if (e.obtainedMarks !== '' && !isAbsentEntry) {
        const marks = Number(e.obtainedMarks);
        if (!Number.isFinite(marks) || marks < 0) return `Invalid marks for ${s.name} (enter a number, or "A" for absent)`;
        if (marks > selectedSubject.totalMarks) return `Marks for ${s.name} cannot exceed ${selectedSubject.totalMarks}`;
      }
    }
    return '';
  };

  const proceedToReview = () => {
    const err = validateMarksStep();
    if (err) {
      setValidationError(err);
      return;
    }
    setValidationError('');
    setStep('review');
  };

  const handleFinalSubmit = async () => {
    setSubmitting(true);
    setValidationError('');
    try {
      const payload = {
        teacherName: teacherName.trim(),
        totalLecturesDelivered: Number(totalLectures),
        entries: activeStudents.map((s) => ({
          studentId: s.studentId,
          classesAttended: entries[s.studentId]?.classesAttended,
          obtainedMarks: entries[s.studentId]?.obtainedMarks,
        })),
      };
      const res = await publicService.submitResult(token, selectedSubject.subjectId, payload);
      setSuccessMessage(res.message || `${selectedSubject.name} result submitted successfully.`);
      setPhase('success');
    } catch (err) {
      setValidationError(err?.response?.data?.message || 'Something went wrong. Please try again.');
      setStep('marks');
    } finally {
      setSubmitting(false);
    }
  };

  const submitAnother = () => {
    setPhase('select');
    setSelectedSubject(null);
    setRoster(null);
    loadExamInfo();
  };

  if (phase === 'loading') {
    return (
      <PublicShell collegeName={examInfo?.collegeName}>
        <PageLoader label="Loading exam details..." />
      </PublicShell>
    );
  }

  if (phase === 'error') {
    return (
      <PublicShell>
        <Card className="text-center py-10">
          <div className="h-14 w-14 rounded-2xl bg-danger-50 text-danger-500 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h1 className="font-semibold text-gray-900">Unable to Open This Link</h1>
          <p className="text-sm text-gray-500 mt-2">{errorMessage}</p>
          <Button variant="secondary" icon={RefreshCcw} onClick={loadExamInfo} className="mt-5">
            Try Again
          </Button>
        </Card>
      </PublicShell>
    );
  }

  if (phase === 'success') {
    return (
      <PublicShell collegeName={examInfo?.collegeName}>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="text-center py-10">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
              className="h-16 w-16 rounded-2xl bg-success-50 text-success-500 flex items-center justify-center mx-auto mb-4"
            >
              <CheckCircle2 className="h-8 w-8" />
            </motion.div>
            <h1 className="font-semibold text-gray-900 text-lg">{selectedSubject?.name} Results Submitted</h1>
            <p className="text-sm text-gray-500 mt-2">Your submission has been recorded successfully.</p>
            <p className="text-xs text-gray-400 mt-3">{successMessage}</p>
            <Button variant="secondary" onClick={submitAnother} className="mt-6">
              Submit Another Subject
            </Button>
          </Card>
        </motion.div>
      </PublicShell>
    );
  }

  // phase === 'select'
  if (!selectedSubject) {
    const submittedCount = examInfo.subjects.filter((s) => s.alreadySubmitted).length;
    return (
      <PublicShell collegeName={examInfo.collegeName}>
        <Card>
          <h1 className="font-bold text-gray-900 text-lg">{examInfo.examinationName}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {examInfo.className}
            {examInfo.classSection ? ` • Section ${examInfo.classSection}` : ''} · {examInfo.examType}
          </p>
          <p className="text-xs text-gray-400 mt-1">Result Date: {new Date(examInfo.resultDate).toDateString()}</p>

          <div className="flex items-center justify-between mt-6 mb-2">
            <p className="label mb-0">Select your subject to begin</p>
            <span className="text-xs text-gray-400">
              {submittedCount}/{examInfo.subjects.length} submitted
            </span>
          </div>
          <div className="grid sm:grid-cols-2 gap-2.5">
            {examInfo.subjects.map((s) => (
              <motion.button
                key={s.subjectId}
                whileTap={{ scale: s.alreadySubmitted ? 1 : 0.98 }}
                disabled={s.alreadySubmitted}
                onClick={() => handleSelectSubject(s)}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors min-h-[64px] ${
                  s.alreadySubmitted
                    ? 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'
                    : 'border-gray-200 hover:border-brand-300 hover:bg-brand-50'
                }`}
              >
                <span
                  className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                    s.alreadySubmitted ? 'bg-gray-200 text-gray-400' : 'bg-brand-50 text-brand-600'
                  }`}
                >
                  <BookOpen className="h-4.5 w-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{s.name}</p>
                  <p className="text-xs text-gray-400">Total Marks: {s.totalMarks}</p>
                </div>
                {s.alreadySubmitted ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-success-600 shrink-0">
                    <CheckCircle2 className="h-4 w-4" /> Done
                  </span>
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                )}
              </motion.button>
            ))}
          </div>
        </Card>
      </PublicShell>
    );
  }

  // A subject is selected — loading roster / error / setup / marks / review
  return (
    <PublicShell collegeName={examInfo.collegeName}>
      <button
        onClick={() => setSelectedSubject(null)}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3"
      >
        <ChevronLeft className="h-4 w-4" /> Back to subjects
      </button>

      {rosterError ? (
        <Card className="text-center py-8">
          <AlertTriangle className="h-8 w-8 text-danger-500 mx-auto mb-3" />
          <p className="text-sm text-gray-600">{rosterError}</p>
        </Card>
      ) : !roster ? (
        <PageLoader label="Loading students..." />
      ) : step === 'setup' ? (
        <Card>
          <h2 className="font-semibold text-gray-900">{selectedSubject.name}</h2>
          <p className="text-xs text-gray-500 mb-5">Enter your name and how many lectures you delivered for this subject.</p>
          <div className="space-y-4">
            <Input label="Your Name" placeholder="e.g. Ms. Ayesha Khan" value={teacherName} onChange={(e) => setTeacherName(e.target.value)} required />
            <Input
              label="Total Lectures Delivered"
              type="number"
              min="1"
              placeholder="e.g. 40"
              value={totalLectures}
              onChange={(e) => setTotalLectures(e.target.value)}
              required
            />
            {validationError && <p className="error-text">{validationError}</p>}
            <Button className="w-full" iconRight={ChevronRight} onClick={proceedToMarks}>
              Continue to Attendance & Marks
            </Button>
          </div>
        </Card>
      ) : step === 'marks' ? (
        <div className="space-y-4">
          <Card>
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-semibold text-gray-900">{selectedSubject.name}</h2>
              <span className="text-xs text-gray-400">
                {entriesCompleted}/{activeStudents.length} completed
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Total Lectures Delivered: <strong>{totalLectures}</strong>
            </p>

            <div className="space-y-2.5">
              {activeStudents.map((s, idx) => {
                const e = entries[s.studentId] || {};
                const attendancePct = calcAttendance(e.classesAttended, totalLectures);
                return (
                  <div key={s.studentId} className="rounded-xl border border-gray-200 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-gray-800">
                        {s.rollNumber} · {s.name}
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
                        onChange={(ev) => updateEntry(s.studentId, 'classesAttended', ev.target.value)}
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
                        inputMode="text"
                        placeholder={`Marks /${selectedSubject.totalMarks} or "A"`}
                        className={`input ${
                          typeof e.obtainedMarks === 'string' && e.obtainedMarks.trim().toLowerCase() === 'a'
                            ? 'border-warning-400 bg-warning-50'
                            : ''
                        }`}
                        value={e.obtainedMarks}
                        onChange={(ev) => updateEntry(s.studentId, 'obtainedMarks', ev.target.value)}
                        ref={(el) => (inputRefs.current[`marks-${idx}`] = el)}
                        onKeyDown={(ev) => {
                          if (ev.key === 'Enter') {
                            ev.preventDefault();
                            inputRefs.current[`att-${idx + 1}`]?.focus();
                          }
                        }}
                      />
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1.5">Type "A" if the student was absent for this exam.</p>
                  </div>
                );
              })}

              {struckOffStudents.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Struck Off Students</p>
                  {struckOffStudents.map((s) => (
                    <div key={s.studentId} className="row-struck-off rounded-xl border border-danger-100 p-3 mb-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-700">
                          {s.rollNumber} · {s.name}
                        </p>
                        <span className="badge-danger">
                          🔴 Struck Off{s.struckOffSubjectName ? `: ${s.struckOffSubjectName}` : ''}
                        </span>
                      </div>
                      {s.struckOffReason && <p className="text-xs text-danger-600 mt-1">Reason: {s.struckOffReason}</p>}
                      <p className="text-xs text-danger-600 mt-1">This student is struck off and cannot receive marks or attendance.</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {validationError && <p className="error-text mt-3">{validationError}</p>}

            <div className="flex gap-2 mt-5">
              <Button variant="secondary" icon={ChevronLeft} onClick={() => setStep('setup')}>
                Back
              </Button>
              <Button className="flex-1" iconRight={ChevronRight} onClick={proceedToReview}>
                Review & Submit
              </Button>
            </div>
          </Card>
        </div>
      ) : (
        // review
        <Card>
          <h2 className="font-semibold text-gray-900 mb-4">Review Before Submitting</h2>
          <div className="rounded-xl bg-gray-50 p-4 space-y-1.5 text-sm mb-5">
            <p>
              <span className="text-gray-400">Subject:</span> <span className="font-medium">{selectedSubject.name}</span>
            </p>
            <p>
              <span className="text-gray-400">Total Lectures:</span> <span className="font-medium">{totalLectures}</span>
            </p>
            <p>
              <span className="text-gray-400">Active Students:</span> <span className="font-medium">{activeStudents.length}</span>
            </p>
            <p>
              <span className="text-gray-400">Entries Completed:</span> <span className="font-medium">{entriesCompleted}</span>
            </p>
            <p>
              <span className="text-gray-400">Struck Off:</span> <span className="font-medium">{struckOffStudents.length}</span>
            </p>
          </div>
          {entriesCompleted < activeStudents.length && (
            <p className="text-xs text-warning-600 mb-4">
              Note: {activeStudents.length - entriesCompleted} student(s) have incomplete entries. You can still submit — missing entries
              will be left blank.
            </p>
          )}
          {validationError && <p className="error-text mb-3">{validationError}</p>}
          <div className="flex gap-2">
            <Button variant="secondary" icon={ChevronLeft} onClick={() => setStep('marks')}>
              Back
            </Button>
            <Button className="flex-1" icon={Send} loading={submitting} onClick={handleFinalSubmit}>
              Submit Result
            </Button>
          </div>
        </Card>
      )}
    </PublicShell>
  );
}
