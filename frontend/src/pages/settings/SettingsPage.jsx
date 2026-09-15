import React, { useEffect, useState } from 'react';
import { Building2, Save } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/ui/PageContainer.jsx';
import Card from '../../components/ui/Card.jsx';
import Input from '../../components/ui/Input.jsx';
import { Textarea } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import { PageLoader } from '../../components/ui/Loading.jsx';
import { settingsService } from '../../services/adminServices.js';
import { useToast } from '../../context/ToastContext.jsx';

const FIELDS = [
  { name: 'collegeName', label: 'College Name', required: true },
  { name: 'logoUrl', label: 'Logo URL', help: 'Paste a hosted image link. Shown on reports and the login screen.' },
  { name: 'principalName', label: 'Principal / Head Name' },
  { name: 'academicSession', label: 'Academic Session', help: 'e.g. 2026-27' },
  { name: 'phone', label: 'Phone' },
  { name: 'email', label: 'Email' },
  { name: 'website', label: 'Website' },
  { name: 'city', label: 'City' },
  { name: 'province', label: 'Province' },
  { name: 'country', label: 'Country' },
];

export default function SettingsPage() {
  const toast = useToast();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsService
      .get()
      .then((res) => setForm(res.data))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await settingsService.update(form);
      setForm(res.data);
      toast.success('College settings updated');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) return <PageLoader label="Loading settings..." />;

  return (
    <PageContainer>
      <PageHeader title="College Settings" description="This information appears on every result report, PDF and Excel export." />

      <div className="grid lg:grid-cols-3 gap-6">
        <form onSubmit={handleSubmit} className="lg:col-span-2">
          <Card>
            <div className="grid sm:grid-cols-2 gap-4">
              {FIELDS.map((f) => (
                <Input
                  key={f.name}
                  label={f.label}
                  name={f.name}
                  required={f.required}
                  help={f.help}
                  value={form[f.name] || ''}
                  onChange={handleChange}
                  className={f.name === 'collegeName' || f.name === 'logoUrl' ? 'sm:col-span-2' : ''}
                />
              ))}
              <Textarea
                label="Address"
                name="address"
                value={form.address || ''}
                onChange={handleChange}
                className="sm:col-span-2"
              />
            </div>
            <div className="mt-6 flex justify-end">
              <Button type="submit" icon={Save} loading={saving}>
                Save Settings
              </Button>
            </div>
          </Card>
        </form>

        {/* Report branding preview */}
        <Card className="h-fit">
          <h2 className="font-semibold text-gray-900 text-sm mb-4">Report Branding Preview</h2>
          <div className="rounded-xl border border-dashed border-gray-200 p-5 text-center">
            {form.logoUrl ? (
              <img src={form.logoUrl} alt="College logo" className="h-14 mx-auto mb-3 object-contain" />
            ) : (
              <div className="h-14 w-14 rounded-xl bg-brand-gradient mx-auto mb-3 flex items-center justify-center">
                <Building2 className="h-7 w-7 text-white" />
              </div>
            )}
            <p className="font-bold text-gray-900">{form.collegeName || 'Your College Name'}</p>
            <p className="text-xs text-gray-500 mt-1">
              {[form.address, form.city, form.province, form.country].filter(Boolean).join(', ') || 'Address not set'}
            </p>
            <p className="text-xs text-gray-400 mt-2">Academic Session: {form.academicSession || '—'}</p>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}
