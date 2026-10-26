import { motion } from 'framer-motion';
import { Activity, Bell, Bot, Eye, Pause, Play, RotateCcw, ShieldAlert, ShieldBan, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { chartTip } from '../components/charts/common';
import { XaiPanel } from '../components/common/XaiPanel';
import { ActionBadge, Badge, ScorePill, SeverityBadge, SimBadge, StateBadge } from '../components/ui/Badges';
import { Button } from '../components/ui/Controls';
import { Card } from '../components/ui/Card';
import { CountUp, Empty } from '../components/ui/Misc';
import { AGENT_NAME } from '../data/agents';
import { ROLE_LABEL } from '../data/contracts';
import { useOpen } from '../hooks/useOpen';
import { kpis } from '../lib/derive';
import { nextStep, pauseRun, resetRun, resumeRun, startScenario } from '../lib/simRunner';
import { narrateStep, STAGE_TITLE } from '../lib/xai';
import { TONE, ago, cn, fmtTime, scoreTone, sevRank } from '../lib/utils';
import { useSim } from '../store/useSim';
import { useStore } from '../store/useStore';

function Kpi({ label, value, icon: Icon, tone, delay }: { label: string; value: number; icon: typeof Bot; tone: keyof typeof TONE; delay: number }) {
  const t = TONE[tone];
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: delay * 0.05 }} className="glass p-4">
      <div className="flex items-center justify-between"><span className="label">{label}</span><Icon size={14} className={t.text} aria-hidden /></div>
      <div className={cn('mt-2 font-mono text-[28px] font-semibold leading-none', t.text)}><CountUp value={value} /></div>
    </motion.div>
  );
}

