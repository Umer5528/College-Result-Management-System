import React, { useEffect, useState } from 'react';
import { Plus, ShieldCheck, Ban, RotateCcw, KeyRound } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/ui/PageContainer.jsx';
import Card from '../../components/ui/Card.jsx';
import Button from '../../components/ui/Button.jsx';
import Input from '../../components/ui/Input.jsx';
import Modal from '../../components/ui/Modal.jsx';
import ConfirmModal from '../../components/ui/ConfirmModal.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { SkeletonTable } from '../../components/ui/Skeleton.jsx';
import { EmptyState, ErrorState } from '../../components/ui/EmptyState.jsx';
import { superAdminService } from '../../services/adminServices.js';
import { useToast } from '../../context/ToastContext.jsx';

function CreateAdminModal({ open, onClose, onCreated }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = 'Name is required';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) nextErrors.email = 'Valid email is required';
    if (form.password.length < 6) nextErrors.password = 'Must be at least 6 characters';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await superAdminService.createAdmin(form);
      toast.success(`Admin account created for ${form.name}`);
      setForm({ name: '', email: '', password: '' });
      onCreated();
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
      title="Create Admin Account"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            Create Admin
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Full Name" name="name" value={form.name} onChange={handleChange} error={errors.name} required />
        <Input label="Email" name="email" type="email" value={form.email} onChange={handleChange} error={errors.email} required />
        <Input
          label="Temporary Password"
          name="password"
          type="password"
          value={form.password}
          onChange={handleChange}
          error={errors.password}
          help="The Admin should change this after their first login."
          required
        />
      </form>
    </Modal>
  );
}

export default function AdminManagementPage() {
  const toast = useToast();
  const [admins, setAdmins] = useState(null);
  const [error, setError] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [toggleTarget, setToggleTarget] = useState(null); // { admin, action: 'disable'|'enable' }
  const [resetTarget, setResetTarget] = useState(null);
  const [resetResult, setResetResult] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const load = () => {
    setError(false);
    superAdminService
      .listAdmins()
      .then((res) => setAdmins(res.data))
      .catch(() => setError(true));
  };

  useEffect(load, []);

  const handleToggle = async () => {
    setActionLoading(true);
    try {
      if (toggleTarget.action === 'disable') {
        await superAdminService.disableAdmin(toggleTarget.admin._id);
        toast.success(`${toggleTarget.admin.name}'s account disabled`);
      } else {
        await superAdminService.enableAdmin(toggleTarget.admin._id);
        toast.success(`${toggleTarget.admin.name}'s account enabled`);
      }
      setToggleTarget(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReset = async () => {
    setActionLoading(true);
    try {
      const res = await superAdminService.resetPassword(resetTarget._id);
      setResetResult(res.data.temporaryPassword);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Admin Management"
        description="Create and manage Admin accounts for your college."
        actions={
          <Button icon={Plus} onClick={() => setCreateOpen(true)}>
            Create Admin
          </Button>
        }
      />

      {error ? (
        <ErrorState description="We couldn't load admin accounts." onRetry={load} />
      ) : admins === null ? (
        <SkeletonTable rows={5} cols={4} />
      ) : admins.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No Admin accounts yet"
          description="Create the first Admin account for your college."
          action={
            <Button icon={Plus} onClick={() => setCreateOpen(true)}>
              Create Admin
            </Button>
          }
        />
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {admins.map((a) => (
                  <tr key={a._id}>
                    <td className="font-medium">{a.name}</td>
                    <td className="text-gray-500">{a.email}</td>
                    <td>
                      <Badge tone={a.isActive ? 'success' : 'danger'}>{a.isActive ? 'Active' : 'Disabled'}</Badge>
                    </td>
                    <td className="text-gray-500">{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString() : 'Never'}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" icon={KeyRound} onClick={() => setResetTarget(a)}>
                          Reset Password
                        </Button>
                        {a.isActive ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={Ban}
                            className="text-danger-600"
                            onClick={() => setToggleTarget({ admin: a, action: 'disable' })}
                          >
                            Disable
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={RotateCcw}
                            className="text-success-600"
                            onClick={() => setToggleTarget({ admin: a, action: 'enable' })}
                          >
                            Enable
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <CreateAdminModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={load} />

      <ConfirmModal
        open={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={handleToggle}
        loading={actionLoading}
        title={toggleTarget?.action === 'disable' ? 'Disable Admin Account' : 'Enable Admin Account'}
        message={
          toggleTarget?.action === 'disable'
            ? `${toggleTarget?.admin.name} will no longer be able to log in. Continue?`
            : `${toggleTarget?.admin.name} will be able to log in again. Continue?`
        }
        confirmLabel={toggleTarget?.action === 'disable' ? 'Disable Account' : 'Enable Account'}
        tone={toggleTarget?.action === 'disable' ? 'danger' : 'success'}
      />

      <Modal
        open={!!resetTarget}
        onClose={() => {
          setResetTarget(null);
          setResetResult(null);
        }}
        title="Reset Admin Password"
        footer={
          !resetResult && (
            <>
              <Button variant="secondary" onClick={() => setResetTarget(null)}>
                Cancel
              </Button>
              <Button onClick={handleReset} loading={actionLoading}>
                Reset Password
              </Button>
            </>
          )
        }
      >
        {resetResult ? (
          <div className="text-center py-2">
            <p className="text-sm text-gray-600 mb-3">New temporary password for {resetTarget?.name}:</p>
            <code className="block rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-base font-mono font-semibold">
              {resetResult}
            </code>
            <p className="text-xs text-gray-400 mt-3">Share this securely. They should change it after logging in.</p>
          </div>
        ) : (
          <p className="text-sm text-gray-600">
            This generates a new temporary password for <strong>{resetTarget?.name}</strong>. Continue?
          </p>
        )}
      </Modal>
    </PageContainer>
  );
}
