import { CornerDownRight, History, Rows3, Search, Waypoints } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ActionBadge, Badge, ScorePill, SensBadge, TrustBadge } from '../components/ui/Badges';
import { Segmented, Select } from '../components/ui/Controls';
import { Card } from '../components/ui/Card';
import { Empty, Pagination } from '../components/ui/Misc';
import { AGENT_NAME } from '../data/agents';
import { useOpen } from '../hooks/useOpen';
import { isBlocking } from '../lib/riskScoring';
import { TONE, actionTone, cn, fmtDateTime, fmtTime } from '../lib/utils';
import { useStore } from '../store/useStore';
import { ArrowUpDown } from 'lucide-react';
import { useTable } from '../hooks/useTable';
import type { SecEvent } from '../types';

type EType = 'all' | 'blocked' | 'suspicious' | 'tainted' | 'delegation' | 'egress' | 'routine';
const TYPES: { value: EType; label: string; test: (e: SecEvent) => boolean }[] = [
  { value: 'all', label: 'All events', test: () => true },
  { value: 'blocked', label: 'Blocked', test: (e) => isBlocking(e.decision.action) },
  { value: 'suspicious', label: 'Suspicious (≥35)', test: (e) => e.decision.score >= 35 },
  { value: 'tainted', label: 'Tainted input', test: (e) => e.input_taint.some((t) => t.trust === 'untrusted') },
  { value: 'delegation', label: 'Delegation', test: (e) => !!e.delegate_to || e.delegation_chain.length > 1 },
  { value: 'egress', label: 'External egress', test: (e) => !!e.destination },
  { value: 'routine', label: 'Routine (<35)', test: (e) => e.decision.score < 35 },
];
const RANGES = { all: 0, '15m': 900_000, '1h': 3_600_000, '24h': 86_400_000 } as const;

