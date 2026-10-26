import { motion } from 'framer-motion';
import { ArrowUpDown, Bot, LayoutGrid, Rows3, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, ScorePill, SensBadge, StateBadge } from '../components/ui/Badges';
import { Button, Segmented, Select } from '../components/ui/Controls';
import { Card } from '../components/ui/Card';
import { Empty, Pagination } from '../components/ui/Misc';
import { ROLE_LABEL, activeBody } from '../data/contracts';
import { useOpen } from '../hooks/useOpen';
import { useTable } from '../hooks/useTable';
import { TONE, ago, cn, scoreTone } from '../lib/utils';
import { useStore } from '../store/useStore';
import type { Agent, AgentState, Role } from '../types';

const riskBand = (r: number) => (r >= 75 ? 'critical' : r >= 55 ? 'high' : r >= 35 ? 'medium' : 'low');

function AgentCard({ a, onOpen, i }: { a: Agent; onOpen: () => void; i: number }) {
  const contract = useStore((s) => s.contracts.find((c) => c.role === a.role)!);
  const body = activeBody(contract);
  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.04 }} onClick={onOpen}
      className={cn('glass holo-edge group flex flex-col gap-3 p-4 text-left transition-transform hover:-translate-y-0.5', a.state === 'quarantined' && 'glow-danger', a.state === 'isolated' && 'glow-brand')}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl border', TONE[scoreTone(a.risk)].border, TONE[scoreTone(a.risk)].bg, TONE[scoreTone(a.risk)].text)}><Bot size={18} /></span>
          <div className="min-w-0"><div className="truncate text-[13.5px] font-semibold">{a.name}</div><div className="truncate font-mono text-[11px] text-muted">{a.id}</div></div>
        </div>
        <ScorePill score={a.risk} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5"><StateBadge s={a.state} /><Badge tone="holo">{ROLE_LABEL[a.role]}</Badge><Badge>tier {a.trustTier}</Badge></div>
      <div className="flex flex-wrap gap-1">{body.allowedTools.slice(0, 4).map((t) => <span key={t} className="rounded border border-line/10 bg-bg/50 px-1.5 py-0.5 font-mono text-[10px] text-muted">{t}</span>)}</div>
      <div className="flex items-center justify-between text-[11px] text-muted"><span>ceiling <SensBadge s={body.maxSensitivity} /></span><span className="font-mono">seen {ago(a.lastSeen)}</span></div>
    </motion.button>
  );
}

export default function AgentFleet() {
  const agents = useStore((s) => s.agents);
  const { openAgent } = useOpen();
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const [q, setQ] = useState('');
  const [role, setRole] = useState<'all' | Role>('all');
  const [status, setStatus] = useState<'all' | AgentState>('all');
  const [risk, setRisk] = useState<'all' | 'low' | 'medium' | 'high' | 'critical'>('all');
  const [tier, setTier] = useState<'all' | '1' | '2' | '3'>('all');

  const rows = useMemo(() => agents.filter((a) =>
    (role === 'all' || a.role === role) && (status === 'all' || a.state === status) && (risk === 'all' || riskBand(a.risk) === risk) &&
    (tier === 'all' || String(a.trustTier) === tier) && (!q || (a.name + a.id + a.owner).toLowerCase().includes(q.toLowerCase())),
  ), [agents, q, role, status, risk, tier]);

  const t = useTable(rows, { name: (a) => a.name, role: (a) => a.role, state: (a) => a.state, risk: (a) => a.risk, tier: (a) => a.trustTier, seen: (a) => a.lastSeen }, { sort: 'risk', pageSize: 8 });
  const th = (key: string, label: string) => (
    <th><button className="inline-flex items-center gap-1 hover:text-fg" onClick={() => t.toggle(key)}>{label}<ArrowUpDown size={11} className={t.sort === key ? 'text-neon' : 'opacity-40'} /></button></th>
  );
  const clear = () => { setQ(''); setRole('all'); setStatus('all'); setRisk('all'); setTier('all'); };
  const filtered = q || role !== 'all' || status !== 'all' || risk !== 'all' || tier !== 'all';

  return (
    <div className="space-y-4">
      <Card bodyClassName="!p-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[200px] flex-1 flex-col gap-1"><span className="label !text-[9.5px]">Search</span>
            <span className="relative"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input className="input !py-1.5 !pl-8 text-xs" placeholder="Name, id or owner" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search agents" /></span></label>
          <Select label="Role" className="w-36" value={role} onChange={setRole} options={[{ value: 'all', label: 'All roles' }, ...(Object.keys(ROLE_LABEL) as Role[]).map((r) => ({ value: r, label: ROLE_LABEL[r] }))]} />
          <Select label="Status" className="w-36" value={status} onChange={setStatus} options={[{ value: 'all', label: 'All states' }, ...(['active', 'watched', 'paused', 'quarantined', 'isolated'] as AgentState[]).map((s) => ({ value: s, label: s }))]} />
          <Select label="Risk level" className="w-32" value={risk} onChange={setRisk} options={[{ value: 'all', label: 'Any risk' }, { value: 'low', label: 'Low (<35)' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }, { value: 'critical', label: 'Critical (75+)' }]} />
          <Select label="Trust tier" className="w-28" value={tier} onChange={setTier} options={[{ value: 'all', label: 'Any tier' }, { value: '1', label: 'Tier 1' }, { value: '2', label: 'Tier 2' }, { value: '3', label: 'Tier 3' }]} />
          <Segmented value={view} onChange={setView} options={[{ value: 'cards', label: <LayoutGrid size={13} /> }, { value: 'table', label: <Rows3 size={13} /> }]} />
        </div>
        <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-muted"><span>{rows.length} of {agents.length} agents</span>{filtered && <button className="text-neon hover:underline" onClick={clear}>clear filters</button>}</div>
      </Card>

      {rows.length === 0 ? <Card><Empty icon={Bot} title="No agents match these filters" hint="Try widening the role, status or risk filters." action={<Button onClick={clear}>Clear filters</Button>} /></Card> : view === 'cards' ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {[...rows].sort((a, b) => b.risk - a.risk).map((a, i) => <AgentCard key={a.id} a={a} i={i} onOpen={() => openAgent(a.id)} />)}
        </div>
      ) : (
        <Card bodyClassName="!p-0">
          <div className="overflow-x-auto"><table className="tbl w-full min-w-[820px] text-[13px]">
            <thead><tr>{th('name', 'Agent')}{th('role', 'Role')}{th('state', 'State')}{th('tier', 'Trust')}{th('risk', 'Risk')}{th('seen', 'Last seen')}</tr></thead>
            <tbody>{t.view.map((a) => (
              <tr key={a.id} className="row cursor-pointer" onClick={() => openAgent(a.id)}>
                <td><div className="font-medium">{a.name}</div><div className="font-mono text-[11px] text-muted">{a.id}</div></td>
                <td>{ROLE_LABEL[a.role]}</td><td><StateBadge s={a.state} /></td><td className="font-mono">tier {a.trustTier}</td><td><ScorePill score={a.risk} /></td><td className="font-mono text-xs text-muted">{ago(a.lastSeen)}</td>
              </tr>))}</tbody>
          </table></div>
          <Pagination page={t.page} pages={t.pages} onPage={t.setPage} total={t.total} />
        </Card>
      )}
    </div>
  );
}
