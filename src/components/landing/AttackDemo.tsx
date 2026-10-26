import { AnimatePresence, motion } from 'framer-motion';
import { Ban, Bot, FileWarning, Network, Play, RotateCcw, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { buildAgents } from '../../data/agents';
import { buildContracts } from '../../data/contracts';
import { compileScenario } from '../../lib/simulationEngine';
import { DEFAULT_THRESHOLDS } from '../../lib/riskScoring';
import { TONE, cn, scoreTone } from '../../lib/utils';
import { narrateStep, STAGE_TITLE } from '../../lib/xai';
import { ActionBadge, Badge, SimBadge } from '../ui/Badges';
import { Button } from '../ui/Controls';

const NODES = [
  { label: 'Poisoned supplier document', sub: 'supplier_pricing_q3.pdf', icon: FileWarning },
  { label: 'Research Agent', sub: 'reads the document', icon: Bot },
  { label: 'Orchestrator Agent', sub: 'relays the task', icon: Network },
  { label: 'HR Agent', sub: 'valid credentials', icon: Users },
  { label: 'Restricted data export', sub: 'hr.export → external host', icon: Ban },
];
// scenario E steps used by the landing demo, and the chain node each one highlights
const PICK = [0, 2, 3, 5, 6, 7, 8, 9];
const ACTIVE = [1, 2, 3, 3, 4, 4, 4, 4];

/** Deterministic, backend-free replay of scenario E using the same engine as the dashboard. */
export function AttackDemo() {
  const compiled = useMemo(() => compileScenario('E', { agents: buildAgents(), contracts: buildContracts(), thresholds: DEFAULT_THRESHOLDS }), []);
  const [i, setI] = useState(-1);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    if (i >= PICK.length - 1) { setRunning(false); return; }
    const t = setTimeout(() => setI((x) => x + 1), i < 0 ? 200 : 1900);
    return () => clearTimeout(t);
  }, [running, i]);

  const cs = i >= 0 ? compiled.steps[PICK[i]] : undefined;
  const final = i === PICK.length - 1;
  const active = i >= 0 ? ACTIVE[i] : -1;
  const score = cs?.liveScore ?? 0;
  const signals = (cs?.revealed ?? []).filter((s) => s.triggered);
  const run = () => { setI(-1); setTimeout(() => { setI(0); setRunning(true); }, 60); };

  return (
    <div className="glass p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2"><SimBadge /><span className="text-xs text-muted">Simulated agents and events — no real systems.</span></div>
        <Button variant="primary" size="md" icon={i >= 0 && !running ? RotateCcw : Play} onClick={run} disabled={running}>{i >= 0 && !running ? 'Replay simulation' : running ? 'Running…' : 'Run Attack Simulation'}</Button>
      </div>

      <ol className="grid gap-2 md:grid-cols-5" aria-label="Attack chain">
        {NODES.map((n, k) => {
          const hit = active >= k;
          const isBlock = k === 4 && final;
          const tone = isBlock ? 'danger' : hit ? (k === 0 ? 'warn' : 'brand') : 'muted';
          return (
            <li key={n.label} className="relative">
              <motion.div animate={{ opacity: i < 0 || hit ? 1 : 0.45 }} className={cn('flex h-full items-center gap-3 rounded-lg border p-3 md:flex-col md:items-start', TONE[tone].border, hit ? TONE[tone].bg : 'bg-bg/40', isBlock && 'glow-danger')}>
                <n.icon size={18} className={TONE[tone].text} aria-hidden />
                <div className="min-w-0"><div className="text-[12.5px] font-semibold leading-tight">{n.label}</div><div className="mt-0.5 font-mono text-[10.5px] text-muted">{n.sub}</div></div>
                {isBlock && <Badge tone="danger" className="md:mt-1">blocked</Badge>}
              </motion.div>
              {k < NODES.length - 1 && <span className={cn('absolute -bottom-2 left-6 h-2 w-px md:-right-2 md:bottom-auto md:left-auto md:top-1/2 md:h-px md:w-2', active > k ? 'bg-brand' : 'bg-line/20')} aria-hidden />}
            </li>
          );
        })}
      </ol>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_260px]">
        <div className="min-h-[190px] rounded-lg border border-line/10 bg-bg/50 p-4">
          {!cs ? (
            <p className="py-8 text-center text-sm text-muted">Press <b className="text-fg">Run Attack Simulation</b> to watch a poisoned document travel through three agents.</p>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div className="flex flex-wrap items-center gap-2"><Badge tone="neon">{i + 1}/{PICK.length}</Badge><span className="font-mono text-[11px] uppercase tracking-wider text-neon">{STAGE_TITLE[cs.spec.stage]}</span><span className="text-sm font-semibold">{cs.spec.title}</span></div>
                <p className="mt-2 text-[13px] leading-relaxed text-fg/90">{narrateStep(cs, final)}</p>
                {signals.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{Array.from(new Set(signals.map((s) => s.title))).map((t) => <Badge key={t} tone="danger">{t}</Badge>)}</div>}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
        <div className={cn('flex flex-col items-center justify-center rounded-lg border p-4 text-center', final ? 'border-danger/40 bg-danger/10 glow-danger' : 'border-line/10 bg-bg/50')}>
          <div className="label">risk score</div>
          <div className={cn('font-mono text-5xl font-semibold tabular-nums', TONE[scoreTone(score)].text)}>{score}</div>
          <div className="mt-1">{cs && score > 0 ? <ActionBadge action={cs.liveAction} /> : <Badge>awaiting evidence</Badge>}</div>
          {final && <p className="mt-3 font-mono text-[11px] font-semibold tracking-wider text-danger">OPERATION BLOCKED<br />export not executed</p>}
        </div>
      </div>
    </div>
  );
}
