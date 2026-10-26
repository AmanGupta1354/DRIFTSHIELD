import { Ban, CheckCircle2, Database, FlaskConical, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge, SensBadge } from '../components/ui/Badges';
import { Select } from '../components/ui/Controls';
import { Card } from '../components/ui/Card';
import { Drawer } from '../components/ui/Overlays';
import { Empty, Meta } from '../components/ui/Misc';
import { POLICIES } from '../data/policies';
import { ROLE_LABEL, activeBody } from '../data/contracts';
import { RESOURCES } from '../data/resources';
import { checkAccess } from '../lib/policyEngine';
import { cn } from '../lib/utils';
import { useStore } from '../store/useStore';
import type { Resource, Role, Sensitivity } from '../types';

const TRUST_TONE = { 'n/a': 'muted', internal: 'ok', 'approved-external': 'neon', 'unapproved-external': 'danger', 'untrusted-source': 'warn' } as const;

function PolicyTester({ preset }: { preset?: Resource }) {
  const contracts = useStore((s) => s.contracts);
  const [role, setRole] = useState<Role>('procurement');
  const [resId, setResId] = useState(preset?.id ?? 'res_hr_salaries');
  const res = RESOURCES.find((r) => r.id === resId)!;
  const [tool, setTool] = useState(res.tools[0]);
  const c = contracts.find((x) => x.role === role)!;
  const verdict = checkAccess(role, res.tools.includes(tool) ? tool : res.tools[0], res, activeBody(c));
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Select label="Agent role" value={role} onChange={setRole} options={(Object.keys(ROLE_LABEL) as Role[]).map((r) => ({ value: r, label: ROLE_LABEL[r] }))} />
        <Select label="Resource" value={resId} onChange={(v) => { setResId(v); setTool(RESOURCES.find((r) => r.id === v)!.tools[0]); }} options={RESOURCES.map((r) => ({ value: r.id, label: r.name }))} />
        <Select label="Tool" value={res.tools.includes(tool) ? tool : res.tools[0]} onChange={setTool} options={res.tools.map((t) => ({ value: t, label: t }))} />
      </div>
      <div className={cn('rounded-xl border p-3', verdict.allowed ? 'border-ok/35 bg-ok/10' : 'border-danger/40 bg-danger/10')}>
        <div className={cn('flex items-center gap-2 font-mono text-xs font-semibold tracking-wider', verdict.allowed ? 'text-ok' : 'text-danger')}>
          {verdict.allowed ? <CheckCircle2 size={15} /> : <Ban size={15} />} {verdict.allowed ? 'WITHIN CONTRACT — no policy violated' : `ACCESS DENIED — ${verdict.violations.length} violation${verdict.violations.length > 1 ? 's' : ''}`}
        </div>
        {!verdict.allowed && (
          <ul className="mt-2 space-y-1.5">{verdict.violations.map((v) => (
            <li key={v.id + v.text} className="flex items-start gap-2 text-xs"><Badge tone="danger">{v.id}</Badge><span><b>{POLICIES[v.id]?.title ?? 'Resource ACL'}</b> — {v.text}</span></li>
          ))}</ul>
        )}
        <p className="mt-2 text-[11px] text-muted">Evaluated against the active {ROLE_LABEL[role]} contract v{c.activeVersion} (simulated).</p>
      </div>
    </div>
  );
}

