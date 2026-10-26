import { BadgeCheck, FilePlus2, FileLock2, GitCompare, History, Plus, RotateCcw, Rocket, Save, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge, SensBadge } from '../components/ui/Badges';
import { Button, Field, Segmented, Select } from '../components/ui/Controls';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/Overlays';
import { Meta } from '../components/ui/Misc';
import { ROLE_LABEL, activeBody } from '../data/contracts';
import { RESOURCES } from '../data/resources';
import { cn, fmtDateTime } from '../lib/utils';
import { useStore } from '../store/useStore';
import { useUi } from '../store/useUi';
import type { ContractBody, ContractStatus, ContractVersion, ForbiddenSequence, Role, Sensitivity } from '../types';

const KNOWN_TOOLS = Array.from(new Set([...RESOURCES.flatMap((r) => r.tools), 'http.post', 'email.send']));
const HOST_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;
const STATUS_TONE: Record<ContractStatus, 'ok' | 'warn' | 'neon' | 'muted' | 'holo'> = { active: 'ok', draft: 'warn', pending_approval: 'holo', approved: 'neon', superseded: 'muted' };
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

function TagInput({ values, onChange, placeholder, suggestions, validate, label }: { values: string[]; onChange: (v: string[]) => void; placeholder: string; suggestions?: string[]; validate?: (v: string) => string | null; label: string }) {
  const [txt, setTxt] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const add = () => {
    const v = txt.trim();
    if (!v) return;
    const e = validate?.(v) ?? (values.includes(v) ? 'Already added' : null);
    setErr(e);
    if (e) return;
    onChange([...values, v]);
    setTxt('');
  };
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-md border border-neon/30 bg-neon/10 py-0.5 pl-2 pr-1 font-mono text-[11px] text-neon">{v}
            <button aria-label={`Remove ${v}`} className="rounded p-0.5 hover:bg-neon/20" onClick={() => onChange(values.filter((x) => x !== v))}><X size={11} /></button></span>
        ))}
        {values.length === 0 && <span className="text-xs text-muted">none</span>}
      </div>
      <div className="mt-2 flex gap-2">
        <input className="input !py-1.5 font-mono text-xs" list={suggestions ? `dl-${label}` : undefined} value={txt} placeholder={placeholder} aria-label={label} onChange={(e) => { setTxt(e.target.value); setErr(null); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        {suggestions && <datalist id={`dl-${label}`}>{suggestions.map((s) => <option key={s} value={s} />)}</datalist>}
        <Button size="sm" icon={Plus} onClick={add}>Add</Button>
      </div>
      {err && <p className="mt-1 text-xs text-danger" role="alert">{err}</p>}
    </div>
  );
}

function diffList(a: string[], b: string[]) {
  return { added: b.filter((x) => !a.includes(x)), removed: a.filter((x) => !b.includes(x)) };
}
const seqKey = (s: ForbiddenSequence) => `${s.first} → ${s.then}`;

function Diff({ a, b }: { a: ContractVersion; b: ContractVersion }) {
  const rows: { label: string; added: string[]; removed: string[] }[] = [];
  rows.push({ label: 'Allowed tools', ...diffList(a.body.allowedTools, b.body.allowedTools) });
  rows.push({ label: 'Approved egress', ...diffList(a.body.approvedEgress, b.body.approvedEgress) });
  rows.push({ label: 'Approval requirements', ...diffList(a.body.approvalRequirements, b.body.approvalRequirements) });
  rows.push({ label: 'Forbidden sequences', ...diffList(a.body.forbiddenSequences.map(seqKey), b.body.forbiddenSequences.map(seqKey)) });
  const scalar: [string, string, string][] = [
    ['Sensitivity ceiling', a.body.maxSensitivity, b.body.maxSensitivity],
    ['Rate limit (calls/min)', String(a.body.rateLimit.callsPerMinute), String(b.body.rateLimit.callsPerMinute)],
    ['Sensitive calls / hour', String(a.body.rateLimit.sensitivePerHour), String(b.body.rateLimit.sensitivePerHour)],
  ];
  const changed = rows.some((r) => r.added.length || r.removed.length) || scalar.some(([, x, y]) => x !== y);
  return (
    <div className="space-y-2">
      {!changed && <p className="text-xs text-muted">These two versions are identical.</p>}
      {scalar.filter(([, x, y]) => x !== y).map(([l, x, y]) => (
        <div key={l} className="rounded-lg border border-line/10 bg-bg/40 p-2.5 text-xs"><div className="label">{l}</div><div className="mt-1 font-mono"><span className="text-danger line-through">{x}</span> <span className="text-muted">→</span> <span className="text-ok">{y}</span></div></div>
      ))}
      {rows.filter((r) => r.added.length || r.removed.length).map((r) => (
        <div key={r.label} className="rounded-lg border border-line/10 bg-bg/40 p-2.5 text-xs"><div className="label">{r.label}</div>
          <ul className="mt-1 space-y-0.5 font-mono">{r.removed.map((x) => <li key={'r' + x} className="text-danger">− {x}</li>)}{r.added.map((x) => <li key={'a' + x} className="text-ok">+ {x}</li>)}</ul></div>
      ))}
    </div>
  );
}

