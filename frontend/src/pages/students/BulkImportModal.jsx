import React, { useState } from 'react';
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, ClipboardList, Eye } from 'lucide-react';
import Modal from '../../components/ui/Modal.jsx';
import Select from '../../components/ui/Select.jsx';
import { Textarea } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { studentService } from '../../services/studentService.js';
import { useToast } from '../../context/ToastContext.jsx';

function RowStatusBadge({ status }) {
  if (status === 'valid') return <Badge tone="success" icon={CheckCircle2}>Valid</Badge>;
  if (status === 'duplicate') return <Badge tone="warning" icon={AlertTriangle}>Duplicate</Badge>;
  return <Badge tone="danger" icon={AlertTriangle}>Invalid</Badge>;
}

export default function BulkImportModal({ open, onClose, classes, onImported }) {
  const toast = useToast();
  const [mode, setMode] = useState('file'); // 'file' | 'text'
  const [classId, setClassId] = useState('');
  const [file, setFile] = useState(null);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState(null); // { rows, usedHeader, summary }
  const [result, setResult] = useState(null);

  const reset = () => {
    setClassId('');
    setFile(null);
    setText('');
    setMode('file');
    setResult(null);
    setPreview(null);
  };
  const handleClose = () => {
    reset();
    onClose();
  };

  const requireClass = () => {
    if (!classId) {
      toast.error('Select a class first');
      return null;
    }
    return classes.find((c) => c._id === classId);
  };

  const handlePreview = async () => {
    const selectedClass = requireClass();
    if (!selectedClass) return;
    if (!text.trim()) {
      toast.error('Paste at least one line of student data');
      return;
    }
    setPreviewing(true);
    try {
      const res = await studentService.bulkImportTextPreview({
        classId,
        academicSession: selectedClass.academicSession,
        text,
      });
      setPreview(res.data);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setPreviewing(false);
    }
  };

  const handleConfirmTextImport = async () => {
    const selectedClass = requireClass();
    if (!selectedClass) return;
    setSubmitting(true);
    try {
      const res = await studentService.bulkImportText({
        classId,
        academicSession: selectedClass.academicSession,
        text,
      });
      setResult(res.data);
      onImported();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileImport = async () => {
    const selectedClass = requireClass();
    if (!selectedClass) return;
    if (!file) {
      toast.error('Choose an Excel file first');
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('classId', classId);
      formData.append('academicSession', selectedClass.academicSession || '');
      const res = await studentService.bulkImport(formData);
      setResult(res.data);
      onImported();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Bulk Import Students" size={preview ? 'lg' : 'md'}>
      {result ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-success-600">
            <CheckCircle2 className="h-5 w-5" />
            <p className="font-semibold">{result.imported} student(s) imported successfully</p>
          </div>
          {result.duplicates.length > 0 && (
            <div className="rounded-xl bg-warning-50 text-warning-700 text-sm px-3.5 py-2.5">
              <p className="font-medium flex items-center gap-1.5 mb-1">
                <AlertTriangle className="h-4 w-4" /> {result.duplicates.length} duplicate roll number(s) skipped
              </p>
            </div>
          )}
          {result.invalid.length > 0 && (
            <div className="rounded-xl bg-danger-50 text-danger-700 text-sm px-3.5 py-2.5">
              <p className="font-medium flex items-center gap-1.5 mb-1">
                <AlertTriangle className="h-4 w-4" /> {result.invalid.length} row(s) had errors and were skipped
              </p>
            </div>
          )}
          <Button variant="secondary" onClick={handleClose} className="w-full">
            Done
          </Button>
        </div>
      ) : preview ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-sm">
            <Badge tone="success">{preview.summary.valid} Valid</Badge>
            <Badge tone="warning">{preview.summary.duplicates} Duplicate</Badge>
            <Badge tone="danger">{preview.summary.invalid} Invalid</Badge>
            {preview.usedHeader && <span className="text-gray-400 text-xs">Header row detected</span>}
          </div>

          <div className="max-h-72 overflow-y-auto rounded-xl border border-gray-200">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Roll No</th>
                  <th>Student Name</th>
                  <th>Father's Name</th>
                  <th>Father's Contact</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r, idx) => (
                  <tr key={idx} className={r.status !== 'valid' ? 'row-struck-off' : ''}>
                    <td>{r.rollNumber || '—'}</td>
                    <td>{r.name || '—'}</td>
                    <td>{r.fatherName || '—'}</td>
                    <td>{r.fatherContact || '—'}</td>
                    <td>
                      <RowStatusBadge status={r.status} />
                      {r.reason && r.status !== 'valid' && <p className="text-[11px] text-gray-400 mt-0.5">{r.reason}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setPreview(null)} className="flex-1">
              Back
            </Button>
            <Button
              icon={ClipboardList}
              loading={submitting}
              disabled={preview.summary.valid === 0}
              onClick={handleConfirmTextImport}
              className="flex-1"
            >
              Confirm Import ({preview.summary.valid})
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <Select
            label="Import into Class"
            placeholder="Select class"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            options={(classes || []).map((c) => ({ value: c._id, label: `${c.name}${c.section ? ` — ${c.section}` : ''}` }))}
          />

          {/* Mode tabs */}
          <div className="flex gap-1.5 rounded-xl bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => setMode('file')}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors ${
                mode === 'file' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
              }`}
            >
              <FileSpreadsheet className="h-4 w-4" /> Excel File
            </button>
            <button
              type="button"
              onClick={() => setMode('text')}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors ${
                mode === 'text' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
              }`}
            >
              <ClipboardList className="h-4 w-4" /> Paste Text
            </button>
          </div>

          {mode === 'file' ? (
            <div>
              <p className="text-sm text-gray-500 mb-3">
                Upload an Excel file with columns: <strong>Name</strong>, <strong>Father's Name</strong>,{' '}
                <strong>Father's Contact</strong>, <strong>Roll Number</strong>, <strong>Registration Number</strong>,{' '}
                <strong>Admission Number</strong>. Reasonable header variations are recognized automatically.
              </p>
              <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-8 cursor-pointer hover:bg-gray-50">
                <UploadCloud className="h-6 w-6 text-gray-400" />
                <span className="text-sm text-gray-500">{file ? file.name : 'Click to choose a .xlsx file'}</span>
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </label>
              <Button icon={FileSpreadsheet} onClick={handleFileImport} loading={submitting} className="w-full mt-4">
                Import Students
              </Button>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-500 mb-3">
                Paste one student per line: <strong>roll number, student name, father's name, father's contact</strong> (contact is
                optional). Comma or tab separated. An optional header row is fine too.
                <br />
                <code className="bg-gray-50 px-1.5 py-0.5 rounded text-xs block mt-1.5">1, Umer, Musharaf, 03331234567</code>
                <code className="bg-gray-50 px-1.5 py-0.5 rounded text-xs block mt-1">2, Ahmed, Muhammad</code>
              </p>
              <Textarea
                placeholder={'1, Umer, Musharaf, 03331234567\n2, Ahmed Khan, Muhammad Khan\n3, Sara Ahmed, Tariq Ahmed, 03111234567'}
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={7}
              />
              <Button icon={Eye} onClick={handlePreview} loading={previewing} className="w-full mt-4">
                Preview Import
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
