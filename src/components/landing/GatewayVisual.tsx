import { motion } from 'framer-motion';
import { Bot, Gauge, ShieldCheck, ShieldX, ShieldCheck as Ok } from 'lucide-react';
import { useEffect, useState } from 'react';
import { TONE, cn } from '../../lib/utils';
import { SimBadge } from '../ui/Badges';

const CALLS = [
  { call: 'catalog.search → product_catalog', score: 4, block: false },
  { call: 'hr.export → collector.hr-sync.example', score: 99, block: true },
];
const NODES = [
  { label: 'AI Agent', icon: Bot },
  { label: 'DriftShield Gateway', icon: ShieldCheck },
  { label: 'Risk Analysis', icon: Gauge },
];

/** Looping, purely decorative gateway illustration: one routine call is allowed, one suspicious call is blocked. */
export function GatewayVisual({ className }: { className?: string }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((x) => x + 1), 650);
    return () => clearInterval(id);
  }, []);
  const call = CALLS[Math.floor(t / 7) % CALLS.length];
  const step = t % 7; // 0 agent · 1 gateway · 2 risk · 3-6 decision
  const decided = step >= 3;
  const tone = call.block ? 'danger' : 'ok';

  return (
    <div className={cn('glass p-4 sm:p-5', className)} role="img" aria-label="Simulated gateway: one call allowed, one blocked">
      <div className="mb-4 flex items-center justify-between"><span className="label">live gateway · looping demo</span><SimBadge /></div>
      <div className="flex items-center gap-1.5 sm:gap-2">
        {NODES.map((n, i) => (
          <div key={n.label} className="flex flex-1 items-center gap-1.5 sm:gap-2">
            <motion.div
              animate={{ borderColor: step === i ? 'rgb(var(--neon) / 0.8)' : 'rgb(var(--line) / 0.12)' }}
              className={cn('flex flex-1 flex-col items-center gap-1.5 rounded-lg border bg-bg/50 px-1 py-3 text-center', step === i && 'glow-neon')}
            >
              <n.icon size={18} className={step === i ? 'text-neon' : 'text-muted'} aria-hidden />
              <span className="text-[10.5px] font-medium leading-tight sm:text-[11.5px]">{n.label}</span>
            </motion.div>
            <span className={cn('h-px w-3 shrink-0 sm:w-5', step > i ? 'bg-neon' : 'bg-line/20')} />
          </div>
        ))}
        <motion.div
          animate={{ scale: decided ? 1 : 0.96 }}
          className={cn('flex w-[22%] min-w-[74px] flex-col items-center gap-1.5 rounded-lg border px-1 py-3 text-center', decided ? cn(TONE[tone].border, TONE[tone].bg, call.block ? 'glow-danger' : 'glow-ok') : 'border-line/10 bg-bg/50')}
        >
          {decided ? (call.block ? <ShieldX size={18} className="text-danger" /> : <Ok size={18} className="text-ok" />) : <ShieldCheck size={18} className="text-muted" />}
          <span className={cn('font-mono text-[10.5px] font-semibold tracking-wider', decided ? TONE[tone].text : 'text-muted')}>{decided ? (call.block ? 'BLOCK' : 'ALLOW') : 'ALLOW / BLOCK'}</span>
        </motion.div>
      </div>
      <div className={cn('mt-4 rounded-lg border px-3 py-2.5 font-mono text-[11.5px] transition-colors', decided ? cn(TONE[tone].border, TONE[tone].bg) : 'border-line/10 bg-bg/50')}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="truncate text-muted">&gt; {call.call}</span>
          <span className={decided ? TONE[tone].text : 'text-muted'}>{decided ? `risk ${call.score}/100 · ${call.block ? 'BLOCKED' : 'ALLOWED'}` : 'evaluating…'}</span>
        </div>
        {decided && call.block && <p className="mt-1.5 font-sans text-[11px] text-muted">Role violation + untrusted input + unusual behaviour. Export not executed.</p>}
      </div>
    </div>
  );
}
