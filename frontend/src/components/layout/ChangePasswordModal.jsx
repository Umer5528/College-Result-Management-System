import React, { useState } from 'react';
import Modal from '../ui/Modal.jsx';
import Input from '../ui/Input.jsx';
import Button from '../ui/Button.jsx';
import { authService } from '../../services/authService.js';
import { useToast } from '../../context/ToastContext.jsx';

export default function ChangePasswordModal({ open, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleClose = () => {
    setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setErrors({});
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    if (!form.currentPassword) nextErrors.currentPassword = 'Enter your current password';
    if (!form.newPassword || form.newPassword.length < 6) nextErrors.newPassword = 'Must be at least 6 characters';
    if (form.newPassword !== form.confirmPassword) nextErrors.confirmPassword = 'Passwords do not match';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await authService.changePassword(form.currentPassword, form.newPassword);
      toast.success('Password updated successfully');
      handleClose();
    } catch (err) {
      const message = err?.response?.data?.message;
      setErrors({ currentPassword: message && err.response.status < 500 ? message : 'Something went wrong. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Change Password">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Current Password"
          type="password"
          name="currentPassword"
          value={form.currentPassword}
          onChange={handleChange}
          error={errors.currentPassword}
          required
        />
        <Input
          label="New Password"
          type="password"
          name="newPassword"
          value={form.newPassword}
          onChange={handleChange}
          error={errors.newPassword}
          required
        />
        <Input
          label="Confirm New Password"
          type="password"
          name="confirmPassword"
          value={form.confirmPassword}
          onChange={handleChange}
          error={errors.confirmPassword}
          required
        />
        <Button type="submit" loading={submitting} className="w-full">
          Update Password
        </Button>
      </form>
    </Modal>
  );
}
