import React, { useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import Modal from '../../components/ui/Modal.jsx';
import Button from '../../components/ui/Button.jsx';

export default function OverallDecisionModal({ open, onClose, student, onDecide, loading }) {
  const [choice, setChoice] = useState(student?.overallDecision !== 'pending' ? student?.overallDecision : null);

  if (!student) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Confirm Final Result"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!choice} loading={loading} onClick={() => onDecide(choice)}>
            Save Decision
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="text-sm text-gray-500">Student</p>
          <p className="font-semibold text-gray-900">
            {student.studentName} <span className="text-gray-400 font-normal">(Roll {student.rollNumber})</span>
          </p>
        </div>

        <div>
          <p className="text-sm text-gray-500 mb-1">Failed Subject(s)</p>
          {student.failedSubjects && student.failedSubjects.length > 0 ? (
            <p className="font-medium text-danger-600">{student.failedSubjects.join(', ')}</p>
          ) : (
            <p className="font-medium text-success-600">None</p>
          )}
        </div>

        {student.struckOffInfo && (
          <div>
            <p className="text-sm text-gray-500 mb-1">Struck-Off Subject</p>
            <p className="font-medium text-danger-600">
              🔴 {student.struckOffInfo.subjectName || 'All Subjects'}
              {student.struckOffInfo.reason ? ` — ${student.struckOffInfo.reason}` : ''}
            </p>
          </div>
        )}

        <div>
          <p className="text-sm text-gray-500 mb-2">Final Decision</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setChoice('pass')}
              className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold transition-colors ${
                choice === 'pass' ? 'border-success-500 bg-success-50 text-success-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              <CheckCircle2 className="h-4 w-4" /> Passed
            </button>
            <button
              type="button"
              onClick={() => setChoice('fail')}
              className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold transition-colors ${
                choice === 'fail' ? 'border-danger-500 bg-danger-50 text-danger-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              <XCircle className="h-4 w-4" /> Failed
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
