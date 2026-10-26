import { motion } from 'framer-motion';
import { Activity, Ban, Brain, CheckCircle2, Gauge, Gavel, KeyRound, Radio } from 'lucide-react';
import { TONE, cn } from '../../lib/utils';
import type { EnforcementAction, Signal, StageKey } from '../../types';
import { isBlocking } from '../../lib/riskScoring';

export type StageState = 'idle' | 'active' | 'done' | 'warn' | 'block';

export const STAGES: { key: StageKey; label: string; short: string; icon: typeof Radio }[] = [
  { key: 'request', label: 'Agent Request', short: 'Request', icon: Radio },
  { key: 'identity', label: 'Identity & Role Check', short: 'Role', icon: KeyRound },
  { key: 'taint', label: 'Context & Taint Analysis', short: 'Taint', icon: Brain },
  { key: 'drift', label: 'Behavioural Drift Detection', short: 'Drift', icon: Activity },
  { key: 'score', label: 'Risk Scoring', short: 'Score', icon: Gauge },
  { key: 'policy', label: 'Policy Enforcement', short: 'Policy', icon: Gavel },
  { key: 'outcome', label: 'Allowed / Blocked', short: 'Outcome', icon: CheckCircle2 },
];

export function stageStates(stage: number, decided: boolean, revealed: Signal[], score: number, action: EnforcementAction, hasEvent: boolean): StageState[] {
  const hit = (fams: string[]) => revealed.filter((s) => s.triggered && fams.includes(s.family));
  return STAGES.map((_, i) => {
    if (stage < 0 || i > stage) return 'idle';
    if (i === stage && !decided) return 'active';
    if (!hasEvent) return 'done';
    switch (i) {
      case 1: { const h = hit(['contract', 'egress']); return h.some((s) => s.hard) ? 'block' : h.length ? 'warn' : 'done'; }
      case 2: { const h = hit(['taint', 'delegation']); return h.some((s) => s.value >= 0.5) ? 'block' : h.length ? 'warn' : 'done'; }
      case 3: { const h = hit(['behaviour', 'identity']); return h.some((s) => s.value >= 0.7) ? 'block' : h.length ? 'warn' : 'done'; }
      case 4: return score >= 75 ? 'block' : score >= 35 ? 'warn' : 'done';
      case 5: return isBlocking(action) ? 'block' : action === 'watch' || action === 'step_up' ? 'warn' : 'done';
      case 6: return isBlocking(action) ? 'block' : action === 'step_up' ? 'warn' : 'done';
      default: return 'done';
    }
  });
}

const STATE_TONE = { idle: 'muted', active: 'neon', done: 'ok', warn: 'warn', block: 'danger' } as const;

export function Pipeline({ states, outcomeLabel, compact }: { states: StageState[]; outcomeLabel?: string; compact?: boolean }) {
  return (
    <ol className="flex flex-col gap-1 md:flex-row md:items-stretch md:gap-0" aria-label="Gateway evaluation pipeline">
      {STAGES.map((s, i) => {
        const st = states[i];
        const t = TONE[STATE_TONE[st]];
        const Icon = i === 6 && st === 'block' ? Ban : s.icon;
        return (
          <li key={s.key} className="flex min-w-0 flex-1 items-center md:flex-col md:justify-start">
            <div className="flex w-full items-center md:flex-col">
              <div className="relative flex shrink-0 items-center justify-center">
                {st === 'active' && <span className="absolute h-11 w-11 animate-pulseRing rounded-full border border-neon/70" />}
                <motion.div
                  animate={{ scale: st === 'active' ? 1.08 : 1 }}
                  className={cn(
                    'relative z-10 grid h-11 w-11 place-items-center rounded-xl border backdrop-blur transition-colors',
                    t.border, t.bg, t.text,
                    st === 'block' && 'glow-danger', st === 'active' && 'glow-neon', st === 'done' && 'glow-ok',
                  )}
                >
                  <Icon size={18} aria-hidden />
                </motion.div>
              </div>
              <div className="mx-3 min-w-0 flex-1 md:mx-0 md:mt-2 md:text-center">
                <div className={cn('font-mono text-[10.5px] font-semibold uppercase tracking-wider', t.text)}>
                  {compact ? s.short : i === 6 && outcomeLabel && st !== 'idle' ? outcomeLabel : s.label}
                </div>
                <div className="font-mono text-[9.5px] uppercase tracking-widest text-muted/70">
                  {st === 'idle' ? 'pending' : st === 'active' ? 'processing…' : st === 'done' ? 'clear' : st === 'warn' ? 'signal' : 'violation'}
                </div>
              </div>
            </div>
            {i < STAGES.length - 1 && (
              <div className="relative ml-[21px] hidden h-px flex-1 md:hidden" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Horizontal track with a travelling packet, drawn beneath the stage icons on wide screens. */
export function PipelineTrack({ progress, blocked }: { progress: number; blocked: boolean }) {
  return (
    <div className="pointer-events-none relative mx-[7%] hidden h-px md:block" aria-hidden>
      <div className="absolute inset-0 bg-line/15" />
      <motion.div
        className={cn('absolute left-0 top-0 h-px', blocked ? 'bg-danger shadow-[0_0_10px_rgb(var(--danger))]' : 'bg-neon shadow-[0_0_10px_rgb(var(--neon))]')}
        animate={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }} transition={{ duration: 0.3 }}
      />
    </div>
  );
}
