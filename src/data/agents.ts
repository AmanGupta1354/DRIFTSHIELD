import type { Agent, Role } from '../types';

const MIN = 60_000;
const HOUR = 3_600_000;
const D = 86_400_000;

interface Seed {
  id: string; name: string; role: Role; owner: string; state: Agent['state']; tier: 1 | 2 | 3; risk: number;
  seenMin: number; sessions: number; cpm: number; share: Record<string, number>; sensGolden: number; sensRolling: number; js: number;
  lastSuspicious?: string;
}

const SEEDS: Seed[] = [
  { id: 'agt_procure_01', name: 'Procurement Agent', role: 'procurement', owner: 'Meera Kulkarni · Supply Chain Ops', state: 'active', tier: 2, risk: 9, seenMin: 1, sessions: 312, cpm: 11, share: { 'catalog.search': 0.42, 'catalog.read': 0.27, 'pricing.compare': 0.21, 'purchase_request.create': 0.1 }, sensGolden: 0.02, sensRolling: 0.03, js: 0.04 },
  { id: 'agt_procure_02', name: 'Procurement Agent · EU', role: 'procurement', owner: 'Lars Whitfield · EU Sourcing', state: 'active', tier: 2, risk: 14, seenMin: 3, sessions: 188, cpm: 9, share: { 'catalog.search': 0.4, 'catalog.read': 0.3, 'pricing.compare': 0.2, 'purchase_request.create': 0.1 }, sensGolden: 0.02, sensRolling: 0.04, js: 0.06 },
  { id: 'agt_procure_03', name: 'Legacy Quote Agent', role: 'procurement', owner: 'Meera Kulkarni · Supply Chain Ops', state: 'isolated', tier: 1, risk: 88, seenMin: 60 * 30, sessions: 94, cpm: 4, share: { 'catalog.search': 0.5, 'catalog.read': 0.4, 'purchase_request.create': 0.1 }, sensGolden: 0.01, sensRolling: 0.19, js: 0.41, lastSuspicious: 'Token reused from unknown client; gateway token revoked' },
  { id: 'agt_research_01', name: 'Research Agent', role: 'research', owner: 'Kavya Nair · Strategy', state: 'active', tier: 1, risk: 17, seenMin: 2, sessions: 401, cpm: 18, share: { 'web.search': 0.46, 'web.read': 0.41, 'documents.read': 0.13 }, sensGolden: 0.01, sensRolling: 0.02, js: 0.05 },
  { id: 'agt_research_02', name: 'Market Intel Agent', role: 'research', owner: 'Kavya Nair · Strategy', state: 'active', tier: 1, risk: 11, seenMin: 8, sessions: 246, cpm: 14, share: { 'web.search': 0.5, 'web.read': 0.38, 'documents.read': 0.12 }, sensGolden: 0.01, sensRolling: 0.02, js: 0.03 },
  { id: 'agt_research_03', name: 'Web Crawler Agent', role: 'research', owner: 'Security Engineering', state: 'quarantined', tier: 1, risk: 78, seenMin: 60 * 9, sessions: 57, cpm: 31, share: { 'web.search': 0.31, 'web.read': 0.62, 'documents.read': 0.07 }, sensGolden: 0.01, sensRolling: 0.12, js: 0.33, lastSuspicious: 'Crawl burst 6.1σ above baseline; 14 untrusted pages ingested' },
  { id: 'agt_orchestrator_01', name: 'Orchestrator Agent', role: 'orchestrator', owner: 'Platform Engineering', state: 'active', tier: 3, risk: 15, seenMin: 1, sessions: 522, cpm: 22, share: { 'agent.delegate': 0.34, 'workflow.read': 0.38, 'task.status': 0.28 }, sensGolden: 0, sensRolling: 0.01, js: 0.05 },
  { id: 'agt_orchestrator_02', name: 'Workflow Router', role: 'orchestrator', owner: 'Platform Engineering', state: 'active', tier: 3, risk: 7, seenMin: 5, sessions: 301, cpm: 17, share: { 'agent.delegate': 0.3, 'workflow.read': 0.4, 'task.status': 0.3 }, sensGolden: 0, sensRolling: 0.01, js: 0.03 },
  { id: 'agt_hr_01', name: 'HR Agent', role: 'hr', owner: 'Anita Rao · HR Director', state: 'active', tier: 3, risk: 12, seenMin: 4, sessions: 268, cpm: 6, share: { 'hr.records.read': 0.72, 'hr.reports.generate': 0.28 }, sensGolden: 0.31, sensRolling: 0.33, js: 0.05 },
  { id: 'agt_hr_02', name: 'Onboarding Assistant (HR)', role: 'hr', owner: 'Anita Rao · HR Director', state: 'watched', tier: 2, risk: 43, seenMin: 12, sessions: 73, cpm: 8, share: { 'hr.records.read': 0.81, 'hr.reports.generate': 0.19 }, sensGolden: 0.22, sensRolling: 0.37, js: 0.19, lastSuspicious: 'Sensitive-read share trending above golden baseline (CUSUM 3.4)' },
  { id: 'agt_finance_01', name: 'Finance Agent', role: 'finance', owner: 'Rohan Shah · CFO Office', state: 'active', tier: 3, risk: 10, seenMin: 2, sessions: 344, cpm: 7, share: { 'finance.read': 0.45, 'invoice.validate': 0.4, 'report.generate': 0.15 }, sensGolden: 0.4, sensRolling: 0.41, js: 0.04 },
  { id: 'agt_finance_02', name: 'Invoice Validator', role: 'finance', owner: 'Accounts Payable', state: 'paused', tier: 2, risk: 36, seenMin: 60 * 5, sessions: 150, cpm: 10, share: { 'invoice.validate': 0.85, 'finance.read': 0.1, 'report.generate': 0.05 }, sensGolden: 0.35, sensRolling: 0.38, js: 0.1, lastSuspicious: 'Paused by owner during invoice-batch audit' },
];

export function buildAgents(): Agent[] {
  const now = Date.now();
  return SEEDS.map((s) => ({
    id: s.id, name: s.name, role: s.role, owner: s.owner, state: s.state, trustTier: s.tier, risk: s.risk,
    lastSeen: now - s.seenMin * MIN, lastSuspicious: s.lastSuspicious,
    baseline: {
      sessions: s.sessions, goldenVersion: `golden-${s.role}-v3`, callsPerMinute: s.cpm, toolShare: s.share,
      sensitiveShareGolden: s.sensGolden, sensitiveShareRolling: s.sensRolling, jsDivergence: s.js,
    },
    containment:
      s.state === 'active'
        ? []
        : [{
            id: `cn_${s.id}_seed`, ts: now - (s.state === 'isolated' ? 30 * HOUR : s.state === 'paused' ? 5 * HOUR : 9 * HOUR),
            from: 'active', to: s.state, by: s.state === 'paused' ? 'a.rao (owner)' : 'driftshield-policy',
            note: s.lastSuspicious ?? 'Containment applied by policy',
          }],
  }));
}

export const AGENT_NAME = Object.fromEntries(SEEDS.map((s) => [s.id, s.name]));
export const D_MS = D;
