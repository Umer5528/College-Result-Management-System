import React, { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal.jsx';
import Select from '../../components/ui/Select.jsx';
import { Textarea } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { classService } from '../../services/classService.js';
import { studentService } from '../../services/studentService.js';
import { useToast } from '../../context/ToastContext.jsx';

export default function StrikeOffModal({ open, onClose, student, onDone }) {
  const toast = useToast();
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && student?.class) {
      const classId = student.class._id || student.class;
      classService.get(classId).then((res) => setSubjects(res.data.subjects || []));
    }
    setSubjectId('');
    setReason('');
    setError('');
  }, [open, student]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subjectId && !reason.trim()) {
      setError('Please select a subject or provide a reason for striking off this student.');
      return;
    }
    setSubmitting(true);
    try {
      await studentService.strikeOff(student._id, { subjectId: subjectId || undefined, reason: reason.trim() });
      toast.success(`${student.name} marked as Struck Off`);
      onDone();
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!student) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Mark Student as Struck Off"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleSubmit} loading={submitting}>
            Strike Off
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-xl bg-gray-50 p-3 text-sm">
          <p className="text-gray-400 text-xs">Student</p>
          <p className="font-medium text-gray-900">
            {student.name} <span className="text-gray-400 font-normal">(Roll {student.rollNumber})</span>
          </p>
        </div>

        <Select
          label="Subject"
          placeholder="No specific subject"
          value={subjectId}
          onChange={(e) => {
            setSubjectId(e.target.value);
            setError('');
          }}
          options={subjects.map((s) => ({ value: s._id, label: s.name }))}
        />

        <Textarea
          label="Reason"
          placeholder="e.g. Poor attendance, left college..."
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setError('');
          }}
          help="Optional if a subject is selected."
        />

        {error && <p className="error-text">{error}</p>}

        <p className="text-xs text-gray-400 bg-warning-50 rounded-lg px-3 py-2.5">
          Selecting a subject or entering a reason is required. A strike-off applies to the student across all
          subjects — they won't be able to receive marks or attendance anywhere until restored.
        </p>
      </form>
    </Modal>
  );
}
