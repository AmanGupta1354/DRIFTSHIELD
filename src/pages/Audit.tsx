import { ArrowUpDown, Download, FileJson, Link2, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ActionBadge, Badge, ScorePill } from '../components/ui/Badges';
import { Button, Select } from '../components/ui/Controls';
import { Card } from '../components/ui/Card';
import { CopyButton, Empty, Pagination } from '../components/ui/Misc';
import { AGENT_NAME } from '../data/agents';
import { useOpen } from '../hooks/useOpen';
import { useTable } from '../hooks/useTable';
import { eventJson } from '../lib/eventJson';
import { exportCSV, exportJSON } from '../lib/exportUtils';
import { GENESIS, chain } from '../lib/hash';
import { isBlocking } from '../lib/riskScoring';
import { cn, fmtDateTime } from '../lib/utils';
import { useStore } from '../store/useStore';
import { useUi } from '../store/useUi';
import type { EnforcementAction, SecEvent } from '../types';

const payload = (e: SecEvent) => [e.event_id, e.ts, e.agent_id, e.tool, e.resource, e.decision.score, e.decision.action].join('|');

export default function Audit() {
  const events = useStore((s) => s.events);
  const { openEvent } = useOpen();
  const push = useUi((s) => s.push);
  const [q, setQ] = useState('');
  const [dec, setDec] = useState<'all' | EnforcementAction>('all');
  const [tamper, setTamper] = useState<string | null>(null);

  const ordered = useMemo(() => [...events].sort((a, b) => a.ts - b.ts || a.event_id.localeCompare(b.event_id)), [events]);
  const stored = useMemo(() => chain(ordered, payload), [ordered]);
  // tamper demo: re-derive hashes over modified data and compare with the recorded ones
  const recomputed = useMemo(() => {
    if (!tamper) return stored;
    return chain(ordered.map((e) => (e.event_id === tamper ? { ...e, decision: { ...e.decision, score: Math.max(0, e.decision.score - 40), action: 'allow' as const } } : e)), payload);
  }, [ordered, stored, tamper]);
  const broken = useMemo(() => new Set(stored.filter((s, i) => recomputed[i].hash !== s.hash).map((s) => s.item.event_id)), [stored, recomputed]);

  const rows = useMemo(() => stored.map((s, i) => ({ ...s, i, ok: !broken.has(s.item.event_id) })).filter((r) =>
    (dec === 'all' || r.item.decision.action === dec) &&
    (!q || (r.item.event_id + r.item.agent_id + r.item.tool + r.item.action + r.hash).toLowerCase().includes(q.toLowerCase())),
  ), [stored, broken, q, dec]);
  const t = useTable(rows, { time: (r) => r.item.ts, id: (r) => r.item.event_id, score: (r) => r.item.decision.score, i: (r) => r.i }, { sort: 'i', pageSize: 12 });
  const th = (key: string, label: string) => <th><button className="inline-flex items-center gap-1 hover:text-fg" onClick={() => t.toggle(key)}>{label}<ArrowUpDown size={11} className={t.sort === key ? 'text-neon' : 'opacity-40'} /></button></th>;

  const doJSON = () => { exportJSON(`driftshield-audit-${Date.now()}.json`, { simulated: true, note: 'Simulated hash chain (non-cryptographic). Not tamper-proof.', records: stored.map((s) => ({ ...eventJson(s.item), prev_hash: s.prevHash, hash: s.hash })) }); push({ title: 'Audit JSON exported', body: `${stored.length} records`, tone: 'ok' }); };
  const doCSV = () => { exportCSV(`driftshield-audit-${Date.now()}.csv`, stored.map((s) => ({ timestamp: new Date(s.item.ts).toISOString(), event_id: s.item.event_id, agent_id: s.item.agent_id, action: s.item.action, tool: s.item.tool, resource: s.item.resource, risk_score: s.item.decision.score, decision: s.item.decision.action, enforced: s.item.enforced ? 'blocked' : 'not blocked', prev_hash: s.prevHash, hash: s.hash }))); push({ title: 'Audit CSV exported', body: `${stored.length} rows`, tone: 'ok' }); };

  return (
    <div className="space-y-4">
      <Card bodyClassName="!p-4">
        <div className="flex flex-wrap items-center gap-4">
          <span className={cn('grid h-11 w-11 place-items-center rounded-xl border', broken.size ? 'border-danger/40 bg-danger/10 text-danger' : 'border-ok/35 bg-ok/10 text-ok')}>{broken.size ? <TriangleAlert size={20} /> : <ShieldCheck size={20} />}</span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">{broken.size ? `Chain broken — ${broken.size} record${broken.size > 1 ? 's' : ''} no longer match their recorded hash` : `Hash chain consistent across ${stored.length} records`}</div>
            <p className="text-xs text-muted">Each record commits to the previous one. Simulated hashes — not a tamper-proof store.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {tamper ? <Button variant="ok" onClick={() => setTamper(null)}>Restore record</Button> : <Button variant="danger" onClick={() => setTamper(ordered[Math.floor(ordered.length / 2)]?.event_id ?? null)}>Simulate tampering</Button>}
            <Button variant="neon" icon={FileJson} onClick={doJSON}>Export JSON</Button>
            <Button variant="neon" icon={Download} onClick={doCSV}>Export CSV</Button>
          </div>
        </div>
      </Card>

      <Card bodyClassName="!p-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[200px] flex-1 flex-col gap-1"><span className="label !text-[9.5px]">Search</span><input className="input !py-1.5 text-xs" placeholder="Event, agent, tool or hash" value={q} onChange={(e) => { setQ(e.target.value); t.setPage(1); }} aria-label="Search audit trail" /></label>
          <Select label="Decision" className="w-44" value={dec} onChange={(v) => { setDec(v); t.setPage(1); }} options={[{ value: 'all', label: 'All decisions' }, { value: 'allow', label: 'Allow' }, { value: 'watch', label: 'Watch' }, { value: 'step_up', label: 'Step-up' }, { value: 'block', label: 'Block' }, { value: 'block_quarantine', label: 'Block + quarantine' }]} />
        </div>
      </Card>

      <Card title="Hash-chained decision log" code="AUDIT_TRAIL" icon={Link2} bodyClassName="!p-0" right={<Badge tone="warn">simulated hashes</Badge>}>
        {rows.length === 0 ? <Empty icon={Link2} title="No audit records match" /> : (
          <>
            <div className="overflow-x-auto"><table className="tbl w-full min-w-[1180px] text-[12.5px]">
              <thead><tr>{th('i', '#')}{th('time', 'Timestamp')}{th('id', 'Event')}<th>Agent</th><th>Requested action</th>{th('score', 'Risk')}<th>Decision</th><th>Enforcement</th><th>Previous hash</th><th>Current hash</th><th /></tr></thead>
              <tbody>{t.view.map((r) => (
                <tr key={r.item.event_id} className={cn('row cursor-pointer', !r.ok && 'bg-danger/10')} onClick={() => openEvent(r.item.event_id)}>
                  <td className="font-mono text-[11px] text-muted">{r.i + 1}</td>
                  <td className="whitespace-nowrap font-mono text-[11px] text-muted">{fmtDateTime(r.item.ts)}</td>
                  <td className="font-mono text-xs text-neon">{r.item.event_id}</td>
                  <td className="whitespace-nowrap text-xs">{AGENT_NAME[r.item.agent_id] ?? r.item.agent_id}</td>
                  <td className="max-w-[260px] truncate text-xs text-muted" title={r.item.action}>{r.item.tool} · {r.item.action}</td>
                  <td><ScorePill score={r.item.decision.score} /></td><td><ActionBadge action={r.item.decision.action} /></td>
                  <td><Badge tone={isBlocking(r.item.decision.action) ? 'danger' : 'muted'}>{isBlocking(r.item.decision.action) ? 'blocked' : 'forwarded'}</Badge></td>
                  <td className="font-mono text-[10.5px] text-muted">{r.prevHash === GENESIS ? 'genesis' : r.prevHash.slice(0, 12) + '…'}</td>
                  <td className={cn('font-mono text-[10.5px]', r.ok ? 'text-neon' : 'text-danger line-through')}>{r.hash.slice(0, 12)}…{!r.ok && <span className="ml-1 not-italic no-underline">✗ mismatch</span>}</td>
                  <td onClick={(e) => e.stopPropagation()}><CopyButton text={JSON.stringify({ ...eventJson(r.item), prev_hash: r.prevHash, hash: r.hash }, null, 2)} label="JSON" /></td>
                </tr>))}</tbody>
            </table></div>
            <Pagination page={t.page} pages={t.pages} onPage={t.setPage} total={t.total} />
          </>
        )}
      </Card>
    </div>
  );
}