export default function Resources() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [sens, setSens] = useState<'all' | Sensitivity>('all');
  const [kind, setKind] = useState<'all' | Resource['kind']>('all');
  const [role, setRole] = useState<'all' | Role>('all');
  const rows = useMemo(() => RESOURCES.filter((r) =>
    (sens === 'all' || r.sensitivity === sens) && (kind === 'all' || r.kind === kind) && (role === 'all' || r.approvedRoles.includes(role)) &&
    (!q || (r.name + r.id + r.tools.join(' ') + r.owner).toLowerCase().includes(q.toLowerCase())),
  ), [q, sens, kind, role]);
  const sel = RESOURCES.find((r) => r.id === params.get('res'));

  return (
    <div className="space-y-4">
      <Card title="Access policy tester" code="WHO_CAN_TOUCH_WHAT" icon={FlaskConical}>
        <PolicyTester key={sel?.id ?? 'x'} preset={sel} />
      </Card>

      <Card bodyClassName="!p-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[200px] flex-1 flex-col gap-1"><span className="label !text-[9.5px]">Search</span>
            <span className="relative"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input className="input !py-1.5 !pl-8 text-xs" placeholder="Resource, id, tool, owner" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search resources" /></span></label>
          <Select label="Sensitivity" className="w-36" value={sens} onChange={setSens} options={[{ value: 'all', label: 'All' }, ...(['public', 'internal', 'confidential', 'restricted'] as Sensitivity[]).map((s) => ({ value: s, label: s }))]} />
          <Select label="Type" className="w-36" value={kind} onChange={setKind} options={[{ value: 'all', label: 'All' }, { value: 'data', label: 'Data' }, { value: 'source', label: 'Untrusted source' }, { value: 'destination', label: 'Destination' }]} />
          <Select label="Approved role" className="w-36" value={role} onChange={setRole} options={[{ value: 'all', label: 'Any role' }, ...(Object.keys(ROLE_LABEL) as Role[]).map((r) => ({ value: r, label: ROLE_LABEL[r] }))]} />
        </div>
      </Card>

      <Card title="Resource inventory" code="CATALOGUE" icon={Database} bodyClassName="!p-0" right={<span className="font-mono text-[11px] text-muted">{rows.length} resources</span>}>
        {rows.length === 0 ? <Empty icon={Database} title="No resources match" /> : (
          <div className="overflow-x-auto"><table className="tbl w-full min-w-[980px] text-[13px]">
            <thead><tr><th>Resource</th><th>Associated tool</th><th>Sensitivity</th><th>Owner</th><th>Approved roles</th><th>Destination trust</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id} className="row cursor-pointer" onClick={() => setParams({ res: r.id })}>
                <td><div className="font-medium">{r.name}</div><div className="font-mono text-[11px] text-muted">{r.id}</div></td>
                <td><div className="flex flex-wrap gap-1">{r.tools.map((t) => <span key={t} className="rounded border border-line/10 bg-bg/50 px-1.5 py-0.5 font-mono text-[10.5px]">{t}</span>)}</div></td>
                <td><SensBadge s={r.sensitivity} /></td><td className="text-xs">{r.owner}</td>
                <td className="text-xs">{r.approvedRoles.length ? r.approvedRoles.map((x) => ROLE_LABEL[x]).join(', ') : <span className="text-danger">none (human approval only)</span>}</td>
                <td><Badge tone={TRUST_TONE[r.destinationTrust]}>{r.destinationTrust}</Badge></td>
              </tr>))}</tbody>
          </table></div>
        )}
      </Card>

      <Drawer open={!!sel} onClose={() => setParams({})} title={sel?.name ?? ''} subtitle={sel ? `RESOURCE ${sel.id}` : undefined} width="max-w-xl">
        {sel && (
          <div className="space-y-4">
            <p className="text-sm text-muted">{sel.note}</p>
            <div className="grid grid-cols-2 gap-3"><Meta k="sensitivity"><SensBadge s={sel.sensitivity} /></Meta><Meta k="type">{sel.kind}</Meta><Meta k="owner">{sel.owner}</Meta><Meta k="destination trust"><Badge tone={TRUST_TONE[sel.destinationTrust]}>{sel.destinationTrust}</Badge></Meta>{sel.endpoint && <Meta k="endpoint" mono>{sel.endpoint}</Meta>}</div>
            <div><div className="label mb-1.5">policies that guard it</div><ul className="space-y-1.5">{sel.policies.length ? sel.policies.map((p) => <li key={p} className="flex items-start gap-2 text-xs"><Badge tone="muted">{p}</Badge><span>{POLICIES[p]?.title}</span></li>) : <li className="text-xs text-muted">No dedicated policy; covered by role-contract allowlists.</li>}</ul></div>
            <PolicyTester key={sel.id} preset={sel} />
          </div>
        )}
      </Drawer>
    </div>
  );
}
