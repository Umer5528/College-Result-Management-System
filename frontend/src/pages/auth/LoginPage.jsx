import React, { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GraduationCap, LogIn, ShieldCheck, Users2, ClipboardCheck } from 'lucide-react';
import Input from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

const FEATURES = [
  { icon: Users2, text: 'Manage classes, subjects and students in one place' },
  { icon: ClipboardCheck, text: 'Teachers submit results with a simple secure link — no login needed' },
  { icon: ShieldCheck, text: 'Role-based access for Super Admins and Admins' },
];

function validate({ email, password }) {
  const errors = {};
  if (!email.trim()) errors.email = 'Email is required';
  else if (!/^\S+@\S+\.\S+$/.test(email)) errors.email = 'Enter a valid email address';
  if (!password) errors.password = 'Password is required';
  return errors;
}

export default function LoginPage() {
  const { login, isAuthenticated, initializing } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  if (!initializing && isAuthenticated) {
    const dest = location.state?.from?.pathname || '/';
    return <Navigate to={dest} replace />;
  }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    if (errors[name]) setErrors((er) => ({ ...er, [name]: undefined }));
    if (formError) setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    setFormError('');
    try {
      const user = await login(form.email.trim(), form.password);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`);
      const dest = location.state?.from?.pathname || '/';
      navigate(dest, { replace: true });
    } catch (err) {
      // Never surface raw API/network error text to the user.
      const message = err?.response?.data?.message;
      setFormError(
        message && err.response.status < 500
          ? message
          : 'Something went wrong. Please check your details and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Branding panel - hidden on small screens to keep mobile focused on the form */}
      <div className="hidden lg:flex relative bg-brand-gradient overflow-hidden flex-col justify-between p-10 xl:p-14 text-white">
        <div className="absolute inset-0 bg-aurora" />
        <motion.div
          className="absolute -top-20 -left-20 h-72 w-72 rounded-full bg-white/10 blur-3xl"
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        />

        <div className="relative z-10 flex items-center gap-3">
          <span className="h-11 w-11 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur">
            <GraduationCap className="h-6 w-6" />
          </span>
          <span className="font-semibold text-lg">College Result Management System</span>
        </div>

        <div className="relative z-10">
          <h2 className="text-3xl xl:text-4xl font-bold leading-tight mb-6">
            Exams, attendance and results — organized in one simple system.
          </h2>
          <ul className="space-y-4">
            {FEATURES.map((f, i) => (
              <motion.li
                key={f.text}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.1, duration: 0.4 }}
                className="flex items-start gap-3 text-white/90"
              >
                <span className="mt-0.5 h-8 w-8 shrink-0 rounded-lg bg-white/15 flex items-center justify-center">
                  <f.icon className="h-4 w-4" />
                </span>
                <span className="text-sm">{f.text}</span>
              </motion.li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-white/60">Secure sign-in for Super Admins and Admins only.</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-10 bg-gray-50">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-sm"
        >
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <span className="h-11 w-11 rounded-xl bg-brand-gradient flex items-center justify-center">
              <GraduationCap className="h-6 w-6 text-white" />
            </span>
            <span className="font-semibold text-gray-900">College Result Management System</span>
          </div>

          <h1 className="text-xl font-bold text-gray-900">Sign in to your account</h1>
          <p className="text-sm text-gray-500 mt-1 mb-6">Enter your email and password to continue.</p>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <Input
              label="Email"
              name="email"
              type="email"
              autoComplete="username"
              placeholder="you@college.com"
              value={form.email}
              onChange={handleChange}
              error={errors.email}
              required
            />
            <Input
              label="Password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={form.password}
              onChange={handleChange}
              error={errors.password}
              required
            />

            {formError && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl bg-danger-50 text-danger-600 text-sm font-medium px-3.5 py-2.5"
              >
                {formError}
              </motion.div>
            )}

            <Button type="submit" icon={LogIn} loading={submitting} className="w-full">
              Sign In
            </Button>
          </form>

          <p className="text-xs text-gray-400 text-center mt-8">
            Having trouble signing in? Contact your Super Admin to reset your password.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
