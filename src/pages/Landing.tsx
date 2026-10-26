import { motion } from 'framer-motion';
import { Activity, ArrowRight, Brain, FileLock2, Gauge, Layers, Network, ShieldCheck, ShieldHalf, Radar, Check, X } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AttackDemo } from '../components/landing/AttackDemo';
import { GatewayVisual } from '../components/landing/GatewayVisual';
import { STAGES } from '../components/simulator/Pipeline';
import { Badge } from '../components/ui/Badges';
import { Button } from '../components/ui/Controls';
import { TONE, cn } from '../lib/utils';

const fade = { initial: { opacity: 0, y: 14 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-60px' }, transition: { duration: 0.4 } };

const Section = ({ id, eyebrow, title, children, className }: { id?: string; eyebrow?: string; title: string; children: React.ReactNode; className?: string }) => (
  <section id={id} className={cn('scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20', className)}>
    <div className="mx-auto max-w-6xl">
      <motion.div {...fade} className="mb-8 max-w-2xl">
        {eyebrow && <div className="label mb-2 text-neon">{eyebrow}</div>}
        <h2 className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{title}</h2>
      </motion.div>
      {children}
    </div>
  </section>
);

const PILLARS = [
  { k: 'ROLE', icon: ShieldCheck, tone: 'neon', text: 'Is the tool, resource and destination allowed by the agent’s role contract?' },
  { k: 'REASON', icon: Brain, tone: 'holo', text: 'What influenced the action — untrusted inputs, task origin, delegation chain?' },
  { k: 'ROUTINE', icon: Activity, tone: 'brand', text: 'Does it match the agent’s normal tools, resources, sequences and rate?' },
] as const;

const CAPS = [
  { icon: FileLock2, t: 'Role Contract Enforcement', d: 'Allowed tools, sensitivity ceilings and approved destinations, checked on every call.' },
  { icon: Network, t: 'Taint & Provenance Tracking', d: 'Untrusted documents are tagged; sensitive actions that follow them score higher.' },
  { icon: Activity, t: 'Behavioural Drift Detection', d: 'Per-agent baselines with a frozen golden profile catch slow, subtle drift.' },
  { icon: Gauge, t: 'Explainable Risk Scoring', d: 'A bounded 0–100 score with the evidence and reasoning behind it.' },
  { icon: Layers, t: 'Multi-Agent Delegation Tracing', d: 'Trace any action back to the root principal and the input that started it.' },
  { icon: ShieldHalf, t: 'Graduated Containment', d: 'Block the operation, not the agent — unless the evidence is strong.' },
];

const BANDS = [
  { r: '0–34', d: 'Allow', tone: 'ok' }, { r: '35–54', d: 'Watch', tone: 'neon' }, { r: '55–74', d: 'Step-up approval', tone: 'warn' },
  { r: '75–89', d: 'Block operation', tone: 'brand' }, { r: '90–100', d: 'Pause agent or quarantine sensitive scopes, per policy', tone: 'danger' },
] as const;

export default function Landing() {
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }, [hash]);

  return (
    <>
      {/* hero */}
      <section className="relative overflow-hidden px-4 pb-16 pt-14 sm:px-6 sm:pt-20">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
          <motion.div {...fade}>
            <div className="label mb-4 text-neon">AI Agent Runtime Security</div>
            <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">Your AI Agent Has Permission. <span className="text-brand">But Should It Act?</span></h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted">DriftShield detects identity drift in autonomous AI agents by evaluating every tool call against the agent’s declared role, its input context, and its normal behaviour.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/dashboard"><Button variant="primary" size="md">Explore Security Dashboard <ArrowRight size={15} /></Button></Link>
              <Link to="/#how"><Button size="md">See How It Works</Button></Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-2">{PILLARS.map((p) => <Badge key={p.k} tone={p.tone}>{p.k}</Badge>)}</div>
          </motion.div>
          <motion.div {...fade} transition={{ duration: 0.4, delay: 0.1 }}><GatewayVisual /></motion.div>
        </div>
      </section>

      {/* problem */}
      <Section id="product" eyebrow="The problem" title="Valid Credentials. Dangerous Behaviour." className="border-t border-line/[0.06] bg-bg2/30">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <ul className="space-y-4">
            {[
              ['Identity checks verify who the agent is', 'They do not judge whether its action is appropriate.'],
              ['Untrusted documents can steer agents', 'Hidden instructions push them toward unintended actions.'],
              ['Audit logs reveal misuse after the fact', 'By then the operation has already run.'],
            ].map(([t, d], i) => (
              <motion.li key={t} {...fade} transition={{ delay: i * 0.08, duration: 0.4 }} className="flex gap-4">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-brand/40 font-mono text-xs text-brand">{i + 1}</span>
                <div><h3 className="text-[15px] font-semibold">{t}</h3><p className="mt-0.5 text-sm text-muted">{d}</p></div>
              </motion.li>
            ))}
          </ul>
          <motion.div {...fade} className="grid gap-3 sm:grid-cols-2">
            <div className="glass p-4">
              <div className="label mb-3">Conventional identity check</div>
              {[['Token valid', true], ['Scope allows the tool', true]].map(([l, ok]) => <Row key={l as string} ok={ok as boolean} label={l as string} />)}
              <div className="mt-3 rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-center font-mono text-[11px] font-semibold text-warn">ALLOWED — found later in the audit log</div>
            </div>
            <div className="glass p-4 glow-danger">
              <div className="label mb-3 text-neon">DriftShield evaluation</div>
              {[['Token valid', true], ['Role contract', false], ['Input trusted', false], ['Matches routine', false]].map(([l, ok]) => <Row key={l as string} ok={ok as boolean} label={l as string} />)}
              <div className="mt-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-center font-mono text-[11px] font-semibold text-danger">BLOCKED — before it runs</div>
            </div>
          </motion.div>
        </div>
      </Section>

      {/* how it works */}
      <Section id="how" eyebrow="How it works" title="Every tool call, three questions.">
        <div className="grid gap-4 md:grid-cols-3">
          {PILLARS.map((p, i) => (
            <motion.div key={p.k} {...fade} transition={{ delay: i * 0.08, duration: 0.4 }} className="glass holo-edge p-5">
              <span className={cn('grid h-10 w-10 place-items-center rounded-lg border', TONE[p.tone].border, TONE[p.tone].bg, TONE[p.tone].text)}><p.icon size={19} /></span>
              <h3 className={cn('mt-4 font-mono text-sm font-semibold tracking-[0.2em]', TONE[p.tone].text)}>{p.k}</h3>
              <p className="mt-2 text-sm text-muted">{p.text}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* capabilities / architecture */}
      <Section id="architecture" eyebrow="Architecture" title="One gateway between agents and tools." className="border-t border-line/[0.06] bg-bg2/30">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAPS.map((c, i) => (
            <motion.div key={c.t} {...fade} transition={{ delay: (i % 3) * 0.06, duration: 0.4 }} className="glass p-5">
              <c.icon size={18} className="text-neon" aria-hidden />
              <h3 className="mt-3 text-[14.5px] font-semibold">{c.t}</h3>
              <p className="mt-1 text-[13px] text-muted">{c.d}</p>
            </motion.div>
          ))}
        </div>
        <ol className="mt-8 flex flex-wrap items-center gap-x-2 gap-y-2 text-xs" aria-label="Gateway pipeline">
          {STAGES.map((s, i) => (<li key={s.key} className="flex items-center gap-2"><span className="rounded-md border border-line/10 bg-bg/50 px-2.5 py-1 font-mono text-[11px] text-muted">{s.label}</span>{i < STAGES.length - 1 && <ArrowRight size={12} className="text-muted/50" />}</li>))}
        </ol>
      </Section>

      {/* demo */}
      <Section id="demo" eyebrow="Interactive demonstration" title="Watch a poisoned document get blocked.">
        <motion.div {...fade}><AttackDemo /></motion.div>
      </Section>

      {/* risk */}
      <Section id="security" eyebrow="Risk & enforcement" title="From score to action." className="border-t border-line/[0.06] bg-bg2/30">
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <motion.div {...fade} className="glass overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-line/[0.07] text-left"><th className="label px-4 py-2.5">Risk score</th><th className="label px-4 py-2.5">Decision</th></tr></thead>
              <tbody>{BANDS.map((b) => (<tr key={b.r} className="border-t border-line/[0.05]"><td className="px-4 py-2.5 font-mono text-[13px]"><span className={cn('mr-2 inline-block h-2 w-2 rounded-full', TONE[b.tone].dot)} />{b.r}</td><td className="px-4 py-2.5">{b.d}</td></tr>))}</tbody>
            </table>
          </motion.div>
          <motion.div {...fade} className="flex flex-col justify-center gap-4">
            <div className="rounded-xl border border-danger/30 bg-danger/[0.07] p-4"><div className="flex items-center gap-2 text-sm font-semibold text-danger"><Radar size={16} /> Hard role-contract violations</div><p className="mt-1.5 text-[13px] text-muted">A forbidden tool, an exceeded sensitivity ceiling or an unapproved destination can block an operation on its own, regardless of the score.</p></div>
            <p className="text-xs text-muted">Scores are illustrative demonstration values, not validated production defaults.</p>
          </motion.div>
        </div>
      </Section>

      {/* final CTA */}
      <section className="px-4 py-20 sm:px-6">
        <motion.div {...fade} className="glass holo-edge mx-auto max-w-3xl p-8 text-center sm:p-12">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Trust the Identity. <span className="text-brand">Verify the Behaviour.</span></h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted">See how DriftShield detects suspicious agent actions before the simulated operation proceeds.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/dashboard"><Button variant="primary" size="md">Open Dashboard</Button></Link>
            <Link to="/#demo"><Button size="md">Run Live Demo</Button></Link>
          </div>
        </motion.div>
      </section>
    </>
  );
}

function Row({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between border-b border-line/[0.06] py-1.5 text-[13px] last:border-0">
      <span>{label}</span>
      <span className={cn('flex items-center gap-1 font-mono text-[11px]', ok ? 'text-ok' : 'text-danger')}>{ok ? <Check size={13} /> : <X size={13} />}{ok ? 'pass' : 'fail'}</span>
    </div>
  );
}