export default function Dashboard() {
  const nav = useNavigate();
  const { openAgent, openAlert, openEvent } = useOpen();
  const agents = useStore((s) => s.agents);
  const events = useStore((s) => s.events);
  const alerts = useStore((s) => s.alerts);
  const sim = useSim();
  const [selId, setSelId] = useState<string | null>(null);
  const k = kpis(agents, events, alerts);
  const critical = alerts.filter((a) => a.severity === 'critical' && a.status !== 'closed').length;

  const recent = useMemo(() => [...events].sort((a, b) => b.ts - a.ts), [events]);
  const lastTs = recent[0]?.ts;
  const running = sim.status === 'running' || sim.status === 'awaiting' || sim.status === 'paused';
  const compiled = sim.compiled;
  const cs = compiled && sim.stepIndex >= 0 ? compiled.steps[sim.stepIndex] : undefined;

  // follow the demo: whenever the running scenario commits an event, explain it
  const runCount = sim.scenarioId ? events.filter((e) => e.run_key === sim.scenarioId).length : 0;
  useEffect(() => {
    if (!sim.scenarioId || !runCount) return;
    const last = recent.find((e) => e.run_key === sim.scenarioId);
    if (last) setSelId(last.event_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runCount, sim.scenarioId]);

  const defaultEvent = useMemo(() => recent.find((e) => e.decision.score >= 75) ?? recent[0], [recent]);
  const selected = recent.find((e) => e.event_id === selId) ?? defaultEvent;
  const liveEvent = running && cs?.focus ? cs.focus.event : undefined;
  const alertOf = selected ? alerts.find((a) => a.eventIds[a.eventIds.length - 1] === selected.event_id) : undefined;

  const dist = [
    { name: 'Allowed', value: Math.max(0, k.monitored - k.suspicious), color: 'rgb(var(--ok))' },
    { name: 'Watched / held', value: Math.max(0, k.suspicious - k.blocked), color: 'rgb(var(--warn))' },
    { name: 'Blocked', value: k.blocked, color: 'rgb(var(--danger))' },
  ];
  const topAgents = useMemo(() => [...agents].sort((a, b) => b.risk - a.risk).slice(0, 6), [agents]);
  const openAlerts = useMemo(() => alerts.filter((a) => a.status === 'open').sort((a, b) => sevRank(b.severity) - sevRank(a.severity) || b.score - a.score).slice(0, 4), [alerts]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <SimBadge />
          <Badge tone={running ? (sim.status === 'paused' ? 'warn' : 'ok') : sim.status === 'done' ? 'neon' : 'muted'} dot>{running ? (sim.status === 'paused' ? 'demo paused' : 'demo running') : sim.status === 'done' ? 'demo complete' : 'demo idle'}</Badge>
          <span className="font-mono text-[11px] text-muted">last event {lastTs ? `${fmtTime(lastTs)} · ${ago(lastTs)}` : '—'}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {!running ? <Button variant="primary" size="md" icon={Play} onClick={() => startScenario('E')}>{sim.status === 'done' ? 'Run again' : 'Start Demo'}</Button>
            : sim.status === 'paused' ? <Button variant="primary" size="md" icon={Play} onClick={resumeRun}>Resume</Button>
            : <Button size="md" icon={Pause} onClick={pauseRun} disabled={sim.status === 'awaiting'}>Pause Demo</Button>}
          {running && sim.status === 'awaiting' && <Button size="md" onClick={nextStep}>Next step</Button>}
          <Button size="md" icon={RotateCcw} onClick={resetRun} disabled={sim.status === 'idle'}>Reset Demo</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi delay={0} label="Active agents" value={k.activeAgents} icon={Users} tone="ok" />
        <Kpi delay={1} label="Monitored calls" value={k.monitored} icon={Eye} tone="neon" />
        <Kpi delay={2} label="Suspicious" value={k.suspicious} icon={Activity} tone="warn" />
        <Kpi delay={3} label="Blocked ops" value={k.blocked} icon={ShieldBan} tone="danger" />
        <Kpi delay={4} label="Critical alerts" value={critical} icon={Bell} tone="brand" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.62fr)]">
        <div className="min-w-0 space-y-4">
          {/* live narration */}
          {running && cs && (
            <motion.div key={sim.stepIndex} initial={{ opacity: 0.5, y: 4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-neon/30 bg-neon/[0.06] px-4 py-3">
              <div className="flex flex-wrap items-center gap-2"><Badge tone="neon">live · step {sim.stepIndex + 1}/{compiled!.steps.length}</Badge><span className="font-mono text-[11px] uppercase tracking-wider text-neon">{STAGE_TITLE[cs.spec.stage]}</span><span className="text-[13px] font-semibold">{cs.spec.title}</span></div>
              <p className="mt-1.5 text-[13px] leading-relaxed">{narrateStep(cs, sim.decided)}</p>
            </motion.div>
          )}

          <Card title="Recent security events" icon={ShieldAlert} bodyClassName="!p-0" right={<Button size="xs" variant="ghost" onClick={() => nav('/dashboard/timeline')}>Timeline</Button>}>
            {recent.length === 0 ? <Empty title="No events yet" /> : (
              <div className="overflow-x-auto">
                <table className="tbl w-full min-w-[560px] text-[13px]">
                  <thead><tr><th>Time</th><th>Agent</th><th>Action</th><th>Risk</th><th>Decision</th></tr></thead>
                  <tbody>
                    {recent.slice(0, 8).map((e) => (
                      <tr key={e.event_id} onClick={() => setSelId(e.event_id)} onDoubleClick={() => openEvent(e.event_id)} className={cn('row cursor-pointer', selected?.event_id === e.event_id && 'bg-neon/[0.07]')} tabIndex={0} onKeyDown={(ev) => ev.key === 'Enter' && setSelId(e.event_id)} aria-selected={selected?.event_id === e.event_id}>
                        <td className="whitespace-nowrap font-mono text-[11px] text-muted">{fmtTime(e.ts)}</td>
                        <td className="whitespace-nowrap">{AGENT_NAME[e.agent_id]}</td>
                        <td className="max-w-[260px] truncate"><span className="font-mono text-xs text-neon">{e.tool}</span> <span className="text-xs text-muted">{e.resource}</span></td>
                        <td><ScorePill score={e.decision.score} /></td><td><ActionBadge action={e.decision.action} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
            <Card title="Agent risk overview" icon={Bot} bodyClassName="!p-0" right={<Button size="xs" variant="ghost" onClick={() => nav('/dashboard/fleet')}>Fleet</Button>}>
              <ul className="divide-y divide-line/[0.06]">
                {topAgents.map((a) => (
                  <li key={a.id}>
                    <button onClick={() => openAgent(a.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-neon/[0.06]">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2"><span className="truncate text-[13px] font-medium">{a.name}</span><StateBadge s={a.state} /></div>
                        <div className="truncate text-[11px] text-muted">{ROLE_LABEL[a.role]} · {a.lastSuspicious ?? 'no suspicious activity'}</div>
                      </div>
                      <div className="flex w-24 shrink-0 items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fg/10"><motion.div className={cn('h-full rounded-full', TONE[scoreTone(a.risk)].dot)} animate={{ width: `${a.risk}%` }} /></div><span className="w-7 text-right font-mono text-xs">{a.risk}</span></div>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>

            <div className="space-y-4">
              <Card title="Risk distribution" icon={Activity}>
                <div className="flex items-center gap-4">
                  <div className="h-[130px] w-[130px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart><Pie data={dist} dataKey="value" innerRadius={40} outerRadius={60} paddingAngle={2} stroke="none">{dist.map((d) => <Cell key={d.name} fill={d.color} />)}</Pie><Tooltip {...chartTip} /></PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="min-w-0 flex-1 space-y-1.5 text-xs">{dist.map((d) => <li key={d.name} className="flex items-center justify-between gap-2"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: d.color }} />{d.name}</span><span className="font-mono tabular-nums">{d.value.toLocaleString()}</span></li>)}</ul>
                </div>
              </Card>
              <Card title="Open alerts" icon={Bell} bodyClassName="!p-0" right={<Button size="xs" variant="ghost" onClick={() => nav('/dashboard/alerts')}>All</Button>}>
                {openAlerts.length === 0 ? <Empty title="No open alerts" /> : (
                  <ul className="divide-y divide-line/[0.06]">{openAlerts.map((a) => (
                    <li key={a.id}><button onClick={() => openAlert(a.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-neon/[0.06]"><span className="min-w-0 flex-1 truncate text-[12.5px]">{a.title}</span><SeverityBadge severity={a.severity} /></button></li>
                  ))}</ul>
                )}
              </Card>
            </div>
          </div>
        </div>

        <aside className="min-w-0 xl:sticky xl:top-24 xl:self-start" aria-label="Explainable AI">
          {selected ? (
            <>
              {liveEvent && liveEvent.event_id !== selected.event_id && <p className="mb-2 text-[11px] text-muted">Showing the selected event. The live step above follows the running demo.</p>}
              <XaiPanel event={selected} alert={alertOf} />
            </>
          ) : <Card><Empty title="Select an event" hint="Choose an event to see why DriftShield decided what it did." /></Card>}
        </aside>
      </div>
    </div>
  );
}