export default function Timeline() {
  const events = useStore((s) => s.events);
  const agents = useStore((s) => s.agents);
  const { openEvent, openAgent } = useOpen();
  const [view, setView] = useState<'timeline' | 'table'>('timeline');
  const [q, setQ] = useState('');
  const [agent, setAgent] = useState('all');
  const [type, setType] = useState<EType>('all');
  const [range, setRange] = useState<keyof typeof RANGES>('all');

  const rows = useMemo(() => {
    const test = TYPES.find((t) => t.value === type)!.test;
    return events.filter((e) =>
      test(e) && (agent === 'all' || e.agent_id === agent) && (range === 'all' || Date.now() - e.ts <= RANGES[range]) &&
      (!q || (e.event_id + e.tool + e.action + e.resource + e.session_id + (e.parent_event_id ?? '') + (AGENT_NAME[e.agent_id] ?? '')).toLowerCase().includes(q.toLowerCase())),
    );
  }, [events, q, agent, type, range]);

  const t = useTable(rows, { time: (e) => e.ts, id: (e) => e.event_id, agent: (e) => e.agent_id, tool: (e) => e.tool, score: (e) => e.decision.score, sens: (e) => e.resource_sensitivity }, { sort: 'time', pageSize: view === 'table' ? 12 : 14 });
  const th = (key: string, label: string) => <th><button className="inline-flex items-center gap-1 hover:text-fg" onClick={() => t.toggle(key)}>{label}<ArrowUpDown size={11} className={t.sort === key ? 'text-neon' : 'opacity-40'} /></button></th>;

  return (
    <div className="space-y-4">
      <Card bodyClassName="!p-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[200px] flex-1 flex-col gap-1"><span className="label !text-[9.5px]">Search</span>
            <span className="relative"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input className="input !py-1.5 !pl-8 text-xs" placeholder="Event id, tool, resource, session…" value={q} onChange={(e) => { setQ(e.target.value); t.setPage(1); }} aria-label="Search events" /></span></label>
          <Select label="Agent" className="w-48" value={agent} onChange={(v) => { setAgent(v); t.setPage(1); }} options={[{ value: 'all', label: 'All agents' }, ...agents.map((a) => ({ value: a.id, label: a.name }))]} />
          <Select label="Event type" className="w-44" value={type} onChange={(v) => { setType(v); t.setPage(1); }} options={TYPES.map((x) => ({ value: x.value, label: x.label }))} />
          <Select label="Time range" className="w-32" value={range} onChange={(v) => { setRange(v); t.setPage(1); }} options={[{ value: 'all', label: 'All time' }, { value: '15m', label: 'Last 15 min' }, { value: '1h', label: 'Last hour' }, { value: '24h', label: 'Last 24h' }]} />
          <Segmented value={view} onChange={setView} options={[{ value: 'timeline', label: <Waypoints size={13} /> }, { value: 'table', label: <Rows3 size={13} /> }]} />
        </div>
      </Card>

      <Card title={view === 'timeline' ? 'Investigation timeline' : 'Event table'} code="EVENT_STREAM" icon={History} bodyClassName="!p-0" right={<span className="font-mono text-[11px] text-muted">{rows.length} events</span>}>
        {rows.length === 0 ? <Empty icon={History} title="No events match" hint="Widen the filters or run a scenario to generate events." /> : view === 'table' ? (
          <>
            <div className="overflow-x-auto"><table className="tbl w-full min-w-[1200px] text-[12.5px]">
              <thead><tr>{th('time', 'Timestamp')}{th('id', 'Event')}{th('agent', 'Agent')}<th>Parent</th>{th('tool', 'Tool')}<th>Action</th><th>Resource</th>{th('sens', 'Sensitivity')}<th>Input trust</th>{th('score', 'Risk')}<th>Decision</th></tr></thead>
              <tbody>{t.view.map((e) => (
                <tr key={e.event_id} className="row cursor-pointer" onClick={() => openEvent(e.event_id)}>
                  <td className="whitespace-nowrap font-mono text-[11px] text-muted">{fmtDateTime(e.ts)}</td>
                  <td className="font-mono text-xs text-neon">{e.event_id}</td>
                  <td className="font-mono text-[11px]">{e.agent_id}</td>
                  <td className="font-mono text-[11px] text-muted">{e.parent_event_id ?? '—'}</td>
                  <td className="font-mono text-xs">{e.tool}</td>
                  <td className="max-w-[240px] truncate text-xs text-muted" title={e.action}>{e.action}</td>
                  <td className="font-mono text-xs">{e.resource}</td>
                  <td><SensBadge s={e.resource_sensitivity} /></td>
                  <td>{e.input_taint.length ? <TrustBadge trust={e.input_taint.some((x) => x.trust === 'untrusted') ? 'untrusted' : 'trusted'} /> : <span className="text-xs text-muted">trusted</span>}</td>
                  <td><ScorePill score={e.decision.score} /></td><td><ActionBadge action={e.decision.action} /></td>
                </tr>))}</tbody>
            </table></div>
            <Pagination page={t.page} pages={t.pages} onPage={t.setPage} total={t.total} />
          </>
        ) : (
          <>
            <ol className="relative px-4 py-4">
              <span className="absolute bottom-6 left-[34px] top-6 w-px bg-gradient-to-b from-neon/40 via-line/15 to-transparent" aria-hidden />
              {t.view.map((e) => {
                const tone = TONE[isBlocking(e.decision.action) ? 'danger' : actionTone(e.decision.action)];
                return (
                  <li key={e.event_id} className="relative pl-10">
                    <span className={cn('absolute left-[7px] top-4 grid h-[22px] w-[22px] place-items-center rounded-full border bg-bg', tone.border)}><span className={cn('h-2 w-2 rounded-full', tone.dot)} /></span>
                    <button onClick={() => openEvent(e.event_id)} className={cn('mb-2 w-full rounded-xl border bg-bg/40 p-3 text-left transition-colors hover:border-neon/40', isBlocking(e.decision.action) ? 'border-danger/35' : 'border-line/[0.08]')}>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-mono text-[11px] text-muted">{fmtTime(e.ts)}</span>
                        <span className="font-mono text-xs text-neon">{e.event_id}</span>
                        <span className="text-[13px] font-medium">{AGENT_NAME[e.agent_id] ?? e.agent_id}</span>
                        <span className="font-mono text-xs">{e.tool}</span>
                        <span className="ml-auto flex items-center gap-2"><SensBadge s={e.resource_sensitivity} /><ScorePill score={e.decision.score} /><ActionBadge action={e.decision.action} /></span>
                      </div>
                      <p className="mt-1 text-xs text-muted">{e.action}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
                        {e.parent_event_id && <span className="flex items-center gap-1 font-mono text-muted"><CornerDownRight size={12} /> parent {e.parent_event_id}</span>}
                        {e.input_taint.filter((x) => x.trust === 'untrusted').map((x) => <Badge key={x.source} tone="danger">untrusted · {x.source}</Badge>)}
                        {e.delegation_chain.length > 1 && <Badge tone="holo">chain {e.delegation_chain.length} agents</Badge>}
                        <span className="font-mono text-muted">{e.session_id}</span>
                        <span className="ml-auto cursor-pointer text-neon hover:underline" onClick={(ev) => { ev.stopPropagation(); openAgent(e.agent_id); }}>agent profile</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ol>
            <Pagination page={t.page} pages={t.pages} onPage={t.setPage} total={t.total} />
          </>
        )}
      </Card>
    </div>
  );
}
