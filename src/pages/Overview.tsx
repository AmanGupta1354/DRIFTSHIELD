import { AnimatePresence, motion } from 'framer-motion';
import { Activity, ArrowRight, Bell, Bot, Eye, Gauge, Play, Radar, ShieldAlert, ShieldBan, Siren, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { chartTip } from '../components/charts/common';
import { RiskGauge } from '../components/common/RiskGauge';
import { ActionBadge, Badge, ScorePill, StateBadge } from '../components/ui/Badges';
import { Button, Segmented } from '../components/ui/Controls';
import { Card } from '../components/ui/Card';
import { CountUp, Empty } from '../components/ui/Misc';
import { AGENT_NAME } from '../data/agents';
import { ROLE_LABEL } from '../data/contracts';
import { useOpen } from '../hooks/useOpen';
import { activitySeries, fleetRisk, kpis, threatDistribution, type Range } from '../lib/derive';
import { startScenario } from '../lib/simRunner';
import { categoryLabel } from '../lib/simulationEngine';
import { TONE, ago, cn, fmtTime, scoreTone, severityTone } from '../lib/utils';
import { severityFor } from '../lib/riskScoring';
import { useStore } from '../store/useStore';
import type { ThreatCategory } from '../types';

const CAT_COLOR: Record<ThreatCategory, string> = {
  role_violation: 'rgb(var(--danger))', taint: 'rgb(var(--brand))', behavioural_drift: 'rgb(var(--warn))',
  unapproved_destination: 'rgb(var(--holo))', unusual_sequence: 'rgb(var(--neon))', delegation_anomaly: 'rgb(var(--ok))',
};

function Kpi({ label, value, icon: Icon, tone, sub, delay }: { label: string; value: number; icon: typeof Bot; tone: keyof typeof TONE; sub?: string; delay: number }) {
  const t = TONE[tone];
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: delay * 0.06 }} className="glass holo-edge relative overflow-hidden p-4">
      <div className="flex items-center justify-between">
        <span className="label">{label}</span>
        <span className={cn('grid h-7 w-7 place-items-center rounded-lg border', t.border, t.bg, t.text)}><Icon size={14} /></span>
      </div>
      <div className={cn('mt-2 font-mono text-[28px] font-semibold leading-none', t.text)}><CountUp value={value} /></div>
      <div className="mt-1.5 truncate text-[11px] text-muted">{sub ?? ' '}</div>
      <div className={cn('absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent to-transparent', tone === 'danger' ? 'via-danger/60' : 'via-neon/40')} />
    </motion.div>
  );
}

