import type { ReactNode } from 'react';
import { ACTION_LABEL } from '../../lib/riskScoring';
import { TONE, actionTone, cn, sensitivityTone, severityTone, stateTone, type ToneKey } from '../../lib/utils';
import type { AgentState, AlertStatus, EnforcementAction, LaneStatus, Sensitivity, Severity } from '../../types';

export function Badge({ tone = 'muted', children, className, dot }: { tone?: ToneKey; children: ReactNode; className?: string; dot?: boolean }) {
  const t = TONE[tone];
  return (
    <span className={cn('tag', t.text, t.bg, t.border, className)}>
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', t.dot)} />}
      {children}
    </span>
  );
}

export const SeverityBadge = ({ severity }: { severity: Severity }) => (
  <Badge tone={severityTone(severity)} dot>{severity}</Badge>
);
export const ActionBadge = ({ action }: { action: EnforcementAction }) => (
  <Badge tone={actionTone(action)}>{ACTION_LABEL[action]}</Badge>
);
export const SensBadge = ({ s }: { s: Sensitivity }) => <Badge tone={sensitivityTone(s)}>{s}</Badge>;
export const StateBadge = ({ s }: { s: AgentState }) => <Badge tone={stateTone(s)} dot>{s}</Badge>;
export const StatusBadge = ({ s }: { s: AlertStatus }) => (
  <Badge tone={s === 'open' ? 'danger' : s === 'acknowledged' ? 'warn' : 'muted'} dot>{s}</Badge>
);
export const LaneChip = ({ status }: { status: LaneStatus }) => (
  <Badge tone={status === 'pass' ? 'ok' : status === 'warn' ? 'warn' : 'danger'}>{status === 'pass' ? 'PASS' : status === 'warn' ? 'WARN' : 'FAIL'}</Badge>
);
export const SimBadge = ({ className }: { className?: string }) => (
  <Badge tone="warn" className={className}>
    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warn" />
    Simulation
  </Badge>
);
export const TrustBadge = ({ trust }: { trust: 'trusted' | 'untrusted' }) => (
  <Badge tone={trust === 'untrusted' ? 'danger' : 'ok'}>{trust}</Badge>
);

export function ScorePill({ score }: { score: number }) {
  const tone = score >= 75 ? 'danger' : score >= 55 ? 'brand' : score >= 35 ? 'warn' : score >= 20 ? 'neon' : 'ok';
  const t = TONE[tone];
  return (
    <span className={cn('inline-flex min-w-[2.6rem] justify-center rounded-md border px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums', t.text, t.bg, t.border)}>
      {score}
    </span>
  );
}
