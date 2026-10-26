import { ArrowUpDown, Check, RotateCcw, Search, ShieldAlert, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, ScorePill, SeverityBadge, StatusBadge } from '../components/ui/Badges';
import { IconButton, Select } from '../components/ui/Controls';
import { Card } from '../components/ui/Card';
import { Empty, Pagination } from '../components/ui/Misc';
import { AGENT_NAME } from '../data/agents';
import { useOpen } from '../hooks/useOpen';
import { useTable } from '../hooks/useTable';
import { categoryLabel } from '../lib/simulationEngine';
import { ago, cn, sevRank } from '../lib/utils';
import { useStore } from '../store/useStore';
import { useUi } from '../store/useUi';
import type { AlertStatus, Severity, ThreatCategory } from '../types';
import { THREAT_ORDER } from '../lib/derive';

const RANGES = { all: 0, '1h': 3_600_000, '24h': 86_400_000, '7d': 604_800_000 } as const;

export default function Alerts() {
  const alerts = useStore((s) => s.alerts);
  const agents = useStore((s) => s.agents);
  const setStatus = useStore((s) => s.setAlertStatus);
  const push = useUi((s) => s.push);
  const { openAlert } = useOpen();
  const [q, setQ] = useState('');
  const [sev, setSev] = useState<'all' | Severity>('all');
  const [cat, setCat] = useState<'all' | ThreatCategory>('all');
  const [status, setSt] = useState<'all' | AlertStatus>('all');
  const [agent, setAgent] = useState('all');
  const [range, setRange] = useState<keyof typeof RANGES>('all');

  const rows = useMemo(() => alerts.filter((a) =>
    (sev === 'all' || a.severity === sev) && (cat === 'all' || a.category === cat) && (status === 'all' || a.status === status) &&
    (agent === 'all' || a.agentId === agent) && (range === 'all' || Date.now() - a.ts <= RANGES[range]) &&
    (!q || (a.id + a.title + a.explanation + (AGENT_NAME[a.agentId] ?? '')).toLowerCase().includes(q.toLowerCase())),
  ), [alerts, q, sev, cat, status, agent, range]);

  const t = useTable(rows, { time: (a) => a.ts, score: (a) => a.score, severity: (a) => sevRank(a.severity), status: (a) => a.status, agent: (a) => AGENT_NAME[a.agentId] ?? a.agentId, id: (a) => a.id }, { sort: 'time', pageSize: 8 });
  const th = (key: string, label: string) => <th><button className="inline-flex items-center gap-1 hover:text-fg" onClick={() => t.toggle(key)}>{label}<ArrowUpDown size={11} className={t.sort === key ? 'text-neon' : 'opacity-40'} /></button></th>;
  const counts = { open: alerts.filter((a) => a.status === 'open').length, ack: alerts.filter((a) => a.status === 'acknowledged').length, closed: alerts.filter((a) => a.status === 'closed').length };
  const act = (id: string, s: AlertStatus, msg: string) => { setStatus(id, s); push({ title: msg, body: id, tone: 'ok' }); };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[['open', counts.open, 'danger'], ['acknowledged', counts.ack, 'warn'], ['closed', counts.closed, 'muted']].map(([l, n, tone]) => (
          <button key={l as string} onClick={() => setSt(status === l ? 'all' : (l as AlertStatus))} className={cn('glass holo-edge p-3 text-left transition-colors', status === l && 'glow-neon')}>
            <div className="label">{l as string}</div><div className={cn('mt-1 font-mono text-2xl font-semibold', tone === 'danger' ? 'text-danger' : tone === 'warn' ? 'text-warn' : 'text-muted')}>{n as number}</div>
          </button>
        ))}
      </div>

      <Card bodyClassName="!p-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[200px] flex-1 flex-col gap-1"><span className="label !text-[9.5px]">Search</span>
            <span className="relative"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input className="input !py-1.5 !pl-8 text-xs" placeholder="Alert id, agent or text" value={q} onChange={(e) => { setQ(e.target.value); t.setPage(1); }} aria-label="Search alerts" /></span></label>
          <Select label="Severity" className="w-32" value={sev} onChange={setSev} options={[{ value: 'all', label: 'All' }, ...(['critical', 'high', 'medium', 'low', 'informational'] as Severity[]).map((s) => ({ value: s, label: s }))]} />
          <Select label="Threat category" className="w-48" value={cat} onChange={setCat} options={[{ value: 'all', label: 'All categories' }, ...THREAT_ORDER.map((c) => ({ value: c, label: categoryLabel(c) }))]} />
          <Select label="Status" className="w-32" value={status} onChange={setSt} options={[{ value: 'all', label: 'All' }, { value: 'open', label: 'open' }, { value: 'acknowledged', label: 'acknowledged' }, { value: 'closed', label: 'closed' }]} />
          <Select label="Agent" className="w-48" value={agent} onChange={setAgent} options={[{ value: 'all', label: 'All agents' }, ...agents.map((a) => ({ value: a.id, label: a.name }))]} />
          <Select label="Time range" className="w-28" value={range} onChange={setRange} options={[{ value: 'all', label: 'All time' }, { value: '1h', label: 'Last hour' }, { value: '24h', label: 'Last 24h' }, { value: '7d', label: 'Last 7 days' }]} />
        </div>
      </Card>

      <Card title="Alert queue" code="SOC_QUEUE" icon={ShieldAlert} bodyClassName="!p-0" right={<span className="font-mono text-[11px] text-muted">{rows.length} alerts</span>}>
        {rows.length === 0 ? <Empty icon={ShieldAlert} title="No alerts match" hint="Adjust the filters, or run an attack scenario to generate a new alert." /> : (
          <>
            <div className="overflow-x-auto"><table className="tbl w-full min-w-[1020px] text-[13px]">
              <thead><tr>{th('id', 'Alert')}{th('time', 'Time')}{th('agent', 'Agent')}<th>Category</th>{th('score', 'Risk')}{th('severity', 'Severity')}{th('status', 'Status')}<th>Enforcement</th><th /></tr></thead>
              <tbody>{t.view.map((a) => (
                <tr key={a.id} className="row cursor-pointer" onClick={() => openAlert(a.id)}>
                  <td className="max-w-[260px]"><div className="font-mono text-xs text-neon">{a.id}</div><div className="truncate text-xs text-muted" title={a.title}>{a.title}</div></td>
                  <td className="whitespace-nowrap font-mono text-xs text-muted">{ago(a.ts)}</td>
                  <td className="whitespace-nowrap">{AGENT_NAME[a.agentId] ?? a.agentId}</td>
                  <td><Badge tone="holo">{categoryLabel(a.category)}</Badge></td>
                  <td><ScorePill score={a.score} /></td><td><SeverityBadge severity={a.severity} /></td><td><StatusBadge s={a.status} /></td>
                  <td><Badge tone={a.actuallyBlocked ? 'danger' : 'muted'}>{a.actuallyBlocked ? 'blocked' : 'not enforced'}</Badge></td>
                  <td onClick={(e) => e.stopPropagation()} className="whitespace-nowrap text-right">
                    {a.status === 'open' && <IconButton icon={Check} label="Acknowledge alert" className="!h-7 !w-7" onClick={() => act(a.id, 'acknowledged', 'Alert acknowledged')} />}
                    {a.status !== 'closed' && <IconButton icon={X} label="Close alert" className="ml-1 !h-7 !w-7" onClick={() => act(a.id, 'closed', 'Alert closed')} />}
                    {a.status === 'closed' && <IconButton icon={RotateCcw} label="Reopen alert" className="!h-7 !w-7" onClick={() => act(a.id, 'open', 'Alert reopened')} />}
                  </td>
                </tr>))}</tbody>
            </table></div>
            <Pagination page={t.page} pages={t.pages} onPage={t.setPage} total={t.total} />
          </>
        )}
      </Card>
    </div>
  );
}
