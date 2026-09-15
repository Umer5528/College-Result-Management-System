import React, { useEffect, useState } from 'react';
import { History, ChevronLeft, ChevronRight } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/ui/PageContainer.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Select from '../../components/ui/Select.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { SkeletonTable } from '../../components/ui/Skeleton.jsx';
import { EmptyState, ErrorState } from '../../components/ui/EmptyState.jsx';
import { auditLogService } from '../../services/adminServices.js';

const PAGE_SIZE = 25;

const ACTION_OPTIONS = [
  { value: 'login', label: 'Login' },
  { value: 'login_failed', label: 'Login Failed' },
  { value: 'student_created', label: 'Student Created' },
  { value: 'student_struck_off', label: 'Student Struck Off' },
  { value: 'student_restored', label: 'Student Restored' },
  { value: 'class_created', label: 'Class Created' },
  { value: 'exam_created', label: 'Exam Created' },
  { value: 'submission_link_generated', label: 'Submission Link Generated' },
  { value: 'result_submitted', label: 'Result Submitted' },
  { value: 'result_finalized', label: 'Result Finalized' },
  { value: 'result_reopened', label: 'Result Reopened' },
  { value: 'report_generated', label: 'Report Generated' },
  { value: 'admin_created', label: 'Admin Created' },
  { value: 'admin_disabled', label: 'Admin Disabled' },
  { value: 'settings_updated', label: 'Settings Updated' },
];

function formatAction(action) {
  return action
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

function actionTone(action) {
  if (action.includes('failed') || action.includes('struck_off') || action.includes('disabled')) return 'danger';
  if (action.includes('finalized') || action.includes('created') || action.includes('restored') || action === 'login' || action.includes('enabled'))
    return 'success';
  if (action.includes('reopened')) return 'warning';
  return 'info';
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [error, setError] = useState(false);

  const load = () => {
    setError(false);
    auditLogService
      .list({ page, limit: PAGE_SIZE, action: actionFilter })
      .then((res) => {
        setLogs(res.data.logs);
        setTotal(res.data.total);
      })
      .catch(() => setError(true));
  };

  useEffect(load, [page, actionFilter]);
  useEffect(() => setPage(1), [actionFilter]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <PageContainer>
      <PageHeader title="Audit Logs" description="A record of important actions taken across the system." />

      <Card className="mb-5">
        <Select
          placeholder="All Actions"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          options={ACTION_OPTIONS}
        />
      </Card>

      {error ? (
        <ErrorState description="We couldn't load audit logs." onRetry={load} />
      ) : logs === null ? (
        <SkeletonTable rows={8} cols={4} />
      ) : logs.length === 0 ? (
        <EmptyState icon={History} title="No activity found" description="Try a different filter, or check back after more actions occur." />
      ) : (
        <>
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Date/Time</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log._id}>
                      <td className="text-gray-500 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                      <td className="font-medium">{log.user?.name || log.userLabel || 'System'}</td>
                      <td className="text-gray-600">
                        <Badge tone={actionTone(log.action)}>{formatAction(log.action)}</Badge>
                      </td>
                      <td className="text-gray-500 max-w-md truncate">{log.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-5">
              <Button size="sm" variant="secondary" icon={ChevronLeft} disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                Prev
              </Button>
              <span className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </span>
              <Button
                size="sm"
                variant="secondary"
                iconRight={ChevronRight}
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}
