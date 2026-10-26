import { motion } from 'framer-motion';
import { Activity, Brain, ShieldCheck } from 'lucide-react';
import { ACTION_LABEL, isBlocking } from '../../lib/riskScoring';
import { TONE, cn } from '../../lib/utils';
import type { EnforcementAction, Lane, Signal, Triad } from '../../types';
import { FAMILY_LABEL } from '../../data/policies';
import { useStore } from '../../store/useStore';
import { Badge, LaneChip } from '../ui/Badges';

const LANES: { key: Lane; label: string; q: string; icon: typeof Brain }[] = [
  { key: 'role', label: 'ROLE', q: 'Is the action permitted for the declared role?', icon: ShieldCheck },
  { key: 'reason', label: 'REASON', q: 'Is it justified by the task and what the agent just read?', icon: Brain },
  { key: 'routine', label: 'ROUTINE', q: 'Is it consistent with the agent\'s normal behaviour?', icon: Activity },
];

export function TriadPanel({ triad, action }: { triad: Triad; action?: EnforcementAction; compact?: boolean }) {
  const showHints = useStore((s) => s.prefs.display.showLaneHints);
  return (
    <div>
      <div className="grid gap-3 md:grid-cols-3">
        {LANES.map((l, i) => {
          const lane = triad[l.key];
          const tone = lane.status === 'pass' ? 'ok' : lane.status === 'warn' ? 'warn' : 'danger';
          const t = TONE[tone];
          return (
            <motion.div
              key={l.key}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className={cn('relative overflow-hidden rounded-xl border p-3.5', t.border, t.bg)}
            >
              <div className="flex items-center justify-between gap-2">
                <div className={cn('flex items-center gap-2 font-mono text-xs font-semibold tracking-[0.18em]', t.text)}>
                  <l.icon size={14} aria-hidden /> {l.label}
                </div>
                <LaneChip status={lane.status} />
              </div>
              {showHints && <p className="mt-1.5 text-[11px] text-muted">{l.q}</p>}
              <p className="mt-2 text-[12.5px] leading-snug text-fg/90">{lane.summary}</p>
            </motion.div>
          );
        })}
      </div>
      {action && (
        <div
          className={cn(
            'mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-2.5 font-mono text-xs',
            isBlocking(action) ? 'border-danger/40 bg-danger/10 text-danger' : action === 'allow' ? 'border-ok/30 bg-ok/10 text-ok' : 'border-warn/30 bg-warn/10 text-warn',
          )}
        >
          <span className="tracking-[0.2em]">FINAL DECISION</span>
          <span className="text-sm font-semibold tracking-wider">{isBlocking(action) ? 'BLOCKED' : ACTION_LABEL[action]}</span>
        </div>
      )}
    </div>
  );
}

export function SignalList({ signals, empty = 'No detector triggered.', grid }: { signals: Signal[]; empty?: string; grid?: boolean }) {
  const trig = signals.filter((s) => s.triggered).sort((a, b) => b.value * b.weight - a.value * a.weight);
  if (!trig.length) return <p className="text-xs text-muted">{empty}</p>;
  return (
    <ul className={grid ? 'grid gap-2 lg:grid-cols-2' : 'space-y-2'}>
      {trig.map((s, i) => (
        <li key={i} className="rounded-lg border border-line/[0.08] bg-bg/40 p-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[13px] font-medium">
              {s.title}
              {s.hard && <Badge tone="danger">hard</Badge>}
              {s.policyId && <Badge tone="muted">{s.policyId}</Badge>}
            </div>
            <span className="font-mono text-[11px] text-muted">{s.detector} · {FAMILY_LABEL[s.family]}</span>
          </div>
          <p className="mt-1 text-xs text-muted">{s.explanation}</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-fg/10">
              <div className="h-full rounded-full bg-gradient-to-r from-neon to-brand" style={{ width: `${Math.round(s.value * 100)}%` }} />
            </div>
            <span className="font-mono text-[10.5px] text-muted">s={s.value.toFixed(2)} · w={s.weight}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
