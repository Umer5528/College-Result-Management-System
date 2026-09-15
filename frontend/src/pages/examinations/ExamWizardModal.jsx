import React, { useEffect, useState } from 'react';
import { ChevronRight, ChevronLeft, CheckCircle2, Users } from 'lucide-react';
import Modal from '../../components/ui/Modal.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import Select from '../../components/ui/Select.jsx';
import { examinationService } from '../../services/examinationService.js';
import { classService } from '../../services/classService.js';
import { useToast } from '../../context/ToastContext.jsx';

const STEPS = ['Select Class', 'Select Subjects', 'Exam Details', 'Review'];

export default function ExamWizardModal({ open, onClose, classes, onCreated }) {
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [classId, setClassId] = useState('');
  const [selectedSubjectIds, setSelectedSubjectIds] = useState([]);
  const [name, setName] = useState('');
  const [examType, setExamType] = useState('Monthly Test');
  const [resultDate, setResultDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [studentCounts, setStudentCounts] = useState(null);

  const selectedClass = classes.find((c) => c._id === classId);

  useEffect(() => {
    if (step === 3 && classId) {
      classService.getStudents(classId).then((res) => {
        const students = res.data;
        setStudentCounts({
          total: students.length,
          active: students.filter((s) => s.status === 'active').length,
          struckOff: students.filter((s) => s.status === 'struck_off').length,
        });
      });
    }
  }, [step, classId]);

  const reset = () => {
    setStep(0);
    setClassId('');
    setSelectedSubjectIds([]);
    setName('');
    setExamType('Monthly Test');
    setResultDate('');
  };
  const handleClose = () => {
    reset();
    onClose();
  };

  const toggleSubject = (id) =>
    setSelectedSubjectIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const canProceed = () => {
    if (step === 0) return !!classId;
    if (step === 1) return selectedSubjectIds.length > 0;
    if (step === 2) return name.trim() && resultDate;
    return true;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await examinationService.create({
        name: name.trim(),
        examType,
        class: classId,
        academicSession: selectedClass.academicSession,
        resultDate,
        subjectIds: selectedSubjectIds,
      });
      toast.success(`"${name}" created successfully`);
      handleClose();
      onCreated();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Create New Exam" size="lg">
      {/* Step indicator */}
      <div className="flex items-center gap-1.5 mb-6">
        {STEPS.map((label, idx) => (
          <React.Fragment key={label}>
            <div className="flex items-center gap-1.5">
              <span
                className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  idx < step ? 'bg-success-500 text-white' : idx === step ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-400'
                }`}
              >
                {idx < step ? <CheckCircle2 className="h-3.5 w-3.5" /> : idx + 1}
              </span>
              <span className={`text-xs font-medium hidden sm:inline ${idx === step ? 'text-gray-900' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
            {idx < STEPS.length - 1 && <div className="flex-1 h-px bg-gray-200" />}
          </React.Fragment>
        ))}
      </div>

      {step === 0 && (
        <Select
          label="Which class is this exam for?"
          placeholder="Select class"
          value={classId}
          onChange={(e) => {
            setClassId(e.target.value);
            setSelectedSubjectIds([]);
          }}
          options={classes.map((c) => ({ value: c._id, label: `${c.name}${c.section ? ` — ${c.section}` : ''} (${c.academicSession})` }))}
        />
      )}

      {step === 1 && selectedClass && (
        <div>
          <p className="label">Which subjects are included in this exam?</p>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {selectedClass.subjects
              .filter((s) => s.isActive)
              .map((s) => (
                <label
                  key={s._id}
                  className="flex items-center gap-3 rounded-xl border border-gray-200 px-3.5 py-2.5 cursor-pointer hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded text-brand-500"
                    checked={selectedSubjectIds.includes(s._id)}
                    onChange={() => toggleSubject(s._id)}
                  />
                  <span className="text-sm font-medium text-gray-800">{s.name}</span>
                  <span className="text-xs text-gray-400 ml-auto">
                    {s.totalMarks} marks (pass {s.passingMarks})
                  </span>
                </label>
              ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <Input label="Exam Name" placeholder="e.g. Monthly Test 1" value={name} onChange={(e) => setName(e.target.value)} required />
          <Select
            label="Exam Type"
            value={examType}
            onChange={(e) => setExamType(e.target.value)}
            options={[
              { value: 'Monthly Test', label: 'Monthly Test' },
              { value: 'Mid Term', label: 'Mid Term' },
              { value: 'Final Term', label: 'Final Term' },
              { value: 'Weekly Test', label: 'Weekly Test' },
              { value: 'Other', label: 'Other' },
            ]}
          />
          <Input label="Result Date" type="date" value={resultDate} onChange={(e) => setResultDate(e.target.value)} required />
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3 text-sm">
          <div className="rounded-xl bg-gray-50 p-4 space-y-2">
            <p>
              <span className="text-gray-400">Class:</span>{' '}
              <span className="font-medium">
                {selectedClass?.name}
                {selectedClass?.section ? ` — ${selectedClass.section}` : ''}
              </span>
            </p>
            <p>
              <span className="text-gray-400">Exam Name:</span> <span className="font-medium">{name}</span>
            </p>
            <p>
              <span className="text-gray-400">Type:</span> <span className="font-medium">{examType}</span>
            </p>
            <p>
              <span className="text-gray-400">Result Date:</span> <span className="font-medium">{resultDate}</span>
            </p>
            <p>
              <span className="text-gray-400">Subjects ({selectedSubjectIds.length}):</span>{' '}
              <span className="font-medium">
                {selectedClass?.subjects.filter((s) => selectedSubjectIds.includes(s._id)).map((s) => s.name).join(', ')}
              </span>
            </p>
            {studentCounts && (
              <p className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-gray-400" />
                <span className="text-gray-400">Students:</span>{' '}
                <span className="font-medium">
                  {studentCounts.total} total ({studentCounts.active} active
                  {studentCounts.struckOff > 0 ? `, ${studentCounts.struckOff} struck off` : ''})
                </span>
              </p>
            )}
          </div>
          <p className="text-xs text-gray-400">
            After creating this exam, you'll be able to generate a secure teacher submission link from the exam page.
          </p>
        </div>
      )}

      <div className="flex justify-between mt-6">
        <Button variant="secondary" icon={ChevronLeft} onClick={() => (step === 0 ? handleClose() : setStep((s) => s - 1))}>
          {step === 0 ? 'Cancel' : 'Back'}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button iconRight={ChevronRight} disabled={!canProceed()} onClick={() => setStep((s) => s + 1)}>
            Next
          </Button>
        ) : (
          <Button onClick={handleSubmit} loading={submitting}>
            Create Exam
          </Button>
        )}
      </div>
    </Modal>
  );
}
