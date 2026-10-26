import type { AgentState, EnforcementAction, Severity, Sensitivity } from '../types';

export const cn = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');

export function fmtTime(ts: number, withSeconds = true) {
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', ...(withSeconds ? { second: '2-digit' } : {}) });
}
export function fmtDateTime(ts: number) {
  return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
export function ago(ts: number, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export const SEVERITY_ORDER: Severity[] = ['informational', 'low', 'medium', 'high', 'critical'];
export const sevRank = (s: Severity) => SEVERITY_ORDER.indexOf(s);

/** Tailwind classes per semantic tone. */
export const TONE = {
  ok: { text: 'text-ok', bg: 'bg-ok/10', border: 'border-ok/30', dot: 'bg-ok' },
  warn: { text: 'text-warn', bg: 'bg-warn/10', border: 'border-warn/30', dot: 'bg-warn' },
  danger: { text: 'text-danger', bg: 'bg-danger/10', border: 'border-danger/30', dot: 'bg-danger' },
  neon: { text: 'text-neon', bg: 'bg-neon/10', border: 'border-neon/30', dot: 'bg-neon' },
  holo: { text: 'text-holo', bg: 'bg-holo/10', border: 'border-holo/30', dot: 'bg-holo' },
  muted: { text: 'text-muted', bg: 'bg-fg/5', border: 'border-line/15', dot: 'bg-muted' },
  brand: { text: 'text-brand', bg: 'bg-brand/10', border: 'border-brand/30', dot: 'bg-brand' },
} as const;
export type ToneKey = keyof typeof TONE;

export const severityTone = (s: Severity): ToneKey =>
  ({ informational: 'muted', low: 'neon', medium: 'warn', high: 'brand', critical: 'danger' } as const)[s];
export const actionTone = (a: EnforcementAction): ToneKey =>
  ({ allow: 'ok', watch: 'neon', step_up: 'warn', block: 'danger', block_quarantine: 'danger' } as const)[a];
export const sensitivityTone = (s: Sensitivity): ToneKey =>
  ({ public: 'ok', internal: 'neon', confidential: 'warn', restricted: 'danger' } as const)[s];
export const stateTone = (s: AgentState): ToneKey =>
  ({ active: 'ok', watched: 'warn', paused: 'muted', quarantined: 'danger', isolated: 'brand' } as const)[s];
export const scoreTone = (score: number): ToneKey => (score >= 75 ? 'danger' : score >= 55 ? 'brand' : score >= 35 ? 'warn' : score >= 20 ? 'neon' : 'ok');

export const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}