export default function Overview() {
  const nav = useNavigate();
  const { openEvent, openAgent } = useOpen();
  const agents = useStore((s) => s.agents);
  const events = useStore((s) => s.events);
  const alerts = useStore((s) => s.alerts);
  const [range, setRange] = useState<Range>('1h');
  const k = kpis(agents, events, alerts);
  const risk = fleetRisk(agents);
  const sev = severityFor(risk);
  const highRisk = agents.filter((a) => a.risk >= 55).length;
  const series = useMemo(() => activitySeries(events, range), [events, range]);
  const threats = threatDistribution(alerts);
  const recent = useMemo(() => [...events].sort((a, b) => b.ts - a.ts).slice(0, 8), [events]);
  const suspicious = useMemo(() => [...events].filter((e) => e.decision.score >= 35).sort((a, b) => b.ts - a.ts), [events]);
  const top = useMemo(() => [...agents].sort((a, b) => b.risk - a.risk).slice(0, 5), [agents]);

  return (
    <div className="space-y-4">
      {/* hero */}
      <div className="glass holo-edge scan relative overflow-hidden p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-neon/15 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div className="max-w-2xl">
            <div className="label text-neon/80">// identity drift detection · simulated gateway</div>
            <h2 className="mt-1.5 text-2xl font-semibold leading-tight sm:text-[28px]">IAM asks <span className="text-muted">“is this token valid?”</span><br />DriftShield asks <span className="holo-text">“is this action right for this agent, right now?”</span></h2>
            <p className="mt-2 text-[13px] text-muted">Every tool call is checked against <b className="text-fg">Role</b>, <b className="text-fg">Reason</b> and <b className="text-fg">Routine</b> before it reaches a tool.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" size="md" icon={Play} onClick={() => { nav('/simulator'); setTimeout(() => startScenario('A'), 150); }}>Run poisoned-document demo</Button>
            <Button size="md" icon={Radar} onClick={() => nav('/monitor')}>Open live monitor</Button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi delay={0} label="Total agents" value={k.totalAgents} icon={Users} tone="neon" sub="registered in the role registry" />
        <Kpi delay={1} label="Active agents" value={k.activeAgents} icon={Bot} tone="ok" sub="active or on watch" />
        <Kpi delay={2} label="Monitored calls" value={k.monitored} icon={Eye} tone="neon" sub="illustrative mock total" />
        <Kpi delay={3} label="Suspicious" value={k.suspicious} icon={Activity} tone="warn" sub="score ≥ 35" />
        <Kpi delay={4} label="Blocked ops" value={k.blocked} icon={ShieldBan} tone="danger" sub="operations withheld" />
        <Kpi delay={5} label="Open alerts" value={k.openAlerts} icon={Bell} tone="brand" sub="awaiting triage" />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-4" title="Risk overview" code="FLEET_RISK" icon={Gauge} glow={risk >= 55 ? 'danger' : undefined}>
          <RiskGauge score={risk} caption="fleet risk" />
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2"><Badge tone={severityTone(sev)} dot>{sev} risk</Badge><Badge tone={highRisk ? 'danger' : 'ok'}>{highRisk} high-risk agent{highRisk === 1 ? '' : 's'}</Badge></div>
          <div className="mt-4 space-y-1.5">
            <div className="label">recent risk-score changes</div>
            {suspicious.length === 0 ? <p className="text-xs text-muted">No risk changes yet.</p> : suspicious.slice(0, 3).map((e) => (
              <button key={e.event_id} onClick={() => openEvent(e.event_id)} className="flex w-full items-center justify-between gap-2 rounded-lg border border-line/[0.07] bg-bg/40 px-2.5 py-1.5 text-left text-xs hover:border-neon/30">
                <span className="truncate">{AGENT_NAME[e.agent_id]}</span><ScorePill score={e.decision.score} />
              </button>
            ))}
          </div>
          {suspicious[0] && (
            <div className="mt-3 rounded-lg border border-danger/25 bg-danger/5 p-2.5 text-xs">
              <div className="label text-danger">last suspicious event · {ago(suspicious[0].ts)}</div>
              <div className="mt-1 line-clamp-2">{suspicious[0].tool} on {suspicious[0].resource}</div>
            </div>
          )}
        </Card>

        <Card className="lg:col-span-8" title="Tool-call activity" code="ACTIVITY" icon={Activity}
          right={<Segmented size="xs" value={range} onChange={setRange} options={[{ value: '15m', label: '15m' }, { value: '1h', label: '1h' }, { value: '24h', label: '24h' }]} />}>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ left: -18, right: 8, top: 8 }}>
                <defs>
                  {(['ok', 'warn', 'danger'] as const).map((c) => (
                    <linearGradient key={c} id={`g-${c}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" style={{ stopColor: `rgb(var(--${c}))`, stopOpacity: 0.45 }} /><stop offset="100%" style={{ stopColor: `rgb(var(--${c}))`, stopOpacity: 0.02 }} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid stroke="rgb(var(--line) / 0.07)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: 'rgb(var(--muted))', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
                <YAxis tick={{ fill: 'rgb(var(--muted))', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip {...chartTip} />
                <Area type="monotone" dataKey="allowed" name="Allowed" stackId="1" stroke="rgb(var(--ok))" fill="url(#g-ok)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="watched" name="Watched" stackId="1" stroke="rgb(var(--warn))" fill="url(#g-warn)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="blocked" name="Blocked" stackId="1" stroke="rgb(var(--danger))" fill="url(#g-danger)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-muted">
            {[['ok', 'Allowed'], ['warn', 'Watched'], ['danger', 'Blocked']].map(([c, l]) => <span key={c} className="flex items-center gap-1.5"><span className={cn('h-2 w-2 rounded-full', TONE[c as 'ok'].dot)} />{l}</span>)}
            <span className="ml-auto font-mono">history is mock data; scenario events are added live</span>
          </div>
        </Card>

        <Card className="lg:col-span-5" title="Threat distribution" code="THREATS" icon={ShieldAlert}>
          <div className="h-[270px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={threats.map((t) => ({ ...t, name: categoryLabel(t.category) }))} layout="vertical" margin={{ left: 6, right: 16 }}>
                <CartesianGrid stroke="rgb(var(--line) / 0.07)" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fill: 'rgb(var(--muted))', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fill: 'rgb(var(--fg))', fontSize: 11.5 }} axisLine={false} tickLine={false} />
                <Tooltip {...chartTip} cursor={{ fill: 'rgb(var(--line) / 0.05)' }} />
                <Bar dataKey="count" name="Alerts" radius={[0, 6, 6, 0]} barSize={16}>
                  {threats.map((t) => <Cell key={t.category} fill={CAT_COLOR[t.category]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="lg:col-span-7" title="Recent security events" code="LIVE_FEED" icon={Siren} right={<Button size="xs" variant="ghost" onClick={() => nav('/timeline')}>All events <ArrowRight size={12} /></Button>} bodyClassName="!p-0">
          {recent.length === 0 ? <Empty title="No events yet" /> : (
            <ul className="divide-y divide-line/[0.06]">
              <AnimatePresence initial={false}>
                {recent.map((e) => (
                  <motion.li key={e.event_id} layout initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                    <button onClick={() => openEvent(e.event_id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-neon/[0.06]">
                      <span className="hidden w-16 shrink-0 font-mono text-[11px] text-muted sm:block">{fmtTime(e.ts)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px]"><span className="font-medium">{AGENT_NAME[e.agent_id]}</span> <span className="text-muted">→</span> <span className="font-mono text-xs text-neon">{e.tool}</span> <span className="text-muted">·</span> <span className="font-mono text-xs">{e.resource}</span></span>
                        <span className="block truncate text-[11px] text-muted">{e.explanation}</span>
                      </span>
                      <ScorePill score={e.decision.score} />
                      <span className="hidden md:block"><ActionBadge action={e.decision.action} /></span>
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-12" title="High-risk agents" code="TOP_RISK" icon={Bot} right={<Button size="xs" variant="ghost" onClick={() => nav('/fleet')}>Agent fleet <ArrowRight size={12} /></Button>} bodyClassName="!p-0">
          <div className="overflow-x-auto">
            <table className="tbl w-full min-w-[760px] text-[13px]">
              <thead><tr><th>Agent</th><th>Declared role</th><th>Risk</th><th>State</th><th>Last suspicious activity</th><th /></tr></thead>
              <tbody>
                {top.map((a) => (
                  <tr key={a.id} className="row cursor-pointer" onClick={() => openAgent(a.id)}>
                    <td><div className="font-medium">{a.name}</div><div className="font-mono text-[11px] text-muted">{a.id}</div></td>
                    <td>{ROLE_LABEL[a.role]}</td>
                    <td><div className="flex items-center gap-2"><div className="h-1.5 w-24 overflow-hidden rounded-full bg-fg/10"><motion.div className={cn('h-full rounded-full', TONE[scoreTone(a.risk)].dot)} initial={{ width: 0 }} animate={{ width: `${a.risk}%` }} /></div><ScorePill score={a.risk} /></div></td>
                    <td><StateBadge s={a.state} /></td>
                    <td className="max-w-[320px] truncate text-xs text-muted">{a.lastSuspicious ?? '—'}</td>
                    <td className="text-right"><Button size="xs" variant="neon" onClick={(e) => { e.stopPropagation(); openAgent(a.id); }}>View details</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
