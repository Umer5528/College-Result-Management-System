import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, BookOpen, Trash2 } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/ui/PageContainer.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import Modal from '../../components/ui/Modal.jsx';
import ConfirmModal from '../../components/ui/ConfirmModal.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { PageLoader } from '../../components/ui/Loading.jsx';
import { EmptyState, ErrorState } from '../../components/ui/EmptyState.jsx';
import { classService } from '../../services/classService.js';
import { useToast } from '../../context/ToastContext.jsx';

function SubjectFormModal({ open, onClose, classId, subject, onSaved }) {
  const toast = useToast();
  const isEdit = !!subject;
  const [form, setForm] = useState({ name: '', code: '', totalMarks: 100, passingMarks: 40 });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (subject) {
      setForm({ name: subject.name, code: subject.code || '', totalMarks: subject.totalMarks, passingMarks: subject.passingMarks });
    } else {
      setForm({ name: '', code: '', totalMarks: 100, passingMarks: 40 });
    }
    setErrors({});
  }, [subject, open]);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = 'Subject name is required';
    if (Number(form.passingMarks) > Number(form.totalMarks)) nextErrors.passingMarks = 'Cannot exceed total marks';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim(),
        totalMarks: Number(form.totalMarks),
        passingMarks: Number(form.passingMarks),
      };
      if (isEdit) {
        await classService.updateSubject(classId, subject._id, payload);
        toast.success('Subject updated');
      } else {
        await classService.addSubject(classId, payload);
        toast.success('Subject added');
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
      title={isEdit ? 'Edit Subject' : 'Add Subject'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            {isEdit ? 'Save Changes' : 'Add Subject'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Subject Name" name="name" value={form.name} onChange={handleChange} error={errors.name} required />
        <Input label="Subject Code (optional)" name="code" value={form.code} onChange={handleChange} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Total Marks" name="totalMarks" type="number" min="1" value={form.totalMarks} onChange={handleChange} required />
          <Input
            label="Passing Marks"
            name="passingMarks"
            type="number"
            min="0"
            value={form.passingMarks}
            onChange={handleChange}
            error={errors.passingMarks}
            required
          />
        </div>
      </form>
    </Modal>
  );
}

export default function ClassDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [klass, setKlass] = useState(null);
  const [error, setError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteClass = async () => {
    setDeleting(true);
    try {
      await classService.delete(id);
      toast.success(`"${klass.name}" and all its students and examinations were deleted`);
      navigate('/classes');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const load = () => {
    setError(false);
    classService
      .get(id)
      .then((res) => setKlass(res.data))
      .catch(() => setError(true));
  };

  useEffect(load, [id]);

  if (error) return <ErrorState description="We couldn't load this class." onRetry={load} />;
  if (!klass) return <PageLoader label="Loading class..." />;

  return (
    <PageContainer>
      <Link to="/classes" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3">
        <ArrowLeft className="h-4 w-4" /> Back to Classes
      </Link>
      <PageHeader
        title={`${klass.name}${klass.section ? ` — Section ${klass.section}` : ''}`}
        description={`Academic Session ${klass.academicSession}${klass.description ? ` · ${klass.description}` : ''}`}
        actions={
          <>
            <Button
              icon={Plus}
              onClick={() => {
                setEditingSubject(null);
                setModalOpen(true);
              }}
            >
              Add Subject
            </Button>
            <Button variant="danger" icon={Trash2} onClick={() => setDeleteConfirmOpen(true)}>
              Delete Class
            </Button>
          </>
        }
      />

      <Card>
        {klass.subjects.length === 0 ? (
          <EmptyState icon={BookOpen} title="No subjects yet" description="Add the subjects taught in this class." />
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Code</th>
                  <th>Total Marks</th>
                  <th>Passing Marks</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {klass.subjects.map((s) => (
                  <tr key={s._id}>
                    <td className="font-medium text-gray-900">{s.name}</td>
                    <td className="text-gray-500">{s.code || '—'}</td>
                    <td>{s.totalMarks}</td>
                    <td>{s.passingMarks}</td>
                    <td>
                      <Badge tone={s.isActive ? 'success' : 'neutral'}>{s.isActive ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={Pencil}
                        onClick={() => {
                          setEditingSubject(s);
                          setModalOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <SubjectFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        classId={id}
        subject={editingSubject}
        onSaved={load}
      />

      <ConfirmModal
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteClass}
        loading={deleting}
        title="Delete Class"
        message={`This will permanently delete "${klass.name}" along with ALL its students, subjects, examinations, and results. This cannot be undone. Are you absolutely sure?`}
        confirmLabel="Delete Everything"
        tone="danger"
      />
    </PageContainer>
  );
}
