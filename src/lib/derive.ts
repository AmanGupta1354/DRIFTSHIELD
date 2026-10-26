import { BASE_KPI } from '../data/seed';
import type { Agent, Alert, SecEvent, ThreatCategory } from '../types';
import { isBlocking } from './riskScoring';

export function kpis(agents: Agent[], events: SecEvent[], alerts: Alert[]) {
  const live = events.filter((e) => e.run_key);
  return {
    totalAgents: agents.length,
    activeAgents: agents.filter((a) => a.state === 'active' || a.state === 'watched').length,
    monitored: BASE_KPI.monitored + live.length,
    suspicious: BASE_KPI.suspicious + live.filter((e) => e.decision.score >= 35).length,
    blocked: BASE_KPI.blocked + live.filter((e) => isBlocking(e.decision.action)).length,
    openAlerts: alerts.filter((a) => a.status === 'open').length,
  };
}

export function fleetRisk(agents: Agent[]) {
  const live = agents.filter((a) => a.state !== 'isolated');
  const risks = live.map((a) => a.risk).sort((a, b) => b - a);
  const mean = risks.reduce((s, r) => s + r, 0) / Math.max(1, risks.length);
  const top3 = risks.slice(0, 3).reduce((s, r) => s + r, 0) / Math.max(1, Math.min(3, risks.length));
  return Math.round(0.5 * mean + 0.5 * top3);
}

export type Range = '15m' | '1h' | '24h';
const RANGE: Record<Range, { span: number; buckets: number }> = {
  '15m': { span: 15 * 60_000, buckets: 15 },
  '1h': { span: 3_600_000, buckets: 12 },
  '24h': { span: 86_400_000, buckets: 24 },
};

/** Deterministic mock history (a smooth daily curve) plus the real simulated events for each bucket. */
export function activitySeries(events: SecEvent[], range: Range, now = Date.now()) {
  const { span, buckets } = RANGE[range];
  const size = span / buckets;
  const start = now - span;
  const rows = Array.from({ length: buckets }, (_, i) => {
    const t = start + (i + 1) * size;
    const hour = new Date(t).getHours() + new Date(t).getMinutes() / 60;
    const day = 0.55 + 0.45 * Math.sin(((hour - 6) / 24) * Math.PI * 2 - Math.PI / 2 + Math.PI);
    const scale = size / 60_000; // minutes per bucket
    const wob = 1 + 0.18 * Math.sin(i * 1.7) + 0.1 * Math.cos(i * 0.9);
    const base = Math.max(1, 0.9 * scale * (0.4 + day) * wob);
    return {
      t, label: new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      allowed: Math.round(base * 6.5), watched: Math.round(base * 0.55), blocked: Math.round(base * 0.12),
    };
  });
  for (const e of events) {
    if (!e.run_key || e.ts < start || e.ts > now + size) continue;
    const idx = Math.min(buckets - 1, Math.max(0, Math.floor((e.ts - start) / size)));
    const a = e.decision.action;
    if (isBlocking(a)) rows[idx].blocked += 1;
    else if (a === 'allow') rows[idx].allowed += 1;
    else rows[idx].watched += 1;
  }
  return rows;
}

export const THREAT_ORDER: ThreatCategory[] = ['role_violation', 'taint', 'behavioural_drift', 'unapproved_destination', 'unusual_sequence', 'delegation_anomaly'];
export function threatDistribution(alerts: Alert[]) {
  return THREAT_ORDER.map((c) => ({ category: c, count: alerts.filter((a) => a.category === c).length }));
}
