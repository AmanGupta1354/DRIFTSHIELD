import { Bell, Gauge, Monitor, RotateCcw, Settings2, ShieldAlert, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '../components/ui/Badges';
import { Button, Segmented, Toggle } from '../components/ui/Controls';
import { Card } from '../components/ui/Card';
import { ConfirmDialog } from '../components/ui/Overlays';
import { stopAndClearAll } from '../lib/simRunner';
import { DEFAULT_THRESHOLDS } from '../lib/riskScoring';
import { useStore } from '../store/useStore';
import { useUi } from '../store/useUi';
import type { Thresholds } from '../types';

const BANDS = (t: Thresholds) => [
  { range: `0–${t.allow - 1}`, label: 'Allow', tone: 'ok', note: 'Forward and log' },
  { range: `${t.allow}–${t.watch - 1}`, label: 'Watch', tone: 'neon', note: 'Allow with lower thresholds and full argument capture' },
  { range: `${t.watch}–${t.stepUp - 1}`, label: 'Step-up approval', tone: 'warn', note: 'Hold the call for human approval' },
  { range: `${t.stepUp}–${t.block - 1}`, label: 'Block operation', tone: 'brand', note: 'Do not forward; block the operation, not the agent' },
  { range: `${t.block}–100`, label: 'Pause agent / quarantine', tone: 'danger', note: 'Block, quarantine sensitive scopes or pause per policy' },
] as const;

const BAND_BG: Record<string, string> = { ok: 'bg-ok', neon: 'bg-neon', warn: 'bg-warn', brand: 'bg-brand', danger: 'bg-danger' };

const SLIDERS: { key: keyof Thresholds; label: string; min: number; max: number }[] = [
  { key: 'allow', label: 'Watch starts at', min: 5, max: 70 },
  { key: 'watch', label: 'Step-up starts at', min: 10, max: 85 },
  { key: 'stepUp', label: 'Block starts at', min: 15, max: 95 },
  { key: 'block', label: 'Pause / quarantine starts at', min: 20, max: 99 },
];

export default function Settings() {
  const prefs = useStore((s) => s.prefs);
  const setPrefs = useStore((s) => s.setPrefs);
  const resetData = useStore((s) => s.resetData);
  const resetPrefs = useStore((s) => s.resetPrefs);
  const push = useUi((s) => s.push);
  const [confirm, setConfirm] = useState<'data' | 'prefs' | null>(null);
  const t = prefs.thresholds;

  const setThreshold = (key: keyof Thresholds, v: number) => {
    const order: (keyof Thresholds)[] = ['allow', 'watch', 'stepUp', 'block'];
    const next = { ...t, [key]: v };
    const i = order.indexOf(key);
    for (let j = i + 1; j < order.length; j++) if (next[order[j]] <= next[order[j - 1]]) next[order[j]] = next[order[j - 1]] + 1;
    for (let j = i - 1; j >= 0; j--) if (next[order[j]] >= next[order[j + 1]]) next[order[j]] = next[order[j + 1]] - 1;
    if (next.block > 99) return;
    setPrefs({ thresholds: next });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
      <Card title="Appearance & motion" code="DISPLAY" icon={Monitor}>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3"><div><div className="text-[13px] font-medium">Theme</div><div className="text-xs text-muted">Dark glass is the default.</div></div>
            <Segmented value={prefs.theme} onChange={(v) => setPrefs({ theme: v })} options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]} /></div>
          <div className="flex items-center justify-between gap-3"><div><div className="text-[13px] font-medium">Animations</div><div className="text-xs text-muted">Reduced removes transitions and motion.</div></div>
            <Segmented value={prefs.animations} onChange={(v) => setPrefs({ animations: v })} options={[{ value: 'full', label: 'Full' }, { value: 'reduced', label: 'Reduced' }]} /></div>
          <div className="border-t border-line/[0.07] pt-2">
            <Toggle label="Compact tables" description="Tighter row spacing in data tables." checked={prefs.display.compactTables} onChange={(v) => setPrefs({ display: { ...prefs.display, compactTables: v } })} />
            <Toggle label="Show simulation banner" description="Reminder that all data is simulated." checked={prefs.display.showSimBanner} onChange={(v) => setPrefs({ display: { ...prefs.display, showSimBanner: v } })} />
            <Toggle label="Show lane hints" description="Show the Role / Reason / Routine question on evidence cards." checked={prefs.display.showLaneHints} onChange={(v) => setPrefs({ display: { ...prefs.display, showLaneHints: v } })} />
          </div>
        </div>
      </Card>

      <Card title="Demo playback" code="SIMULATION" icon={Sparkles}>
        <div className="space-y-3">
          <Toggle label="Auto-play demo" description="Off: scenarios advance only when you press “Next step”." checked={prefs.autoPlay} onChange={(v) => setPrefs({ autoPlay: v })} />
          <div className="flex items-center justify-between gap-3"><div><div className="text-[13px] font-medium">Simulation speed</div><div className="text-xs text-muted">Scales stage and step delays.</div></div>
            <Segmented value={prefs.speed} onChange={(v) => setPrefs({ speed: v })} options={[{ value: 0.5, label: '0.5×' }, { value: 1, label: '1×' }, { value: 2, label: '2×' }]} /></div>
          <Toggle label="Automatic containment" description="Apply the containment ladder (watch, quarantine) to agents when a scenario blocks an operation." checked={prefs.autoContain} onChange={(v) => setPrefs({ autoContain: v })} />
        </div>
      </Card>

      <Card title="Alert notifications" code="NOTIFY" icon={Bell}>
        <Toggle label="Critical alerts" checked={prefs.notify.critical} onChange={(v) => setPrefs({ notify: { ...prefs.notify, critical: v } })} />
        <Toggle label="High alerts" checked={prefs.notify.high} onChange={(v) => setPrefs({ notify: { ...prefs.notify, high: v } })} />
        <Toggle label="Medium alerts" checked={prefs.notify.medium} onChange={(v) => setPrefs({ notify: { ...prefs.notify, medium: v } })} />
        <Toggle label="Pop-up toasts" description="Show a toast when an alert is raised." checked={prefs.notify.toasts} onChange={(v) => setPrefs({ notify: { ...prefs.notify, toasts: v } })} />
      </Card>

      <Card title="Reset" code="DATA" icon={RotateCcw}>
        <p className="text-xs text-muted">Preferences are stored in this browser’s localStorage. No credentials or secrets are ever stored.</p>
        <div className="mt-3 flex flex-wrap gap-2"><Button variant="danger" icon={RotateCcw} onClick={() => setConfirm('data')}>Reset demo data</Button><Button icon={Settings2} onClick={() => setConfirm('prefs')}>Reset preferences</Button></div>
      </Card>

      <Card className="lg:col-span-2" title="Risk thresholds" code="POLICY_BANDS" icon={Gauge} right={<Button size="xs" variant="ghost" onClick={() => setPrefs({ thresholds: DEFAULT_THRESHOLDS })}>Restore defaults</Button>}>
        <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
          <div className="space-y-4">
            {SLIDERS.map((s) => (
              <label key={s.key} className="block">
                <div className="mb-1 flex items-center justify-between text-xs"><span>{s.label}</span><span className="font-mono text-neon">{t[s.key]}</span></div>
                <input type="range" min={s.min} max={s.max} value={t[s.key]} onChange={(e) => setThreshold(s.key, Number(e.target.value))} className="w-full accent-[rgb(var(--neon))]" aria-label={s.label} />
              </label>
            ))}
            <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/[0.07] p-3 text-xs text-danger"><ShieldAlert size={15} className="mt-0.5 shrink-0" /><p><b>Hard-violation exception.</b> A deterministic role-contract violation (tool, sensitivity ceiling, egress allowlist or forbidden sequence) blocks the operation <b>regardless of these thresholds</b>; its score is floored at 90. Statistical signals alone can never override it.</p></div>
          </div>
          <div>
            <div className="mb-2 flex h-3 overflow-hidden rounded-full">
              {BANDS(t).map((b, i) => <div key={i} style={{ flex: i === 4 ? 100 - t.block : i === 0 ? t.allow : [0, t.watch - t.allow, t.stepUp - t.watch, t.block - t.stepUp][i] }} className={BAND_BG[b.tone]} />)}
            </div>
            <ul className="space-y-1.5">
              {BANDS(t).map((b) => (
                <li key={b.label} className="flex items-center gap-3 rounded-lg border border-line/[0.08] bg-bg/40 px-3 py-2 text-xs">
                  <span className="w-16 shrink-0 font-mono">{b.range}</span><Badge tone={b.tone as 'ok'}>{b.label}</Badge><span className="min-w-0 truncate text-muted">{b.note}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex items-center gap-2 text-[11px] text-muted"><SlidersHorizontal size={12} />Demonstration configuration — not validated production defaults. Changes apply to events scored from now on.</p>
          </div>
        </div>
      </Card>

      <ConfirmDialog open={confirm === 'data'} onClose={() => setConfirm(null)} tone="danger" title="Reset demo data?" confirmLabel="Reset demo data" onConfirm={() => { stopAndClearAll(); resetData(); push({ title: 'Demo data reset', tone: 'ok' }); }}>
        <p>Agents, alerts, events, role contracts and counters return to the original seed state. Preferences are kept.</p>
      </ConfirmDialog>
      <ConfirmDialog open={confirm === 'prefs'} onClose={() => setConfirm(null)} title="Reset preferences?" confirmLabel="Reset preferences" onConfirm={() => { resetPrefs(); push({ title: 'Preferences reset', tone: 'ok' }); }}>
        <p>Theme, animation, playback, notification and threshold settings return to defaults.</p>
      </ConfirmDialog>
    </div>
  );
}
