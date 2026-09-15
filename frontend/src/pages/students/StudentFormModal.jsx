import React, { useEffect, useState } from 'react';
import Modal from '../../components/ui/Modal.jsx';
import Input from '../../components/ui/Input.jsx';
import Select from '../../components/ui/Select.jsx';
import Button from '../../components/ui/Button.jsx';
import { studentService } from '../../services/studentService.js';
import { useToast } from '../../context/ToastContext.jsx';

const emptyForm = {
  name: '',
  fatherName: '',
  fatherContact: '',
  rollNumber: '',
  registrationNumber: '',
  admissionNumber: '',
  class: '',
  academicSession: '',
  gender: 'male',
};

export default function StudentFormModal({ open, onClose, classes, student, defaultClassId, onSaved }) {
  const toast = useToast();
  const isEdit = !!student;
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (student) {
      setForm({
        name: student.name,
        fatherName: student.fatherName || '',
        fatherContact: student.fatherContact || '',
        rollNumber: student.rollNumber,
        registrationNumber: student.registrationNumber || '',
        admissionNumber: student.admissionNumber || '',
        class: student.class?._id || student.class || '',
        academicSession: student.academicSession,
        gender: student.gender || 'male',
      });
    } else {
      const defaultClass = classes?.find((c) => c._id === defaultClassId);
      setForm({ ...emptyForm, class: defaultClassId || '', academicSession: defaultClass?.academicSession || '' });
    }
    setErrors({});
  }, [student, open, defaultClassId, classes]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    if (name === 'class' && !isEdit) {
      const c = classes.find((cl) => cl._id === value);
      if (c) setForm((f) => ({ ...f, class: value, academicSession: c.academicSession }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = 'Name is required';
    if (!form.rollNumber.trim()) nextErrors.rollNumber = 'Roll number is required';
    if (!form.class) nextErrors.class = 'Class is required';
    if (!form.academicSession.trim()) nextErrors.academicSession = 'Academic session is required';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      if (isEdit) {
        await studentService.update(student._id, form);
        toast.success('Student updated');
      } else {
        await studentService.create(form);
        toast.success(`${form.name} registered successfully`);
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Student' : 'Add Student'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            {isEdit ? 'Save Changes' : 'Add Student'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
        <Input label="Student Name" name="name" value={form.name} onChange={handleChange} error={errors.name} required />
        <Input label="Father's Name" name="fatherName" value={form.fatherName} onChange={handleChange} />
        <Input label="Father's Contact" name="fatherContact" placeholder="03XX-XXXXXXX" value={form.fatherContact} onChange={handleChange} />
        <Input label="Roll Number" name="rollNumber" value={form.rollNumber} onChange={handleChange} error={errors.rollNumber} required />
        <Input label="Registration Number" name="registrationNumber" value={form.registrationNumber} onChange={handleChange} />
        <Input label="Admission Number" name="admissionNumber" value={form.admissionNumber} onChange={handleChange} />
        <Select
          label="Gender"
          name="gender"
          value={form.gender}
          onChange={handleChange}
          options={[
            { value: 'male', label: 'Male' },
            { value: 'female', label: 'Female' },
            { value: 'other', label: 'Other' },
          ]}
        />
        <Select
          label="Class"
          name="class"
          value={form.class}
          onChange={handleChange}
          placeholder="Select class"
          disabled={isEdit}
          error={errors.class}
          options={(classes || []).map((c) => ({ value: c._id, label: `${c.name}${c.section ? ` — ${c.section}` : ''}` }))}
        />
        <Input
          label="Academic Session"
          name="academicSession"
          value={form.academicSession}
          onChange={handleChange}
          error={errors.academicSession}
          disabled={isEdit}
        />
      </form>
    </Modal>
  );
}
