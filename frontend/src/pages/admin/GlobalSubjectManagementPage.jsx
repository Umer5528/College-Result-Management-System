import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  BookMarked,
  Plus,
  Pencil,
  Search,
  Check,
  AlertCircle,
  Layers,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/ui/PageContainer.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { SkeletonCard } from '../../components/ui/Skeleton.jsx';
import { EmptyState, ErrorState } from '../../components/ui/EmptyState.jsx';
import { globalSubjectService } from '../../services/globalSubjectService.js';
import { useToast } from '../../context/ToastContext.jsx';

export default function GlobalSubjectManagementPage() {
  const toast = useToast();
  const [subjects, setSubjects] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');

  // Edit / Create Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formTotalMarks, setFormTotalMarks] = useState('');
  const [formPassingMarks, setFormPassingMarks] = useState('');
  const [formErrors, setFormErrors] = useState({});

  // Confirmation Modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [migrating, setMigrating] = useState(false);

  // Overrides Modal state
  const [overridesModalSubject, setOverridesModalSubject] = useState(null);

  const modalOverrides = useMemo(() => {
    if (!overridesModalSubject) return [];
    return (overridesModalSubject.configurations || []).filter(
      (c) => !c.inheritsGlobalConfig
    );
  }, [overridesModalSubject]);

  const loadSubjects = async () => {
    setError(false);
    try {
      const res = await globalSubjectService.list({ search });
      setSubjects(res.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(loadSubjects, search ? 200 : 0);
    return () => clearTimeout(timer);
  }, [search]);

  // Open modal for Create
  const handleOpenCreate = () => {
    setEditingSubject(null);
    setFormName('');
    setFormCode('');
    setFormTotalMarks(100);
    setFormPassingMarks(33);
    setFormErrors({});
    setModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (subject) => {
    setEditingSubject(subject);
    setFormName(subject.name);
    setFormCode(subject.code || '');
    setFormTotalMarks(subject.totalMarks);
    setFormPassingMarks(subject.passingMarks);
    setFormErrors({});
    setModalOpen(true);
  };

  // Pre-validate form
  const validateForm = () => {
    const errors = {};
    if (!formName.trim()) errors.name = 'Subject name is required';
    const total = Number(formTotalMarks);
    const pass = Number(formPassingMarks);
    if (!total || total <= 0) errors.totalMarks = 'Total marks must be greater than 0';
    if (pass < 0 || isNaN(pass)) errors.passingMarks = 'Passing marks must be 0 or higher';
    if (pass > total) errors.passingMarks = 'Passing marks cannot exceed total marks';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmitForm = (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (!editingSubject) {
      // Direct create for new subjects
      handleCreate();
    } else {
      // Check if marks or details changed for an existing subject
      const totalChanged = Number(formTotalMarks) !== Number(editingSubject.totalMarks);
      const passChanged = Number(formPassingMarks) !== Number(editingSubject.passingMarks);
      const nameChanged = formName.trim() !== editingSubject.name;
      const codeChanged = formCode.trim() !== (editingSubject.code || '');

      if (!totalChanged && !passChanged && !nameChanged && !codeChanged) {
        setModalOpen(false);
        return;
      }

      // If subject is used by classes, show confirmation modal
      if (editingSubject.configurationCount > 0) {
        setConfirmOpen(true);
      } else {
        handleUpdateDirect();
      }
    }
  };

  // Direct create
  const handleCreate = async () => {
    setSaving(true);
    try {
      await globalSubjectService.create({
        name: formName.trim(),
        code: formCode.trim(),
        totalMarks: Number(formTotalMarks),
        passingMarks: Number(formPassingMarks),
      });
      toast.success(`Subject "${formName.trim()}" created successfully`);
      setModalOpen(false);
      loadSubjects();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not create subject');
    } finally {
      setSaving(false);
    }
  };

  // Direct update without confirmation (0 classes affected)
  const handleUpdateDirect = async () => {
    setSaving(true);
    try {
      await globalSubjectService.update(editingSubject._id, {
        name: formName.trim(),
        code: formCode.trim(),
        totalMarks: Number(formTotalMarks),
        passingMarks: Number(formPassingMarks),
      });
      toast.success(`Subject "${formName.trim()}" updated successfully`);
      setModalOpen(false);
      loadSubjects();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not update subject');
    } finally {
      setSaving(false);
    }
  };

  // Confirmed Universal Update across classes
  const handleConfirmUpdate = async () => {
    setSaving(true);
    try {
      const res = await globalSubjectService.update(editingSubject._id, {
        name: formName.trim(),
        code: formCode.trim(),
        totalMarks: Number(formTotalMarks),
        passingMarks: Number(formPassingMarks),
      });
      toast.success(res.message || `Subject "${formName.trim()}" updated across classes`);
      setConfirmOpen(false);
      setModalOpen(false);
      loadSubjects();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not update subject across classes');
    } finally {
      setSaving(false);
    }
  };

  // Run migration
  const handleMigrate = async () => {
    setMigrating(true);
    try {
      const res = await globalSubjectService.migrate();
      toast.success(
        `Migration complete: ${res.data.newlyMapped} newly mapped, ${res.data.alreadyMapped} already mapped, ${res.data.overridesDetected} overrides detected.`
      );
      loadSubjects();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Migration failed');
    } finally {
      setMigrating(false);
    }
  };

  const filteredSubjects = useMemo(() => {
    if (!subjects) return [];
    return subjects;
  }, [subjects]);

  return (
    <PageContainer>
      <PageHeader
        title="Subject Management"
        description="Centralized subject registry. Updates automatically propagate to all inheriting classes while preserving overrides."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              icon={RefreshCw}
              loading={migrating}
              onClick={handleMigrate}
              title="Sync any unlinked class subjects into the centralized registry"
            >
              Sync & Migrate
            </Button>
            <Button icon={Plus} onClick={handleOpenCreate}>
              New Subject
            </Button>
          </div>
        }
      />

      {/* Search and filters */}
      <div className="mb-5 max-w-md">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            className="input pl-10"
            placeholder="Search subjects by name or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Content */}
      {error ? (
        <ErrorState description="We couldn't load global subjects." onRetry={loadSubjects} />
      ) : loading && !subjects ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filteredSubjects.length === 0 ? (
        <EmptyState
          icon={BookMarked}
          title={search ? 'No matching subjects' : 'No subjects in registry'}
          description={
            search
              ? 'Try adjusting your search query'
              : 'Add your first centralized subject or sync existing class subjects.'
          }
          action={
            <Button icon={Plus} onClick={handleOpenCreate}>
              New Subject
            </Button>
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSubjects.map((subj) => (
            <Card
              key={subj._id}
              hover
              onClick={() => handleOpenEdit(subj)}
              className="cursor-pointer flex flex-col justify-between transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 text-base truncate">{subj.name}</h3>
                    {subj.code && (
                      <span className="inline-block mt-0.5 text-xs font-mono font-medium text-brand-600 bg-brand-50 px-2 py-0.5 rounded">
                        {subj.code}
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Pencil}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEdit(subj);
                    }}
                  >
                    Edit
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4 p-3 bg-gray-50 rounded-xl text-center">
                  <div>
                    <span className="block text-xs text-gray-400">Total Marks</span>
                    <span className="text-base font-bold text-gray-800">{subj.totalMarks}</span>
                  </div>
                  <div className="border-l border-gray-200">
                    <span className="block text-xs text-gray-400">Passing Marks</span>
                    <span className="text-base font-bold text-emerald-600">{subj.passingMarks}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-gray-400" />
                  <span>
                    {subj.configurationCount} class{subj.configurationCount === 1 ? '' : 'es'}
                  </span>
                </span>
                {subj.overrideCount > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOverridesModalSubject(subj);
                    }}
                    className="badge-warning hover:bg-warning-200 hover:text-warning-700 active:scale-95 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-warning-400"
                    title="Click to view class overrides"
                  >
                    <AlertCircle className="h-3 w-3" />
                    <span>
                      {subj.overrideCount} class override{subj.overrideCount === 1 ? '' : 's'}
                    </span>
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Edit / Create Subject Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingSubject ? `Edit ${editingSubject.name}` : 'New Global Subject'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitForm} loading={saving}>
              {editingSubject ? 'Save Changes' : 'Create Subject'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmitForm} className="space-y-4">
          <Input
            label="Subject Name"
            placeholder="e.g. English"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            error={formErrors.name}
            required
          />

          <Input
            label="Subject Code (optional)"
            placeholder="e.g. ENG"
            value={formCode}
            onChange={(e) => setFormCode(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Total Marks"
              type="number"
              min="1"
              value={formTotalMarks}
              onChange={(e) => setFormTotalMarks(e.target.value)}
              error={formErrors.totalMarks}
              required
            />
            <Input
              label="Passing Marks"
              type="number"
              min="0"
              value={formPassingMarks}
              onChange={(e) => setFormPassingMarks(e.target.value)}
              error={formErrors.passingMarks}
              required
            />
          </div>

          {editingSubject && editingSubject.configurationCount > 0 && (
            <div className="rounded-xl bg-brand-50/70 border border-brand-100 p-3.5 text-xs text-brand-900 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-brand-600" />
                Used in {editingSubject.configurationCount} class configuration
                {editingSubject.configurationCount === 1 ? '' : 's'}
              </p>
              <p className="text-brand-700">
                Saving will automatically update all classes that inherit global values.
                {editingSubject.overrideCount > 0 && (
                  <span>
                    {' '}
                    ({editingSubject.overrideCount} class-specific override
                    {editingSubject.overrideCount === 1 ? '' : 's'} will remain safely preserved.)
                  </span>
                )}
              </p>
            </div>
          )}
        </form>
      </Modal>

      {/* Confirmation Modal */}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={`Update ${editingSubject?.name} across all classes?`}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmUpdate} loading={saving} icon={Check}>
              Update All
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            This will update <strong>{editingSubject?.name}</strong> in{' '}
            <strong>{editingSubject?.inheritingCount || editingSubject?.configurationCount}</strong> class configuration(s)
            inheriting from this subject.
          </p>

          <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-gray-50 border border-gray-100">
            <div>
              <span className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Current</span>
              <p className="text-sm text-gray-700">
                Total Marks: <strong className="text-gray-900">{editingSubject?.totalMarks}</strong>
              </p>
              <p className="text-sm text-gray-700 mt-1">
                Passing Marks: <strong className="text-gray-900">{editingSubject?.passingMarks}</strong>
              </p>
            </div>

            <div className="border-l border-gray-200 pl-4">
              <span className="block text-xs font-bold uppercase tracking-wider text-brand-600 mb-2">New</span>
              <p className="text-sm text-gray-700">
                Total Marks: <strong className="text-brand-700">{formTotalMarks}</strong>
              </p>
              <p className="text-sm text-gray-700 mt-1">
                Passing Marks: <strong className="text-brand-700">{formPassingMarks}</strong>
              </p>
            </div>
          </div>

          {editingSubject?.overrideCount > 0 && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl text-xs text-amber-800 border border-amber-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <span>
                <strong>{editingSubject.overrideCount} class override(s)</strong> detected. Those classes have customized
                marks and will remain completely untouched.
              </span>
            </div>
          )}

          <p className="text-xs text-gray-400">
            Historical examinations, finalized results, and existing reports will never be changed.
          </p>
        </div>
      </Modal>

      {/* Class Overrides Modal */}
      <Modal
        open={Boolean(overridesModalSubject)}
        onClose={() => setOverridesModalSubject(null)}
        title="Override Details"
        size="sm"
        footer={
          <Button variant="secondary" onClick={() => setOverridesModalSubject(null)}>
            Close
          </Button>
        }
      >
        {overridesModalSubject && (
          <div className="space-y-4">
            {/* Header info */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="min-w-0 pr-2">
                <h4 className="font-semibold text-gray-900 text-base truncate">
                  {overridesModalSubject.name}
                </h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  Global:{' '}
                  <span className="font-medium text-gray-800">
                    {overridesModalSubject.totalMarks} total
                  </span>{' '}
                  /{' '}
                  <span className="font-medium text-emerald-600">
                    {overridesModalSubject.passingMarks} pass
                  </span>
                </p>
              </div>
              <span className="badge-warning shrink-0">
                <AlertCircle className="h-3 w-3" />
                <span>
                  {modalOverrides.length} class override{modalOverrides.length === 1 ? '' : 's'}
                </span>
              </span>
            </div>

            {/* Override list */}
            {modalOverrides.length === 0 ? (
              <p className="text-sm text-gray-500 py-3 text-center">
                No active class overrides found for this subject.
              </p>
            ) : (
              <div className="space-y-3">
                {modalOverrides.map((c) => {
                  const classLabel = `${c.name}${c.section ? ` — ${c.section}` : ''}`;
                  return (
                    <div
                      key={c.classSubjectId || c.classId}
                      className="p-3.5 rounded-xl bg-gray-50 border border-gray-200/80 space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm text-gray-900 flex items-center gap-1.5 min-w-0">
                          <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0"></span>
                          <span className="truncate">{classLabel}</span>
                        </span>
                        {c.academicSession && (
                          <span className="text-[11px] text-gray-400 font-mono shrink-0">
                            {c.academicSession}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 text-xs">
                        <div className="flex items-center justify-between py-1.5 px-3 bg-white rounded-lg border border-gray-100">
                          <span className="text-gray-500">Total Marks:</span>
                          <span className="font-bold text-gray-900">{c.totalMarks}</span>
                        </div>
                        <div className="flex items-center justify-between py-1.5 px-3 bg-white rounded-lg border border-gray-100">
                          <span className="text-gray-500">Passing Marks:</span>
                          <span className="font-bold text-emerald-600">{c.passingMarks}</span>
                        </div>
                        <div className="flex items-center justify-between py-1.5 px-3 bg-amber-50/70 rounded-lg border border-amber-200/70 text-amber-900">
                          <span className="text-amber-800">Global:</span>
                          <span className="font-semibold text-amber-900">
                            {overridesModalSubject.totalMarks} / {overridesModalSubject.passingMarks}
                          </span>
                        </div>
                      </div>

                      {c.classId && (
                        <div className="pt-0.5 flex justify-end">
                          <Link
                            to={`/classes/${c.classId}`}
                            onClick={() => setOverridesModalSubject(null)}
                            className="text-[11px] font-medium text-brand-600 hover:text-brand-800 hover:underline inline-flex items-center gap-1"
                          >
                            View Class <ArrowRight className="h-3 w-3" />
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}
