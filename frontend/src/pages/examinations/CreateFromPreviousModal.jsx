import React, { useState } from 'react';
import Modal from '../../components/ui/Modal.jsx';
import Input from '../../components/ui/Input.jsx';
import Select from '../../components/ui/Select.jsx';
import Button from '../../components/ui/Button.jsx';
import { examinationService } from '../../services/examinationService.js';
import { useToast } from '../../context/ToastContext.jsx';

export default function CreateFromPreviousModal({ open, onClose, sourceExam, onCreated }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [examType, setExamType] = useState(sourceExam?.examType || 'Monthly Test');
  const [resultDate, setResultDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !resultDate) {
      toast.error('Enter a name and result date for the new exam');
      return;
    }
    setSubmitting(true);
    try {
      await examinationService.createFromPrevious(sourceExam._id, { name: name.trim(), examType, resultDate });
      toast.success(`"${name}" created from "${sourceExam.name}"`);
      setName('');
      setResultDate('');
      onClose();
      onCreated();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!sourceExam) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Create From "${sourceExam.name}"`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            Create Exam
          </Button>
        </>
      }
    >
      <p className="text-sm text-gray-500 mb-4">
        This copies the class, subjects, total marks and passing marks from <strong>{sourceExam.name}</strong>. No marks,
        attendance or submissions are copied — just give the new exam a name and date.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="New Exam Name" placeholder="e.g. Monthly Test 2" value={name} onChange={(e) => setName(e.target.value)} required />
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
      </form>
    </Modal>
  );
}
