import React from 'react';
import { AlertTriangle, CheckCircle2, Clock, Info } from 'lucide-react';

const TONE_CLASS = {
  danger: 'badge-danger',
  success: 'badge-success',
  warning: 'badge-warning',
  info: 'badge-info',
  neutral: 'badge-neutral',
};

export function Badge({ tone = 'neutral', icon: Icon, children, className = '' }) {
  return (
    <span className={`${TONE_CLASS[tone] || TONE_CLASS.neutral} ${className}`}>
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </span>
  );
}

/** Struck-off vs Active — the one badge referenced throughout the whole app. */
/** Struck-off students always show WHY, not just a bare "Struck Off" tag. */
export function StudentStatusBadge({ status, subjectName, reason }) {
  if (status === 'struck_off') {
    let label = 'STRUCK OFF';
    if (subjectName) label = `Struck Off: ${subjectName}`;
    else if (reason) label = 'Struck Off: All Subjects';
    return (
      <span className="inline-flex flex-col items-start gap-0.5">
        <Badge tone="danger" icon={AlertTriangle}>
          {label}
        </Badge>
        {reason && <span className="text-[11px] text-danger-600 pl-0.5">Reason: {reason}</span>}
      </span>
    );
  }
  return (
    <Badge tone="success" icon={CheckCircle2}>
      Active
    </Badge>
  );
}

const EXAM_STATUS_META = {
  draft: { tone: 'neutral', label: 'Draft', icon: Clock },
  submission_open: { tone: 'info', label: 'Link Open', icon: Info },
  submission_in_progress: { tone: 'warning', label: 'In Progress', icon: Clock },
  ready_for_review: { tone: 'warning', label: 'Ready to Finalize', icon: AlertTriangle },
  finalized: { tone: 'success', label: 'Finalized', icon: CheckCircle2 },
  archived: { tone: 'neutral', label: 'Archived', icon: Clock },
};

export function ExamStatusBadge({ status }) {
  const meta = EXAM_STATUS_META[status] || EXAM_STATUS_META.draft;
  return (
    <Badge tone={meta.tone} icon={meta.icon}>
      {meta.label}
    </Badge>
  );
}

export function PassFailBadge({ status, needsReview }) {
  let badge;
  if (status === 'pass') badge = <Badge tone="success" icon={CheckCircle2}>Passed</Badge>;
  else if (status === 'fail') badge = <Badge tone="danger" icon={AlertTriangle}>Failed</Badge>;
  else badge = <Badge tone="warning" icon={Clock}>Pending Decision</Badge>;

  if (!needsReview) return badge;
  return (
    <span className="inline-flex items-center gap-1.5">
      {badge}
      <span title="Marks changed since this decision was made — please review" className="text-warning-600">
        <AlertTriangle className="h-3.5 w-3.5" />
      </span>
    </span>
  );
}

/** Subtle gold/silver/bronze treatment for top-3 ranks; plain number otherwise. */
export function RankDisplay({ rank }) {
  if (rank == null) return <span className="text-gray-400">—</span>;
  if (rank <= 3) return <span className={`rank-badge-${rank}`}>{rank}</span>;
  return <span className="font-medium text-gray-700">{rank}</span>;
}

export default Badge;
