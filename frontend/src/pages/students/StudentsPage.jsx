import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Upload, Download, Pencil, Ban, RotateCcw, Trash2, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/ui/PageContainer.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Select from '../../components/ui/Select.jsx';
import { StudentStatusBadge } from '../../components/ui/Badge.jsx';
import ConfirmModal from '../../components/ui/ConfirmModal.jsx';
import { SkeletonTable } from '../../components/ui/Skeleton.jsx';
import { EmptyState, ErrorState } from '../../components/ui/EmptyState.jsx';
import { studentService } from '../../services/studentService.js';
import { classService } from '../../services/classService.js';
import { useToast } from '../../context/ToastContext.jsx';
import { downloadFile } from '../../utils/downloadFile.js';
import StudentFormModal from './StudentFormModal.jsx';
import BulkImportModal from './BulkImportModal.jsx';
import StrikeOffModal from './StrikeOffModal.jsx';
import { getActiveStrikeOff } from '../../utils/strikeOff.js';

const PAGE_SIZE = 20;

export default function StudentsPage() {
  const toast = useToast();
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [strikeOffTarget, setStrikeOffTarget] = useState(null);
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    classService.list().then((res) => setClasses(res.data));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = () => {
    setError(false);
    studentService
      .list({ search: debouncedSearch, classId: classFilter, status: statusFilter, page, limit: PAGE_SIZE })
      .then((res) => {
        setStudents(res.data.students);
        setTotal(res.data.total);
      })
      .catch(() => setError(true));
  };

  useEffect(load, [debouncedSearch, classFilter, statusFilter, page]);
  useEffect(() => setPage(1), [debouncedSearch, classFilter, statusFilter]);

  const handleRestore = async () => {
    setActionLoading(true);
    try {
      await studentService.restore(restoreTarget._id);
      toast.success(`${restoreTarget.name} restored to Active`);
      setRestoreTarget(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    setActionLoading(true);
    try {
      await studentService.delete(deleteTarget._id);
      toast.success(`${deleteTarget.name} was permanently deleted`);
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <PageContainer>
      <PageHeader
        title="Students"
        description="Register students, search records, and manage struck-off status."
        actions={
          <>
            <Button
              variant="secondary"
              icon={Download}
              onClick={() => downloadFile(studentService.exportUrl(classFilter), 'students.xlsx', toast)}
            >
              Export
            </Button>
            <Button variant="secondary" icon={Upload} onClick={() => setImportOpen(true)}>
              Bulk Import
            </Button>
            <Button
              icon={Plus}
              onClick={() => {
                setEditingStudent(null);
                setFormOpen(true);
              }}
            >
              Add Student
            </Button>
          </>
        }
      />

      {/* Filters */}
      <Card className="mb-5">
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="h-4 w-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              className="input pl-9"
              placeholder="Search by name or roll number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            placeholder="All Classes"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            options={classes.map((c) => ({ value: c._id, label: `${c.name}${c.section ? ` — ${c.section}` : ''}` }))}
          />
          <Select
            placeholder="All Statuses"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'struck_off', label: 'Struck Off' },
            ]}
          />
        </div>
      </Card>

      {error ? (
        <ErrorState description="We couldn't load students." onRetry={load} />
      ) : students === null ? (
        <SkeletonTable rows={8} cols={6} />
      ) : students.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No students found"
          description="Try adjusting your search or filters, or add a new student."
          action={
            <Button icon={Plus} onClick={() => setFormOpen(true)}>
              Add Student
            </Button>
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Roll No</th>
                    <th>Name</th>
                    <th>Class</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s._id} className={s.status === 'struck_off' ? 'row-struck-off' : ''}>
                      <td className="font-medium">{s.rollNumber}</td>
                      <td>
                        <Link to={`/students/${s._id}`} className="text-brand-600 hover:underline font-medium">
                          {s.name}
                        </Link>
                      </td>
                      <td className="text-gray-500">
                        {s.class?.name}
                        {s.class?.academicSession ? ` (${s.class.academicSession})` : ''}
                      </td>
                      <td>
                        <StudentStatusBadge status={s.status} subjectName={getActiveStrikeOff(s)?.subjectName} reason={getActiveStrikeOff(s)?.reason} />
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={Pencil}
                            onClick={() => {
                              setEditingStudent(s);
                              setFormOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                          {s.status === 'active' ? (
                            <Button size="sm" variant="ghost" icon={Ban} className="text-danger-600" onClick={() => setStrikeOffTarget(s)}>
                              Strike Off
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" icon={RotateCcw} className="text-success-600" onClick={() => setRestoreTarget(s)}>
                              Restore
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" icon={Trash2} className="text-danger-600" onClick={() => setDeleteTarget(s)}>
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {students.map((s) => (
              <Card key={s._id} className={s.status === 'struck_off' ? 'row-struck-off' : ''}>
                <div className="flex items-start justify-between">
                  <div>
                    <Link to={`/students/${s._id}`} className="font-semibold text-gray-900">
                      {s.name}
                    </Link>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Roll {s.rollNumber} · {s.class?.name}
                    </p>
                  </div>
                  <StudentStatusBadge status={s.status} subjectName={getActiveStrikeOff(s)?.subjectName} reason={getActiveStrikeOff(s)?.reason} />
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={Pencil}
                    onClick={() => {
                      setEditingStudent(s);
                      setFormOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  {s.status === 'active' ? (
                    <Button size="sm" variant="danger" icon={Ban} onClick={() => setStrikeOffTarget(s)}>
                      Strike Off
                    </Button>
                  ) : (
                    <Button size="sm" variant="success" icon={RotateCcw} onClick={() => setRestoreTarget(s)}>
                      Restore
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" icon={Trash2} className="text-danger-600" onClick={() => setDeleteTarget(s)}>
                    Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {/* Pagination */}
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

      <StudentFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        classes={classes}
        student={editingStudent}
        defaultClassId={classFilter}
        onSaved={load}
      />
      <BulkImportModal open={importOpen} onClose={() => setImportOpen(false)} classes={classes} onImported={load} />

      <StrikeOffModal open={!!strikeOffTarget} onClose={() => setStrikeOffTarget(null)} student={strikeOffTarget} onDone={load} />
      <ConfirmModal
        open={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        onConfirm={handleRestore}
        loading={actionLoading}
        title="Restore Student"
        message={`Restore ${restoreTarget?.name} to Active status? They will be able to receive marks and attendance again.`}
        confirmLabel="Restore Student"
        tone="success"
      />
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={actionLoading}
        title="Delete Student"
        message={`This will permanently delete ${deleteTarget?.name} (Roll ${deleteTarget?.rollNumber}). This cannot be undone. Their historical results are unaffected. Continue?`}
        confirmLabel="Delete Permanently"
        tone="danger"
      />
    </PageContainer>
  );
}
