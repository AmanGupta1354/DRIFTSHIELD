import { ArrowRight, CheckCheck, FileSearch, Network, RotateCcw, ShieldAlert, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AGENT_NAME } from '../../data/agents';
import { ROLE_LABEL } from '../../data/contracts';
import { useOpen } from '../../hooks/useOpen';
import { eventJson } from '../../lib/eventJson';
import { categoryLabel } from '../../lib/simulationEngine';
import { ago, fmtDateTime, titleCase } from '../../lib/utils';
import { useStore, type AgentAction } from '../../store/useStore';
import { useUi } from '../../store/useUi';
import { ActionBadge, Badge, ScorePill, SensBadge, SeverityBadge, SimBadge, StateBadge, StatusBadge, TrustBadge } from '../ui/Badges';
import { Button } from '../ui/Controls';
import { ConfirmDialog, Drawer } from '../ui/Overlays';
import { CopyButton, Empty, JsonView, Meta } from '../ui/Misc';
import { SignalList, TriadPanel } from './Triad';
import { scoreTone, TONE } from '../../lib/utils';

const H = ({ children }: { children: string }) => <h3 className="label mb-2 mt-5 !text-[10.5px] text-neon/80">{`// ${children}`}</h3>;

// ---------------------------------------------------------------- event

export function EventDrawer() {
  const { eventId, openEvent, openAgent, openAlert, close } = useOpen();
  const events = useStore((s) => s.events);
  const alerts = useStore((s) => s.alerts);
  const ev = events.find((e) => e.event_id === eventId);
  const chain = useMemo(() => {
    if (!ev) return { up: [], down: [] };
    const byId = new Map(events.map((e) => [e.event_id, e]));
    const up: typeof events = [];
    let cur = ev.parent_event_id;
    while (cur && byId.get(cur)) { up.unshift(byId.get(cur)!); cur = byId.get(cur)!.parent_event_id; }
    const down = events.filter((e) => e.parent_event_id === ev.event_id);
    return { up, down };
  }, [ev, events]);
  const alert = ev ? alerts.find((a) => a.eventIds.includes(ev.event_id)) : undefined;

  return (
    <Drawer open={!!eventId} onClose={close} title={ev ? `${ev.tool} → ${ev.resource}` : 'Event not found'} subtitle={ev ? `EVENT ${ev.event_id}` : 'EVENT'}>
      {!ev ? (
        <Empty title="Event not found" hint="It may belong to a simulation run that was reset." />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <ActionBadge action={ev.decision.action} />
            <ScorePill score={ev.decision.score} />
            <SeverityBadge severity={ev.decision.severity} />
            <SimBadge />
            <span className="ml-auto font-mono text-[11px] text-muted">{fmtDateTime(ev.ts)}</span>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed">{ev.action}</p>
          <p className="mt-2 text-xs text-muted">{ev.explanation}</p>

          <H>ROLE · REASON · ROUTINE</H>
          <TriadPanel triad={ev.triad} action={ev.decision.action} compact />

          <H>EVIDENCE</H>
          <SignalList signals={ev.signals} empty="No detector triggered — routine, in-role, trusted input." />

          <H>EVENT</H>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Meta k="agent"><button className="text-neon hover:underline" onClick={() => openAgent(ev.agent_id)}>{AGENT_NAME[ev.agent_id] ?? ev.agent_id}</button></Meta>
            <Meta k="role">{ROLE_LABEL[ev.role]}</Meta>
            <Meta k="session" mono>{ev.session_id}</Meta>
            <Meta k="sensitivity"><SensBadge s={ev.resource_sensitivity} /></Meta>
            <Meta k="parent event" mono>{ev.parent_event_id ? <button className="text-neon hover:underline" onClick={() => openEvent(ev.parent_event_id!)}>{ev.parent_event_id}</button> : '— (root)'}</Meta>
            <Meta k="root principal">{ev.root_principal}</Meta>
            {ev.destination && <Meta k="destination" mono>{ev.destination}</Meta>}
            {ev.delegate_to && <Meta k="delegates to" mono>{ev.delegate_to}</Meta>}
          </div>

          <H>INPUT PROVENANCE</H>
          {ev.input_taint.length ? (
            <ul className="space-y-1.5">
              {ev.input_taint.map((t, i) => (
                <li key={i} className="flex items-center justify-between gap-2 rounded-lg border border-line/[0.08] bg-bg/40 px-3 py-2 text-xs">
                  <span className="break-all font-mono">{t.source}</span>
                  <span className="flex shrink-0 items-center gap-2"><span className="text-muted">hop {t.hops ?? 0}</span><TrustBadge trust={t.trust} /></span>
                </li>
              ))}
            </ul>
          ) : <p className="text-xs text-muted">No tainted input in the ancestry of this call.</p>}
          {ev.delegation_chain.length > 1 && (
            <p className="mt-2 font-mono text-[11px] text-muted">chain: {ev.delegation_chain.join(' → ')}</p>
          )}

          <H>CAUSAL CHAIN</H>
          {chain.up.length + chain.down.length === 0 ? <p className="text-xs text-muted">This event has no parent or child events.</p> : (
            <ol className="space-y-1.5">
              {[...chain.up, ev, ...chain.down].map((e) => (
                <li key={e.event_id}>
                  <button
                    onClick={() => openEvent(e.event_id)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-1.5 text-left text-xs transition-colors ${e.event_id === ev.event_id ? 'border-neon/40 bg-neon/10' : 'border-line/[0.08] bg-bg/40 hover:border-neon/30'}`}
                  >
                    <span className="min-w-0 truncate"><span className="font-mono text-muted">{e.event_id}</span> · {e.tool}</span>
                    <ScorePill score={e.decision.score} />
                  </button>
                </li>
              ))}
            </ol>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            {alert && <Button size="sm" variant="neon" icon={ShieldAlert} onClick={() => openAlert(alert.id)}>Open alert {alert.id}</Button>}
            <Link to="/graph"><Button size="sm" icon={Network}>Delegation graph</Button></Link>
          </div>

          <H>EVENT JSON</H>
          <div className="mb-2 flex justify-end"><CopyButton text={JSON.stringify(eventJson(ev), null, 2)} /></div>
          <JsonView data={eventJson(ev)} className="max-h-96" />
        </>
      )}
    </Drawer>
  );
}

// ---------------------------------------------------------------- alert

export function AlertDrawer() {
  const { alertId, openEvent, openAgent, close } = useOpen();
  const alert = useStore((s) => s.alerts.find((a) => a.id === alertId));
  const setStatus = useStore((s) => s.setAlertStatus);
  const push = useUi((s) => s.push);
  const events = useStore((s) => s.events);
  const related = alert ? alert.eventIds.map((id) => events.find((e) => e.event_id === id)).filter(Boolean) : [];

  const act = (status: 'open' | 'acknowledged' | 'closed', msg: string) => {
    if (!alert) return;
    setStatus(alert.id, status);
    push({ title: msg, body: alert.id, tone: 'ok' });
  };

  return (
    <Drawer
      open={!!alertId} onClose={close} title={alert?.title ?? 'Alert not found'} subtitle={alert ? `ALERT ${alert.id}` : 'ALERT'}
      footer={alert && (
        <div className="flex flex-wrap items-center gap-2">
          {alert.status === 'open' && <Button variant="neon" icon={CheckCheck} onClick={() => act('acknowledged', 'Alert acknowledged')}>Acknowledge</Button>}
          {alert.status !== 'closed' && <Button icon={X} onClick={() => act('closed', 'Alert closed')}>Close</Button>}
          {alert.status === 'closed' && <Button variant="neon" icon={RotateCcw} onClick={() => act('open', 'Alert reopened')}>Reopen</Button>}
          {alert.status === 'acknowledged' && <Button variant="ghost" icon={RotateCcw} onClick={() => act('open', 'Alert reopened')}>Reopen</Button>}
          <span className="ml-auto text-[11px] text-muted">Status changes are local to this browser.</span>
        </div>
      )}
    >
      {!alert ? <Empty title="Alert not found" /> : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={alert.severity} /><StatusBadge s={alert.status} /><Badge tone="holo">{categoryLabel(alert.category)}</Badge><SimBadge />
          </div>

          <div className="mt-4 flex items-center gap-4 rounded-xl border border-line/10 bg-bg/40 p-4">
            <div className={`font-mono text-4xl font-semibold ${TONE[scoreTone(alert.score)].text}`}>{alert.score}</div>
            <div className="min-w-0 text-xs text-muted">
              <div className="label">risk score / 100 (illustrative)</div>
              <div className="mt-1 text-[13px] text-fg">{alert.summary}</div>
            </div>
          </div>

          <H>DETECTED · RECOMMENDED · ENFORCED</H>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-neon/25 bg-neon/5 p-3"><div className="label text-neon">detected</div><ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs">{alert.detected.map((d) => <li key={d}>{d}</li>)}</ul></div>
            <div className="rounded-lg border border-warn/25 bg-warn/5 p-3"><div className="label text-warn">recommended</div><p className="mt-1 text-xs">{alert.recommended}</p></div>
            <div className={`rounded-lg border p-3 ${alert.actuallyBlocked ? 'border-danger/40 bg-danger/10' : 'border-line/15 bg-fg/[0.03]'}`}>
              <div className={`label ${alert.actuallyBlocked ? 'text-danger' : ''}`}>enforced</div><p className="mt-1 text-xs">{alert.enforced}</p>
            </div>
          </div>
          <p className={`mt-2 rounded-lg border px-3 py-2 text-xs ${alert.actuallyBlocked ? 'border-danger/30 bg-danger/10 text-danger' : 'border-line/15 text-muted'}`}>
            {alert.actuallyBlocked ? 'The simulated gateway did withhold this operation.' : 'The operation was NOT withheld by the simulated gateway — the response above is a recommendation only.'}
          </p>

          <H>ROLE · REASON · ROUTINE</H>
          <TriadPanel triad={alert.triad} action={alert.actuallyBlocked ? 'block' : undefined} compact />

          <H>ROLE CONTRACT / POLICY VIOLATIONS</H>
          {alert.violatedPolicies.length ? (
            <ul className="space-y-1.5">{alert.violatedPolicies.map((p) => (
              <li key={p.id} className="flex items-start gap-2 text-xs"><Badge tone="danger">{p.id}</Badge><span>{p.text}</span></li>
            ))}</ul>
          ) : <p className="text-xs text-muted">No policy identifier attached.</p>}

          <H>TAINT INFORMATION</H>
          <p className="text-xs text-muted">{alert.taintInfo}</p>

          <H>BEHAVIOURAL DEVIATIONS</H>
          {alert.behaviouralDeviations.length ? <ul className="list-disc space-y-1 pl-5 text-xs text-muted">{alert.behaviouralDeviations.map((d, i) => <li key={i}>{d}</li>)}</ul> : <p className="text-xs text-muted">No behavioural deviation recorded.</p>}

          <H>RELATED EVENTS</H>
          <ol className="space-y-1.5">
            {related.map((e) => e && (
              <li key={e.event_id}>
                <button onClick={() => openEvent(e.event_id)} className="flex w-full items-center justify-between gap-2 rounded-lg border border-line/[0.08] bg-bg/40 px-3 py-1.5 text-left text-xs hover:border-neon/30">
                  <span className="min-w-0 truncate"><span className="font-mono text-muted">{e.event_id}</span> · {e.tool} · {e.resource}</span>
                  <ArrowRight size={13} className="shrink-0 text-muted" />
                </button>
              </li>
            ))}
          </ol>

          <H>RECOMMENDED RESPONSE</H>
          <ol className="list-decimal space-y-1 pl-5 text-xs">{alert.recommendedResponse.map((r) => <li key={r}>{r}</li>)}</ol>

          <H>REFERENCES</H>
          <div className="grid grid-cols-2 gap-3">
            <Meta k="agent"><button className="text-neon hover:underline" onClick={() => openAgent(alert.agentId)}>{AGENT_NAME[alert.agentId] ?? alert.agentId}</button></Meta>
            <Meta k="raised">{fmtDateTime(alert.ts)} ({ago(alert.ts)})</Meta>
            <Meta k="MITRE ATLAS">{alert.mitre}</Meta>
            <Meta k="OWASP">{alert.owasp}</Meta>
          </div>
          <div className="mt-4 flex gap-2"><Link to="/audit"><Button icon={FileSearch} size="sm">Audit trail</Button></Link></div>
        </>
      )}
    </Drawer>
  );
}

// ---------------------------------------------------------------- agent

const ACTIONS: Record<string, { action: AgentAction; label: string; variant: 'neon' | 'danger' | 'ok' | 'subtle'; text: string }[]> = {
  active: [{ action: 'pause', label: 'Pause', variant: 'subtle', text: 'The agent stops receiving work until activated again.' }, { action: 'quarantine', label: 'Quarantine', variant: 'danger', text: 'Sensitive scopes are revoked; low-sensitivity read-only tools remain.' }, { action: 'isolate', label: 'Isolate', variant: 'danger', text: 'The gateway token is revoked; every call fails until restored.' }],
  watched: [{ action: 'activate', label: 'Activate', variant: 'ok', text: 'Return the agent to normal ACTIVE monitoring.' }, { action: 'pause', label: 'Pause', variant: 'subtle', text: 'The agent stops receiving work until activated again.' }, { action: 'quarantine', label: 'Quarantine', variant: 'danger', text: 'Sensitive scopes are revoked; low-sensitivity read-only tools remain.' }, { action: 'isolate', label: 'Isolate', variant: 'danger', text: 'The gateway token is revoked; every call fails until restored.' }],
  paused: [{ action: 'activate', label: 'Activate', variant: 'ok', text: 'Resume the agent.' }, { action: 'quarantine', label: 'Quarantine', variant: 'danger', text: 'Sensitive scopes are revoked.' }, { action: 'isolate', label: 'Isolate', variant: 'danger', text: 'The gateway token is revoked.' }],
  quarantined: [{ action: 'restore', label: 'Restore', variant: 'ok', text: 'The agent returns in WATCHED state for a cool-down period.' }, { action: 'isolate', label: 'Isolate', variant: 'danger', text: 'The gateway token is revoked.' }],
  isolated: [{ action: 'restore', label: 'Restore', variant: 'ok', text: 'The agent returns in WATCHED state for a cool-down period.' }],
};

export function AgentDrawer() {
  const { agentId, openEvent, openAlert, close } = useOpen();
  const agent = useStore((s) => s.agents.find((a) => a.id === agentId));
  const events = useStore((s) => s.events);
  const alerts = useStore((s) => s.alerts);
  const contracts = useStore((s) => s.contracts);
  const act = useStore((s) => s.agentAction);
  const push = useUi((s) => s.push);
  const [pending, setPending] = useState<{ action: AgentAction; text: string; label: string } | null>(null);

  const recent = useMemo(() => (agent ? events.filter((e) => e.agent_id === agent.id).sort((a, b) => b.ts - a.ts).slice(0, 6) : []), [agent, events]);
  const myAlerts = agent ? alerts.filter((a) => a.agentId === agent.id) : [];
  const contract = agent ? contracts.find((c) => c.role === agent.role) : undefined;
  const body = contract?.versions.find((v) => v.version === contract.activeVersion)?.body;

  return (
    <>
      <Drawer open={!!agentId} onClose={close} title={agent?.name ?? 'Agent not found'} subtitle={agent ? `AGENT ${agent.id}` : 'AGENT'}>
        {!agent || !body ? <Empty title="Agent not found" /> : (
          <>
            <div className="flex flex-wrap items-center gap-2"><StateBadge s={agent.state} /><Badge tone="holo">{ROLE_LABEL[agent.role]}</Badge><Badge tone="muted">trust tier {agent.trustTier}</Badge><SimBadge /></div>
            <div className="mt-4 flex items-center gap-4 rounded-xl border border-line/10 bg-bg/40 p-4">
              <div className={`font-mono text-4xl font-semibold ${TONE[scoreTone(agent.risk)].text}`}>{agent.risk}</div>
              <div className="text-xs text-muted"><div className="label">current risk score</div>{agent.lastSuspicious ?? 'No suspicious activity recorded.'}</div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {ACTIONS[agent.state].map((a) => (
                <Button key={a.action} variant={a.variant} onClick={() => setPending({ action: a.action, label: a.label, text: a.text })}>{a.label}</Button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-muted">Containment actions change simulated state only.</p>

            <H>IDENTITY</H>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Meta k="agent id" mono>{agent.id}</Meta><Meta k="owner">{agent.owner}</Meta><Meta k="declared role">{ROLE_LABEL[agent.role]}</Meta>
              <Meta k="last seen">{ago(agent.lastSeen)}</Meta><Meta k="contract" mono>{contract!.id} v{contract!.activeVersion}</Meta><Meta k="sensitivity ceiling"><SensBadge s={body.maxSensitivity} /></Meta>
            </div>

            <H>ROLE CONTRACT</H>
            <div className="flex flex-wrap gap-1.5">{body.allowedTools.map((t) => <Badge key={t} tone="neon">{t}</Badge>)}</div>
            <p className="mt-2 text-xs text-muted">Approved destinations: {body.approvedEgress.length ? body.approvedEgress.join(', ') : 'none'}</p>
            <Link to="/contracts" className="mt-2 inline-block text-xs text-neon hover:underline">Open role contracts →</Link>

            <H>BEHAVIOURAL BASELINE</H>
            <div className="space-y-1.5">
              {Object.entries(agent.baseline.toolShare).map(([tool, v]) => (
                <div key={tool} className="flex items-center gap-2 text-xs"><span className="w-40 shrink-0 truncate font-mono text-muted">{tool}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fg/10"><div className="h-full rounded-full bg-gradient-to-r from-neon to-holo" style={{ width: `${v * 100}%` }} /></div>
                  <span className="w-9 text-right font-mono">{Math.round(v * 100)}%</span></div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Meta k="sessions">{agent.baseline.sessions}</Meta><Meta k="calls / min">{agent.baseline.callsPerMinute}</Meta>
              <Meta k="golden sensitive share">{Math.round(agent.baseline.sensitiveShareGolden * 100)}%</Meta><Meta k="rolling sensitive share">{Math.round(agent.baseline.sensitiveShareRolling * 100)}%</Meta>
              <Meta k="JS divergence vs golden">{agent.baseline.jsDivergence.toFixed(2)}</Meta><Meta k="golden profile" mono>{agent.baseline.goldenVersion}</Meta>
            </div>

            <H>RECENT ACTIONS</H>
            {recent.length ? (
              <ul className="space-y-1.5">{recent.map((e) => (
                <li key={e.event_id}><button onClick={() => openEvent(e.event_id)} className="flex w-full items-center justify-between gap-2 rounded-lg border border-line/[0.08] bg-bg/40 px-3 py-1.5 text-left text-xs hover:border-neon/30">
                  <span className="min-w-0 truncate"><span className="font-mono text-muted">{e.event_id}</span> · {e.tool}</span><span className="flex items-center gap-2"><ScorePill score={e.decision.score} /><ActionBadge action={e.decision.action} /></span></button></li>
              ))}</ul>
            ) : <p className="text-xs text-muted">No recent events.</p>}

            <H>SECURITY ALERTS</H>
            {myAlerts.length ? <ul className="space-y-1.5">{myAlerts.map((a) => (
              <li key={a.id}><button onClick={() => openAlert(a.id)} className="flex w-full items-center justify-between gap-2 rounded-lg border border-line/[0.08] bg-bg/40 px-3 py-1.5 text-left text-xs hover:border-neon/30"><span className="min-w-0 truncate">{a.title}</span><SeverityBadge severity={a.severity} /></button></li>
            ))}</ul> : <p className="text-xs text-muted">No alerts for this agent.</p>}

            <H>CONTAINMENT HISTORY</H>
            {agent.containment.length ? (
              <ol className="space-y-2 border-l border-line/15 pl-4">
                {[...agent.containment].reverse().map((c) => (
                  <li key={c.id} className="relative text-xs"><span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-neon" />
                    <div className="font-mono text-muted">{fmtDateTime(c.ts)} · {c.by}</div>
                    <div><span className="text-muted">{titleCase(c.from)}</span> → <span className="font-semibold">{titleCase(c.to)}</span></div><div className="text-muted">{c.note}</div></li>
                ))}
              </ol>
            ) : <p className="text-xs text-muted">No containment actions recorded.</p>}
          </>
        )}
      </Drawer>
      <ConfirmDialog
        open={!!pending} onClose={() => setPending(null)} title={pending ? `${pending.label} ${agent?.name ?? ''}?` : ''}
        confirmLabel={pending?.label} tone={pending?.action === 'isolate' || pending?.action === 'quarantine' ? 'danger' : 'primary'}
        onConfirm={() => { if (pending && agent) { act(agent.id, pending.action); push({ title: `${agent.name}: ${pending.label.toLowerCase()} applied`, body: 'Simulated state change', tone: 'ok' }); } }}
      >
        <p>{pending?.text}</p>
      </ConfirmDialog>
    </>
  );
}
