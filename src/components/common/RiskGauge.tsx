import { motion } from 'framer-motion';
import { scoreTone, TONE } from '../../lib/utils';
import { useStore } from '../../store/useStore';

const R = 74;
const CX = 100;
const CY = 100;
const START = 135; // degrees
const SWEEP = 270;
const pt = (deg: number, r = R) => [CX + r * Math.cos((deg * Math.PI) / 180), CY + r * Math.sin((deg * Math.PI) / 180)];
const arc = (from: number, to: number, r = R) => {
  const [x1, y1] = pt(from, r);
  const [x2, y2] = pt(to, r);
  return `M ${x1} ${y1} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`;
};

export function RiskGauge({ score, size = 190, caption }: { score: number; size?: number; caption?: string }) {
  const reduced = useStore((s) => s.prefs.animations === 'reduced');
  const t = useStore((s) => s.prefs.thresholds);
  const tone = TONE[scoreTone(score)];
  const color = `rgb(var(--${scoreTone(score) === 'brand' ? 'brand' : scoreTone(score)}))`;
  const ticks = [t.allow, t.watch, t.stepUp, t.block];
  return (
    <div className="relative mx-auto" style={{ width: size, height: size * 0.92 }}>
      <svg viewBox="0 0 200 184" className="h-full w-full" role="img" aria-label={`Risk score ${score} out of 100`}>
        <path d={arc(START, START + SWEEP)} fill="none" stroke="rgb(var(--line) / 0.1)" strokeWidth="10" strokeLinecap="round" />
        <motion.path
          d={arc(START, START + SWEEP)} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
          initial={{ pathLength: reduced ? score / 100 : 0 }} animate={{ pathLength: score / 100 }} transition={{ duration: reduced ? 0 : 1, ease: 'easeOut' }}
        />
        {ticks.map((v) => {
          const a = START + (SWEEP * v) / 100;
          const [x1, y1] = pt(a, R - 9);
          const [x2, y2] = pt(a, R + 9);
          return <line key={v} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgb(var(--fg) / 0.35)" strokeWidth="1.2" />;
        })}
        <circle cx={CX} cy={CY} r={50} fill="none" stroke="rgb(var(--line) / 0.06)" strokeDasharray="2 4" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pb-3">
        <motion.span key={score} initial={{ scale: 0.85, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }} className={`font-mono text-4xl font-semibold tabular-nums ${tone.text}`}>
          {score}
        </motion.span>
        <span className="label mt-0.5">{caption ?? 'risk / 100'}</span>
      </div>
    </div>
  );
}
