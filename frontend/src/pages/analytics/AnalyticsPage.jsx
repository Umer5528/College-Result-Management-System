import React, { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { PageContainer, PageHeader } from '../../components/ui/PageContainer.jsx';
import Card from '../../components/ui/Card.jsx';
import Select from '../../components/ui/Select.jsx';
import { EmptyState, ErrorState } from '../../components/ui/EmptyState.jsx';
import { PageLoader } from '../../components/ui/Loading.jsx';
import { classService } from '../../services/classService.js';
import { examinationService } from '../../services/examinationService.js';
import { resultService } from '../../services/reportServices.js';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#a855f7', '#ef4444', '#0ea5e9'];

export default function AnalyticsPage() {
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [exams, setExams] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    classService.list().then((res) => setClasses(res.data));
  }, []);

  useEffect(() => {
    if (!classId) {
      setExams([]);
      setResults([]);
      return;
    }
    setLoading(true);
    setError(false);
    examinationService
      .list({ classId, status: 'finalized' })
      .then(async (res) => {
        const finalizedExams = res.data.sort((a, b) => new Date(a.resultDate) - new Date(b.resultDate));
        setExams(finalizedExams);
        const resultData = await Promise.all(finalizedExams.map((e) => resultService.get(e._id)));
        setResults(resultData.map((r) => r.data));
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [classId]);

  const performanceTrend = exams.map((e, idx) => ({
    name: e.name,
    'Average %': results[idx]?.result?.stats?.averagePercentage ?? null,
    'Passing %': results[idx]?.result?.stats?.passingPercentage ?? null,
  }));

  const attendanceTrend = exams.map((e, idx) => ({
    name: e.name,
    'Attendance %': results[idx]?.result?.stats?.attendanceAverage ?? null,
  }));

  // Subject comparison for the most recent finalized exam in this class
  const latestResult = results[results.length - 1]?.result;
  const subjectComparison = (latestResult?.stats?.subjectStats || []).map((ss) => ({
    name: ss.subjectName,
    Average: ss.average,
    'Pass %': ss.passingPercentage,
  }));

  return (
    <PageContainer>
      <PageHeader title="Performance Analytics" description="Visual trends built from your finalized examination results." />

      <Card className="mb-6">
        <Select
          label="Select a class to analyze"
          placeholder="Choose a class"
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          options={classes.map((c) => ({ value: c._id, label: `${c.name}${c.section ? ` — ${c.section}` : ''}` }))}
        />
      </Card>

      {!classId ? (
        <EmptyState icon={TrendingUp} title="Choose a class" description="Select a class above to see its performance trends." />
      ) : error ? (
        <ErrorState description="We couldn't load analytics for this class." onRetry={() => setClassId(classId)} />
      ) : loading ? (
        <PageLoader label="Crunching the numbers..." />
      ) : exams.length === 0 ? (
        <EmptyState icon={TrendingUp} title="No finalized exams yet" description="Analytics will appear once this class has finalized results." />
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <h2 className="font-semibold text-gray-900 text-sm mb-4">Average % and Passing % by Examination</h2>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={performanceTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Average %" stroke="#6366f1" strokeWidth={2} />
                <Line type="monotone" dataKey="Passing %" stroke="#10b981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <h2 className="font-semibold text-gray-900 text-sm mb-4">Attendance Trend</h2>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={attendanceTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="Attendance %" stroke="#a855f7" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card className="lg:col-span-2">
            <h2 className="font-semibold text-gray-900 text-sm mb-4">
              Subject Performance — {exams[exams.length - 1]?.name} (most recent)
            </h2>
            {subjectComparison.length === 0 ? (
              <EmptyState icon={TrendingUp} title="No subject data" description="Subject statistics will appear once available." />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={subjectComparison}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Average" fill={COLORS[0]} radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Pass %" fill={COLORS[1]} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