export default function RoleContracts() {
  const contracts = useStore((s) => s.contracts);
  const { saveDraft, simulateApproval, activateVersion, resetContract } = useStore.getState();
  const push = useUi((s) => s.push);
  const [role, setRole] = useState<Role>('procurement');
  const [tab, setTab] = useState<'view' | 'edit' | 'history'>('view');
  const contract = contracts.find((c) => c.role === role)!;
  const pending = contract.versions.find((v) => v.status === 'draft' || v.status === 'approved' || v.status === 'pending_approval');
  const active = contract.versions.find((v) => v.version === contract.activeVersion)!;
  const working = pending ?? active;

  const [form, setForm] = useState<ContractBody>(() => clone(working.body));
  const [notes, setNotes] = useState(pending?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmActivate, setConfirmActivate] = useState(false);
  const [cmpA, setCmpA] = useState(contract.versions[0].version);
  const [cmpB, setCmpB] = useState(contract.activeVersion);

  useEffect(() => {
    setForm(clone(working.body)); setNotes(pending?.notes ?? ''); setErrors({});
    setCmpA(contract.versions[0].version); setCmpB(contract.activeVersion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, contract.versions.length, contract.activeVersion, pending?.status]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (form.allowedTools.length === 0) e.tools = 'At least one allowed tool is required.';
    const cpm = form.rateLimit.callsPerMinute, sph = form.rateLimit.sensitivePerHour;
    if (!Number.isInteger(cpm) || cpm < 1 || cpm > 1000) e.cpm = 'Enter a whole number between 1 and 1000.';
    if (!Number.isInteger(sph) || sph < 0 || sph > 1000) e.sph = 'Enter a whole number between 0 and 1000.';
    if (!notes.trim()) e.notes = 'Describe the change (required for the version history).';
    form.forbiddenSequences.forEach((s, i) => { if (!s.first.trim() || !s.then.trim() || !s.reason.trim()) e[`seq${i}`] = 'Each forbidden sequence needs both tools and a reason.'; });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = () => { if (!validate()) { push({ title: 'Fix the highlighted fields', tone: 'warn' }); return; } saveDraft(role, form, notes.trim()); push({ title: 'Draft saved (simulated)', body: `${ROLE_LABEL[role]} contract`, tone: 'ok' }); };

  const versions = contract.versions;
  const vA = versions.find((v) => v.version === cmpA) ?? versions[0];
  const vB = versions.find((v) => v.version === cmpB) ?? versions[versions.length - 1];
  const body = activeBody(contract);
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(working.body) || notes !== (pending?.notes ?? ''), [form, working, notes, pending]);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-warn/30 bg-warn/[0.07] px-4 py-3 text-xs text-warn">
        <FileLock2 size={16} className="mt-0.5 shrink-0" />
        <p><b>Simulated registry.</b> Changes stay in this browser. Activated contracts apply to the next scenario run immediately.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <div className="space-y-2">
          {contracts.map((c) => {
            const a = c.versions.find((v) => v.version === c.activeVersion)!;
            const p = c.versions.find((v) => ['draft', 'approved', 'pending_approval'].includes(v.status));
            return (
              <button key={c.id} onClick={() => { setRole(c.role); setTab('view'); }} aria-pressed={c.role === role} className={cn('glass holo-edge w-full p-3.5 text-left transition-all', c.role === role && 'glow-neon')}>
                <div className="flex items-center justify-between"><span className="text-[13.5px] font-semibold">{ROLE_LABEL[c.role]}</span><Badge tone="ok" dot>v{a.version}</Badge></div>
                <div className="mt-1 font-mono text-[11px] text-muted">{c.id}</div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5"><SensBadge s={a.body.maxSensitivity} /><Badge>{a.body.allowedTools.length} tools</Badge>{p && <Badge tone={STATUS_TONE[p.status]}>{p.status.replace('_', ' ')} v{p.version}</Badge>}</div>
              </button>
            );
          })}
        </div>

        <Card title={contract.title} code={`ROLE_CONTRACT · ${contract.id}`} icon={FileLock2} right={<Segmented size="xs" value={tab} onChange={setTab} options={[{ value: 'view', label: 'Active' }, { value: 'edit', label: 'Edit' }, { value: 'history', label: 'History' }]} />}>
          {tab === 'view' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2"><Badge tone="ok" dot>active v{contract.activeVersion}</Badge><span className="font-mono text-[11px] text-muted">{active.author} · {fmtDateTime(active.date)}</span></div>
              <div><div className="label mb-1.5">allowed tools</div><div className="flex flex-wrap gap-1.5">{body.allowedTools.map((t) => <Badge key={t} tone="neon">{t}</Badge>)}</div></div>
              <div className="grid gap-4 sm:grid-cols-3"><Meta k="max resource sensitivity"><SensBadge s={body.maxSensitivity} /></Meta><Meta k="rate limit">{body.rateLimit.callsPerMinute} calls / min</Meta><Meta k="sensitive calls">{body.rateLimit.sensitivePerHour} / hour</Meta></div>
              <div><div className="label mb-1.5">approved egress destinations</div>{body.approvedEgress.length ? <div className="flex flex-wrap gap-1.5">{body.approvedEgress.map((t) => <Badge key={t} tone="holo">{t}</Badge>)}</div> : <p className="text-xs text-muted">None — any outbound call is a hard violation.</p>}</div>
              <div><div className="label mb-1.5">approval requirements</div>{body.approvalRequirements.length ? <ul className="list-disc space-y-1 pl-5 text-xs">{body.approvalRequirements.map((r) => <li key={r}>{r}</li>)}</ul> : <p className="text-xs text-muted">None.</p>}</div>
              <div><div className="label mb-1.5">forbidden action sequences</div>{body.forbiddenSequences.length ? <ul className="space-y-1.5">{body.forbiddenSequences.map((s) => <li key={seqKey(s)} className="rounded-lg border border-danger/25 bg-danger/5 px-3 py-2 text-xs"><span className="font-mono text-danger">{s.first} → {s.then}</span><span className="ml-2 text-muted">{s.reason}</span></li>)}</ul> : <p className="text-xs text-muted">None.</p>}</div>
              <p className="rounded-lg border border-line/10 bg-bg/40 px-3 py-2 text-xs text-muted">A hard violation (tool, ceiling, egress, sequence) blocks <b>regardless of the score</b>.</p>
            </div>
          )}

          {tab === 'edit' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">{pending ? <Badge tone={STATUS_TONE[pending.status]}>editing {pending.status} v{pending.version}</Badge> : <Badge tone="muted">new draft from active v{contract.activeVersion}</Badge>}{dirty && <Badge tone="warn">unsaved changes</Badge>}</div>
              <Field label="Allowed tools" error={errors.tools}><TagInput label="allowed-tools" values={form.allowedTools} onChange={(v) => setForm({ ...form, allowedTools: v })} placeholder="e.g. catalog.read" suggestions={KNOWN_TOOLS} /></Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Select label="Max resource sensitivity" value={form.maxSensitivity} onChange={(v) => setForm({ ...form, maxSensitivity: v as Sensitivity })} options={(['public', 'internal', 'confidential', 'restricted'] as Sensitivity[]).map((s) => ({ value: s, label: s }))} />
                <Field label="Calls per minute" error={errors.cpm}><input type="number" className="input" value={form.rateLimit.callsPerMinute} onChange={(e) => setForm({ ...form, rateLimit: { ...form.rateLimit, callsPerMinute: Number(e.target.value) } })} aria-label="Calls per minute" /></Field>
                <Field label="Sensitive calls per hour" error={errors.sph}><input type="number" className="input" value={form.rateLimit.sensitivePerHour} onChange={(e) => setForm({ ...form, rateLimit: { ...form.rateLimit, sensitivePerHour: Number(e.target.value) } })} aria-label="Sensitive calls per hour" /></Field>
              </div>
              <Field label="Approved egress destinations" hint="Hostnames only, e.g. api.approved-suppliers.example"><TagInput label="egress" values={form.approvedEgress} onChange={(v) => setForm({ ...form, approvedEgress: v })} placeholder="host.example" validate={(v) => (HOST_RE.test(v) ? (form.approvedEgress.includes(v) ? 'Already added' : null) : 'Enter a valid hostname')} /></Field>
              <Field label="Approval requirements (one per line)"><textarea className="input min-h-[84px] text-xs" value={form.approvalRequirements.join('\n')} onChange={(e) => setForm({ ...form, approvalRequirements: e.target.value.split('\n').filter((l) => l.trim()) })} aria-label="Approval requirements" /></Field>
              <Field label="Forbidden action sequences">
                <div className="space-y-2">
                  {form.forbiddenSequences.map((s, i) => (
                    <div key={i} className={cn('grid gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_1fr_1.4fr_auto]', errors[`seq${i}`] ? 'border-danger/50' : 'border-line/10')}>
                      {(['first', 'then', 'reason'] as const).map((k) => <input key={k} className="input !py-1.5 text-xs" placeholder={k === 'first' ? 'first tool' : k === 'then' ? 'then tool' : 'reason'} aria-label={`sequence ${i + 1} ${k}`} value={s[k]} onChange={(e) => setForm({ ...form, forbiddenSequences: form.forbiddenSequences.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)) })} />)}
                      <Button size="sm" variant="ghost" icon={Trash2} aria-label="Remove sequence" onClick={() => setForm({ ...form, forbiddenSequences: form.forbiddenSequences.filter((_, j) => j !== i) })} />
                      {errors[`seq${i}`] && <p className="text-xs text-danger sm:col-span-4" role="alert">{errors[`seq${i}`]}</p>}
                    </div>
                  ))}
                  <Button size="sm" icon={Plus} onClick={() => setForm({ ...form, forbiddenSequences: [...form.forbiddenSequences, { first: '', then: '', reason: '' }] })}>Add sequence</Button>
                </div>
              </Field>
              <Field label="Change notes (required)" error={errors.notes}><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What changed and why?" aria-label="Change notes" /></Field>
              <div className="flex flex-wrap items-center gap-2 border-t border-line/[0.07] pt-4">
                <Button variant="neon" icon={Save} onClick={save}>Save draft</Button>
                <Button icon={BadgeCheck} disabled={!pending || pending.status !== 'draft' || dirty} onClick={() => { simulateApproval(role, pending!.version); push({ title: 'Approval simulated', body: `v${pending!.version} approved by sim-approver`, tone: 'ok' }); }}>Simulate approval</Button>
                <Button variant="primary" icon={Rocket} disabled={!pending || pending.status !== 'approved' || dirty} onClick={() => setConfirmActivate(true)}>Activate contract</Button>
                <Button variant="ghost" icon={RotateCcw} className="ml-auto" onClick={() => setConfirmReset(true)}>Reset to original</Button>
              </div>
              <p className="text-[11px] text-muted">Flow: save draft → simulate approval → activate. Activation requires a saved, approved draft.</p>
            </div>
          )}

          {tab === 'history' && (
            <div className="space-y-5">
              <div><div className="label mb-2 flex items-center gap-1.5"><History size={12} /> version history</div>
                <ol className="space-y-2 border-l border-line/15 pl-4">{[...versions].reverse().map((v) => (
                  <li key={v.version} className="relative text-xs"><span className={cn('absolute -left-[21px] top-1 h-2 w-2 rounded-full', v.status === 'active' ? 'bg-ok' : 'bg-muted/60')} />
                    <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[13px] font-semibold">v{v.version}</span><Badge tone={STATUS_TONE[v.status]}>{v.status.replace('_', ' ')}</Badge><span className="font-mono text-[11px] text-muted">{v.author} · {fmtDateTime(v.date)}</span></div>
                    <p className="mt-0.5 text-muted">{v.notes}</p></li>))}</ol></div>
              <div><div className="label mb-2 flex items-center gap-1.5"><GitCompare size={12} /> compare versions</div>
                <div className="mb-3 grid gap-3 sm:grid-cols-2"><Select label="From" value={vA.version} onChange={setCmpA} options={versions.map((v) => ({ value: v.version, label: `v${v.version} (${v.status})` }))} /><Select label="To" value={vB.version} onChange={setCmpB} options={versions.map((v) => ({ value: v.version, label: `v${v.version} (${v.status})` }))} /></div>
                <Diff a={vA} b={vB} /></div>
              {versions.length === 1 && <p className="flex items-center gap-2 text-xs text-muted"><FilePlus2 size={13} /> Only one version exists.</p>}
            </div>
          )}
        </Card>
      </div>

      <ConfirmDialog open={confirmActivate} onClose={() => setConfirmActivate(false)} title="Activate this contract version?" confirmLabel="Activate" onConfirm={() => { activateVersion(role, pending!.version); push({ title: `${ROLE_LABEL[role]} contract v${pending!.version} active`, body: 'Simulated — used by the engine immediately', tone: 'ok' }); setTab('view'); }}>
        <p>The approved draft v{pending?.version} replaces v{contract.activeVersion} as the enforced {ROLE_LABEL[role]} contract. Future simulated tool calls are evaluated against it.</p>
      </ConfirmDialog>
      <ConfirmDialog open={confirmReset} onClose={() => setConfirmReset(false)} tone="danger" title="Reset to the original demo contract?" confirmLabel="Reset contract" onConfirm={() => { resetContract(role); push({ title: `${ROLE_LABEL[role]} contract reset`, tone: 'ok' }); }}>
        <p>Drafts and all versions you created for {ROLE_LABEL[role]} are discarded and the original demo history is restored.</p>
      </ConfirmDialog>
    </div>
  );
}
