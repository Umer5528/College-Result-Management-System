import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, BookOpen, FileText, Award, ShieldCheck, BarChart3 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { PageContainer, PageHeader } from '../components/ui/PageContainer.jsx';
import { StatCard } from '../components/ui/Card.jsx';
import Card from '../components/ui/Card.jsx';
import { ExamStatusBadge } from '../components/ui/Badge.jsx';
import { SkeletonCard } from '../components/ui/Skeleton.jsx';
import { ErrorState, EmptyState } from '../components/ui/EmptyState.jsx';
import { dashboardService } from '../services/adminServices.js';
import { useAuth } from '../context/AuthContext.jsx';
import { timeGreeting, timeAgo } from '../utils/timeFormat.js';

export default function DashboardPage() {
  const { user, isSuperAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    setLoading(true);
    setError(false);
    dashboardService
      .get()
      .then((res) => setData(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <PageContainer>
      <PageHeader
        title={`${timeGreeting()}, ${user?.name?.split(' ')[0] || ''}`}
        description="Here's what's happening across your college right now."
      />

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : error ? (
        <ErrorState description="We couldn't load the dashboard. Please try again." onRetry={load} />
      ) : (
        <>
          {/* Only the six figures an administrator actually checks day to day */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <StatCard label="Total Students" value={data.cards.totalStudents} icon={Users} tone="brand" delay={0} />
            <StatCard label="Active Students" value={data.cards.activeStudents} icon={Users} tone="success" delay={0.03} />
            <StatCard label="Classes / Sections" value={data.cards.totalClasses} icon={BookOpen} tone="insight" delay={0.06} />
            <StatCard label="Active Examinations" value={data.cards.pendingSubmissions} icon={FileText} tone="brand" delay={0.09} />
            <StatCard label="Struck Off Students" value={data.cards.struckOffStudents} icon={Users} tone="danger" delay={0.12} />
            <StatCard label="Finalized Results" value={data.cards.completedResults} icon={Award} tone="success" delay={0.15} />
          </div>

          {isSuperAdmin && data.superAdmin && (
            <Card className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="h-4 w-4 text-brand-600" />
                <h2 className="font-semibold text-gray-900 text-sm">Super Admin Overview</h2>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-400 text-xs">Total Admins</p>
                  <p className="font-semibold text-gray-900">{data.superAdmin.totalAdmins}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">Active Admins</p>
                  <p className="font-semibold text-gray-900">{data.superAdmin.activeAdmins}</p>
                </div>
              </div>
            </Card>
          )}

          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <h2 className="font-semibold text-gray-900 text-sm mb-4">Performance Trend</h2>
              {data.trends.length === 0 ? (
                <EmptyState icon={BarChart3} title="No finalized exams yet" description="Trends will appear once results are finalized." />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={data.trends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef1f4" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="averagePercentage" name="Average %" stroke="#28455e" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="passingPercentage" name="Passing %" stroke="#3f7d52" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Card>

            <Card>
              <h2 className="font-semibold text-gray-900 text-sm mb-4">Recent Activity</h2>
              {data.recentExaminations.length === 0 ? (
                <EmptyState icon={FileText} title="No examinations yet" description="Create your first examination to get started." />
              ) : (
                <div className="space-y-2">
                  {data.recentExaminations.slice(0, 6).map((exam) => (
                    <Link
                      key={exam.id}
                      to={`/examinations/${exam.id}`}
                      className="flex items-center justify-between rounded-xl border border-gray-100 px-3.5 py-2.5 hover:bg-gray-50 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{exam.name}</p>
                        <p className="text-xs text-gray-400 truncate">
                          {exam.className} · {timeAgo(exam.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-gray-400 hidden sm:inline">
                          {exam.progress.submitted}/{exam.progress.total} submitted
                        </span>
                        <ExamStatusBadge status={exam.status} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </PageContainer>
  );
}
