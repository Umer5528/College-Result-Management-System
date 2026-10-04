import React, { useState, useEffect } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  Calendar,
  Layers,
  CheckSquare,
  Square,
  FileText,
  AlertCircle,
} from 'lucide-react';
import Modal from '../../components/ui/Modal.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import Select from '../../components/ui/Select.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { examinationService } from '../../services/examinationService.js';
import { useToast } from '../../context/ToastContext.jsx';

const STEPS = ['Select Classes', 'Exam Details', 'Preview & Confirm'];

export default function BulkExamModal({ open, onClose, classes = [], onCreated }) {
  const toast = useToast();
  const [step, setStep] = useState(0);

  // Step 1: Selected classes
  const [selectedClassIds, setSelectedClassIds] = useState([]);

  // Step 2: Common exam details
  const [name, setName] = useState('');
  const [examType, setExamType] = useState('Monthly Test');
  const [resultDate, setResultDate] = useState('');
  const [academicSession, setAcademicSession] = useState('');
  const [generateLinks, setGenerateLinks] = useState(false);

  // Step 3: Preview state
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [skipExisting, setSkipExisting] = useState(true);

  // Submission state
  const [submitting, setSubmitting] = useState(false);

  // Reset modal state
  const reset = () => {
    setStep(0);
    setSelectedClassIds([]);
    setName('');
    setExamType('Monthly Test');
    setResultDate('');
    setAcademicSession('');
    setGenerateLinks(false);
    setPreviewData(null);
    setPreviewError(null);
    setSkipExisting(true);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // Toggle single class
  const toggleClass = (id) => {
    setSelectedClassIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Select all / Deselect all
  const toggleSelectAll = () => {
    if (selectedClassIds.length === classes.length) {
      setSelectedClassIds([]);
    } else {
      setSelectedClassIds(classes.map((c) => c._id));
    }
  };

  // Set default academic session from selected classes
  useEffect(() => {
    if (selectedClassIds.length > 0 && !academicSession) {
      const first = classes.find((c) => c._id === selectedClassIds[0]);
      if (first?.academicSession) setAcademicSession(first.academicSession);
    }
  }, [selectedClassIds]);

  // Can proceed from step
  const canProceed = () => {
    if (step === 0) return selectedClassIds.length > 0;
    if (step === 1) return name.trim().length > 0 && resultDate.length > 0;
    return true;
  };

  // Load preview when entering Step 2 -> 3
  const handleNextStep = async () => {
    if (step === 1) {
      // Load preview
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const res = await examinationService.bulkPreview({
          name: name.trim(),
          examType,
          classIds: selectedClassIds,
          resultDate,
          academicSession: academicSession || undefined,
        });
        setPreviewData(res.data);
        setStep(2);
      } catch (err) {
        setPreviewError(err?.response?.data?.message || 'Could not generate examination preview');
      } finally {
        setPreviewLoading(false);
      }
    } else {
      setStep((s) => s + 1);
    }
  };

  // Final bulk creation
  const handleBulkCreate = async () => {
    setSubmitting(true);
    try {
      const res = await examinationService.bulkCreate({
        name: name.trim(),
        examType,
        classIds: selectedClassIds,
        resultDate,
        academicSession: academicSession || undefined,
        skipExisting,
        generateLinks,
      });

      const summary = res.data.summary;
      toast.success(
        `Bulk creation complete: ${summary.createdCount} examination(s) created${
          summary.skippedCount > 0 ? `, ${summary.skippedCount} existing skipped` : ''
        }.`
      );
      handleClose();
      onCreated();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to create bulk examinations');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Bulk Create Examinations" size="lg">
      {/* Wizard Steps header */}
      <div className="flex items-center gap-2 mb-6 border-b border-gray-100 pb-4">
        {STEPS.map((label, idx) => (
          <React.Fragment key={label}>
            <div className="flex items-center gap-2">
              <span
                className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  idx < step
                    ? 'bg-emerald-600 text-white'
                    : idx === step
                    ? 'bg-brand-600 text-white'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {idx < step ? <CheckCircle2 className="h-3.5 w-3.5" /> : idx + 1}
              </span>
              <span
                className={`text-xs font-medium ${
                  idx === step ? 'text-gray-900 font-semibold' : 'text-gray-400'
                }`}
              >
                {label}
              </span>
            </div>
            {idx < STEPS.length - 1 && <div className="flex-1 h-px bg-gray-200" />}
          </React.Fragment>
        ))}
      </div>

      {/* STEP 0: Select Classes */}
      {step === 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              Select one, multiple, or all classes ({selectedClassIds.length} of {classes.length} selected)
            </span>
            <Button size="sm" variant="ghost" onClick={toggleSelectAll}>
              {selectedClassIds.length === classes.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {classes.map((c) => {
              const selected = selectedClassIds.includes(c._id);
              const subjectCount = (c.subjects || []).filter((s) => s.isActive).length;
              return (
                <label
                  key={c._id}
                  className={`flex items-center gap-3.5 p-3 rounded-xl border transition-all cursor-pointer ${
                    selected
                      ? 'border-brand-500 bg-brand-50/50 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleClass(c._id)}
                    className="h-4 w-4 rounded text-brand-600 focus:ring-brand-500"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-gray-900">
                      {c.name}
                      {c.section && <span className="font-normal text-gray-500"> — Section {c.section}</span>}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">Academic Session: {c.academicSession}</p>
                  </div>
                  <Badge tone={subjectCount > 0 ? 'neutral' : 'warning'} size="sm">
                    {subjectCount} subject{subjectCount === 1 ? '' : 's'}
                  </Badge>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 1: Common Exam Information */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="p-3 bg-brand-50/70 border border-brand-100 rounded-xl text-xs text-brand-900 flex items-center gap-2">
            <Layers className="h-4 w-4 text-brand-600 shrink-0" />
            <span>
              This information will be applied to all <strong>{selectedClassIds.length}</strong> selected classes.
              Each class will independently snapshot its own configured subjects.
            </span>
          </div>

          <Input
            label="Examination Name"
            placeholder="e.g. Monthly Test 1 or Mid Term 2026"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="grid sm:grid-cols-2 gap-4">
            <Select
              label="Examination Type"
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
            <Input
              label="Result Date"
              type="date"
              value={resultDate}
              onChange={(e) => setResultDate(e.target.value)}
              required
            />
          </div>

          <Input
            label="Academic Session (optional)"
            placeholder="e.g. 2026-27"
            value={academicSession}
            onChange={(e) => setAcademicSession(e.target.value)}
            help="Defaults to each class's academic session if left blank."
          />

          <label className="flex items-center gap-2.5 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded text-brand-600"
              checked={generateLinks}
              onChange={(e) => setGenerateLinks(e.target.checked)}
            />
            <span>
              <strong>Activate secure teacher submission links immediately</strong>
              <span className="block text-xs text-gray-500">
                Generates unique, secure public submission tokens for each class examination.
              </span>
            </span>
          </label>
        </div>
      )}

      {/* STEP 2: Preview & Duplicate Resolution */}
      {step === 2 && previewData && (
        <div className="space-y-4">
          {/* Summary counts */}
          <div className="grid grid-cols-3 gap-2 text-center p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs">
            <div>
              <span className="text-gray-400 block">Requested</span>
              <strong className="text-gray-900 text-sm">{previewData.summary.totalRequested}</strong>
            </div>
            <div>
              <span className="text-emerald-600 block">Will Create</span>
              <strong className="text-emerald-700 text-sm">{previewData.summary.willCreateCount}</strong>
            </div>
            <div>
              <span className="text-amber-600 block">Already Exists</span>
              <strong className="text-amber-700 text-sm">{previewData.summary.alreadyExistsCount}</strong>
            </div>
          </div>

          {/* Duplicate handling notification if alreadyExists > 0 */}
          {previewData.alreadyExists.length > 0 && (
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span>Duplicate Detected: Examination already exists for {previewData.alreadyExists.length} class(es)</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-amber-800 pl-1">
                {previewData.alreadyExists.map((item) => (
                  <li key={item.classId}>
                    <strong>{item.className}</strong>
                    {item.section ? ` — Section ${item.section}` : ''} (Already has &ldquo;{name}&rdquo;)
                  </li>
                ))}
              </ul>
              <label className="flex items-center gap-2 pt-1 font-medium text-amber-900 cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipExisting}
                  onChange={(e) => setSkipExisting(e.target.checked)}
                  className="rounded text-amber-600"
                />
                <span>Skip existing examinations and create for remaining {previewData.willCreate.length} class(es)</span>
              </label>
            </div>
          )}

          {/* Invalid classes if any */}
          {previewData.invalidClasses?.length > 0 && (
            <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-xs text-red-800 space-y-1">
              <p className="font-semibold flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4" /> Cannot create for {previewData.invalidClasses.length} class(es):
              </p>
              {previewData.invalidClasses.map((item) => (
                <p key={item.classId}>
                  • {item.className}: {item.reason}
                </p>
              ))}
            </div>
          )}

          {/* Per-class subjects preview */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
              Per-Class Subject Resolution Preview
            </h4>
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {previewData.willCreate.map((item) => (
                <div key={item.classId} className="p-3 bg-white border border-gray-200 rounded-xl space-y-1.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-gray-900">
                      {item.className}
                      {item.section ? ` — Section ${item.section}` : ''}
                    </span>
                    <Badge tone="success" size="sm">
                      {item.subjects.length} subjects
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {item.subjects.map((s) => (
                      <span
                        key={s.subjectId}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-700"
                      >
                        <span className="font-medium">{s.name}</span>
                        <span className="text-gray-400">({s.totalMarks}/{s.passingMarks})</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-gray-400">
            Each created examination will receive an independent ID, subject snapshots, and secure submission token.
          </p>
        </div>
      )}

      {previewError && (
        <div className="p-3 bg-red-50 text-red-800 rounded-xl border border-red-200 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{previewError}</span>
        </div>
      )}

      {/* Footer controls */}
      <div className="flex justify-between mt-6 pt-4 border-t border-gray-100">
        <Button
          variant="secondary"
          icon={ChevronLeft}
          onClick={() => (step === 0 ? handleClose() : setStep((s) => s - 1))}
        >
          {step === 0 ? 'Cancel' : 'Back'}
        </Button>

        {step < STEPS.length - 1 ? (
          <Button
            iconRight={ChevronRight}
            disabled={!canProceed() || previewLoading}
            loading={previewLoading}
            onClick={handleNextStep}
          >
            {step === 1 ? 'Preview Creation' : 'Next'}
          </Button>
        ) : (
          <Button
            onClick={handleBulkCreate}
            loading={submitting}
            disabled={previewData?.willCreate.length === 0 || (previewData?.alreadyExists.length > 0 && !skipExisting)}
          >
            Confirm & Create {skipExisting && previewData?.alreadyExists.length > 0 ? `${previewData?.willCreate.length} Exams` : 'Exams'}
          </Button>
        )}
      </div>
    </Modal>
  );
}
