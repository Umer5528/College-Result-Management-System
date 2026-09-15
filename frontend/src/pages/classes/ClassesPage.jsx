import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, BookOpen, Trash2, Layers, Users } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/ui/PageContainer.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import { Textarea } from '../../components/ui/Input.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { SkeletonCard } from '../../components/ui/Skeleton.jsx';
import { EmptyState, ErrorState } from '../../components/ui/EmptyState.jsx';
import { classService } from '../../services/classService.js';
import { useToast } from '../../context/ToastContext.jsx';

function emptySubject() {
  return { key: Math.random().toString(36).slice(2), name: '', code: '', totalMarks: 100, passingMarks: 40 };
}

function CreateClassModal({ open, onClose, onCreated }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [section, setSection] = useState('');
  const [academicSession, setAcademicSession] = useState('');
  const [description, setDescription] = useState('');
  const [subjects, setSubjects] = useState([emptySubject()]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setName('');
    setSection('');
    setAcademicSession('');
    setDescription('');
    setSubjects([emptySubject()]);
    setErrors({});
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const updateSubject = (key, field, value) => {
    setSubjects((subs) => subs.map((s) => (s.key === key ? { ...s, [field]: value } : s)));
  };

  const removeSubject = (key) => setSubjects((subs) => (subs.length > 1 ? subs.filter((s) => s.key !== key) : subs));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    if (!name.trim()) nextErrors.name = 'Class name is required';
    if (!academicSession.trim()) nextErrors.academicSession = 'Academic session is required';
    subjects.forEach((s) => {
      if (!s.name.trim()) nextErrors.subjects = 'Every subject needs a name';
      if (Number(s.passingMarks) > Number(s.totalMarks)) nextErrors.subjects = 'Passing marks cannot exceed total marks';
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await classService.create({
        name: name.trim(),
        section: section.trim(),
        academicSession: academicSession.trim(),
        description,
        subjects: subjects.map(({ key, ...s }) => ({
          name: s.name.trim(),
          code: s.code.trim(),
          totalMarks: Number(s.totalMarks),
          passingMarks: Number(s.passingMarks),
        })),
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
    <Modal
      open={open}
      onClose={handleClose}
      title="Create New Class"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            Create Class
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Input
            label="Class Name"
            placeholder="e.g. Pre Medical 1st Year"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
            required
          />
          <Input
            label="Section (optional)"
            placeholder="e.g. A"
            value={section}
            onChange={(e) => setSection(e.target.value)}
            help="Leave blank if this class isn't split into sections."
          />
          <Input
            label="Academic Session"
            placeholder="e.g. 2026-27"
            value={academicSession}
            onChange={(e) => setAcademicSession(e.target.value)}
            error={errors.academicSession}
            required
            className="sm:col-span-2"
          />
        </div>
        <Textarea label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">Subjects</label>
            <Button type="button" size="sm" variant="secondary" icon={Plus} onClick={() => setSubjects((s) => [...s, emptySubject()])}>
              Add Subject
            </Button>
          </div>
          {errors.subjects && <p className="error-text mb-2">{errors.subjects}</p>}
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {subjects.map((s) => (
              <div key={s.key} className="grid grid-cols-12 gap-2 items-start bg-gray-50 rounded-xl p-2.5">
                <input
                  className="input col-span-4"
                  placeholder="Subject name"
                  value={s.name}
                  onChange={(e) => updateSubject(s.key, 'name', e.target.value)}
                />
                <input
                  className="input col-span-2"
                  placeholder="Code"
                  value={s.code}
                  onChange={(e) => updateSubject(s.key, 'code', e.target.value)}
                />
                <input
                  className="input col-span-2"
                  type="number"
                  min="1"
                  placeholder="Total"
                  value={s.totalMarks}
                  onChange={(e) => updateSubject(s.key, 'totalMarks', e.target.value)}
                />
                <input
                  className="input col-span-3"
                  type="number"
                  min="0"
                  placeholder="Passing"
                  value={s.passingMarks}
                  onChange={(e) => updateSubject(s.key, 'passingMarks', e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => removeSubject(s.key)}
                  className="col-span-1 text-gray-400 hover:text-danger-500 flex items-center justify-center h-[44px]"
                  aria-label="Remove subject"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default function ClassesPage() {
  const [classes, setClasses] = useState(null);
  const [error, setError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const load = () => {
    setError(false);
    classService
      .list()
      .then((res) => setClasses(res.data))
      .catch(() => setError(true));
  };

  useEffect(load, []);

  return (
    <PageContainer>
      <PageHeader
        title="Classes & Subjects"
        description="Create classes, define their subjects, and set marks — used across exams and reports."
        actions={
          <Button icon={Plus} onClick={() => setModalOpen(true)}>
            Create Class
          </Button>
        }
      />

      {error ? (
        <ErrorState description="We couldn't load your classes." onRetry={load} />
      ) : classes === null ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : classes.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No classes yet"
          description="Create your first class and add its subjects to get started."
          action={
            <Button icon={Plus} onClick={() => setModalOpen(true)}>
              Create Class
            </Button>
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((c) => (
            <Link key={c._id} to={`/classes/${c._id}`}>
              <Card hover className="h-full">
                <div className="flex items-start justify-between mb-2">
                  <span className="h-10 w-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                    <BookOpen className="h-5 w-5" />
                  </span>
                  <span className="text-xs text-gray-400">{c.academicSession}</span>
                </div>
                <h3 className="font-semibold text-gray-900">
                  {c.name}
                  {c.section && <span className="text-gray-400 font-normal"> — Section {c.section}</span>}
                </h3>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Layers className="h-3.5 w-3.5" /> {c.subjects.length} subject{c.subjects.length !== 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {c.studentCount ?? 0} student{c.studentCount === 1 ? '' : 's'}
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <CreateClassModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={load} />
    </PageContainer>
  );
}
