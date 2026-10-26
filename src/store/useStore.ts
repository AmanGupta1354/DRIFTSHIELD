import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { buildContracts } from '../data/contracts';
import { buildSeed } from '../data/seed';
import { DEFAULT_THRESHOLDS } from '../lib/riskScoring';
import { STORE_KEY, safeJSONStorage } from '../lib/storage';
import { agentRiskAfter } from '../lib/simulationEngine';
import type {
  Agent, AgentState, Alert, AlertStatus, ContractBody, Notification, Prefs, Role, RoleContract, SecEvent, Severity,
} from '../types';

export const DEFAULT_PREFS: Prefs = {
  theme: 'dark',
  animations: 'full',
  autoPlay: true,
  speed: 1,
  notify: { critical: true, high: true, medium: false, toasts: true },
  thresholds: DEFAULT_THRESHOLDS,
  display: { compactTables: false, showSimBanner: true, showLaneHints: true },
  autoContain: true,
};

export type AgentAction = 'activate' | 'pause' | 'quarantine' | 'isolate' | 'restore';
const STATE_RANK: Record<AgentState, number> = { active: 0, watched: 1, paused: 2, quarantined: 3, isolated: 4 };

interface RunPrior { agentId: string; state: AgentState; risk: number; lastSuspicious?: string }

interface Data {
  agents: Agent[];
  contracts: RoleContract[];
  events: SecEvent[];
  alerts: Alert[];
  notifications: Notification[];
  runPrior: Record<string, RunPrior[]>;
}

interface Actions {
  setPrefs: (p: Partial<Prefs>) => void;
  setThemeMode: (t: Prefs['theme']) => void;
  resetPrefs: () => void;
  resetData: () => void;
  commitEvent: (e: SecEvent) => void;
  clearRun: (runKey: string) => void;
  containFromRun: (runKey: string, agentId: string, to: AgentState, note: string, score: number) => void;
  addAlert: (a: Alert) => void;
  setAlertStatus: (id: string, status: AlertStatus) => void;
  agentAction: (agentId: string, action: AgentAction, by?: string) => void;
  markNotificationsRead: () => void;
  saveDraft: (role: Role, body: ContractBody, notes: string) => void;
  simulateApproval: (role: Role, version: string) => void;
  activateVersion: (role: Role, version: string) => void;
  resetContract: (role: Role) => void;
}

export type AppState = Data & { prefs: Prefs } & Actions;

const freshData = (t = DEFAULT_THRESHOLDS): Data => {
  const s = buildSeed(t);
  return { agents: s.agents, contracts: s.contracts, events: s.events, alerts: s.alerts, notifications: [], runPrior: {} };
};

const bump = (versions: string[]) => {
  const top = versions.map((v) => v.split('.').map(Number)).sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]).pop() ?? [1, 0, 0];
  return `${top[0]}.${top[1] + 1}.0`;
};

const sevNotify = (s: Severity, n: Prefs['notify']) => (s === 'critical' ? n.critical : s === 'high' ? n.high : s === 'medium' ? n.medium : false);

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      prefs: DEFAULT_PREFS,
      ...freshData(),

      setPrefs: (p) => set((s) => ({ prefs: { ...s.prefs, ...p } })),
      setThemeMode: (theme) => set((s) => ({ prefs: { ...s.prefs, theme } })),
      resetPrefs: () => set({ prefs: DEFAULT_PREFS }),
      resetData: () => set(freshData(get().prefs.thresholds)),

      commitEvent: (e) =>
        set((s) => ({
          events: [...s.events, e],
          agents: s.agents.map((a) =>
            a.id !== e.agent_id
              ? a
              : {
                  ...a, lastSeen: e.ts, risk: agentRiskAfter(a.risk, e.decision.score),
                  lastSuspicious: e.decision.score >= 35 ? `${e.tool} on ${e.resource} (score ${e.decision.score})` : a.lastSuspicious,
                },
          ),
        })),

      clearRun: (runKey) =>
        set((s) => {
          const prior = s.runPrior[runKey] ?? [];
          const { [runKey]: _drop, ...rest } = s.runPrior;
          void _drop;
          return {
            events: s.events.filter((e) => e.run_key !== runKey),
            alerts: s.alerts.filter((a) => a.run_key !== runKey),
            notifications: s.notifications.filter((n) => !n.alertId || s.alerts.find((a) => a.id === n.alertId)?.run_key !== runKey),
            agents: s.agents.map((a) => {
              const p = prior.find((x) => x.agentId === a.id);
              const touched = a.containment.some((c) => c.run_key === runKey);
              if (!p && !touched) return a;
              return {
                ...a, state: p ? p.state : a.state, risk: p ? p.risk : a.risk, lastSuspicious: p ? p.lastSuspicious : a.lastSuspicious,
                containment: a.containment.filter((c) => c.run_key !== runKey),
              };
            }),
            runPrior: rest,
          };
        }),

      containFromRun: (runKey, agentId, to, note, score) =>
        set((s) => {
          const a = s.agents.find((x) => x.id === agentId);
          if (!a) return {};
          const priors = s.runPrior[runKey] ?? [];
          const nextPriors = priors.some((p) => p.agentId === agentId)
            ? priors
            : [...priors, { agentId, state: a.state, risk: a.risk, lastSuspicious: a.lastSuspicious }];
          if (STATE_RANK[to] <= STATE_RANK[a.state]) return { runPrior: { ...s.runPrior, [runKey]: nextPriors } };
          return {
            runPrior: { ...s.runPrior, [runKey]: nextPriors },
            agents: s.agents.map((x) =>
              x.id !== agentId ? x : {
                ...x, state: to, risk: Math.max(x.risk, score),
                containment: [...x.containment, { id: `cn_${agentId}_${runKey}_${Date.now()}`, ts: Date.now(), from: a.state, to, by: 'driftshield-policy (simulated)', note, run_key: runKey }],
              },
            ),
          };
        }),

      addAlert: (a) =>
        set((s) => {
          const n: Notification[] = sevNotify(a.severity, s.prefs.notify)
            ? [{ id: `ntf_${a.id}`, ts: a.ts, title: a.title, body: a.summary, severity: a.severity, alertId: a.id, read: false }, ...s.notifications].slice(0, 30)
            : s.notifications;
          return { alerts: [a, ...s.alerts.filter((x) => x.id !== a.id)], notifications: n };
        }),

      setAlertStatus: (id, status) => set((s) => ({ alerts: s.alerts.map((a) => (a.id === id ? { ...a, status } : a)) })),

      agentAction: (agentId, action, by = 'a.security-analyst') =>
        set((s) => ({
          agents: s.agents.map((a) => {
            if (a.id !== agentId) return a;
            const to: AgentState =
              action === 'activate' ? 'active' : action === 'pause' ? 'paused' : action === 'quarantine' ? 'quarantined'
              : action === 'isolate' ? 'isolated' : 'watched';
            const note =
              action === 'restore' ? 'Restored after evidence review; returns in WATCHED state for a cool-down period (simulated)'
              : action === 'activate' ? 'Activated by analyst (simulated)'
              : action === 'isolate' ? 'Gateway token revoked — all calls fail until restored (simulated)'
              : action === 'quarantine' ? 'Sensitive scopes quarantined; low-sensitivity read-only tools remain (simulated)'
              : 'Paused by analyst (simulated)';
            return {
              ...a, state: to, risk: action === 'restore' ? Math.min(a.risk, 30) : a.risk,
              containment: [...a.containment, { id: `cn_${a.id}_${Date.now()}`, ts: Date.now(), from: a.state, to, by, note }],
            };
          }),
        })),

      markNotificationsRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),

      saveDraft: (role, body, notes) =>
        set((s) => ({
          contracts: s.contracts.map((c) => {
            if (c.role !== role) return c;
            const pending = c.versions.find((v) => v.status === 'draft' || v.status === 'approved' || v.status === 'pending_approval');
            if (pending) {
              return { ...c, versions: c.versions.map((v) => (v === pending ? { ...v, body, notes, status: 'draft' as const, date: Date.now() } : v)) };
            }
            const version = bump(c.versions.map((v) => v.version));
            return { ...c, versions: [...c.versions, { version, status: 'draft' as const, date: Date.now(), author: 'a.security-analyst', notes, body }] };
          }),
        })),

      simulateApproval: (role, version) =>
        set((s) => ({
          contracts: s.contracts.map((c) =>
            c.role !== role ? c : { ...c, versions: c.versions.map((v) => (v.version === version && v.status === 'draft' ? { ...v, status: 'approved' as const } : v)) },
          ),
        })),

      activateVersion: (role, version) =>
        set((s) => ({
          contracts: s.contracts.map((c) =>
            c.role !== role ? c : {
              ...c, activeVersion: version,
              versions: c.versions.map((v) =>
                v.version === version ? { ...v, status: 'active' as const } : v.status === 'active' ? { ...v, status: 'superseded' as const } : v),
            },
          ),
        })),

      resetContract: (role) => set((s) => ({ contracts: s.contracts.map((c) => (c.role === role ? buildContracts().find((x) => x.role === role)! : c)) })),
    }),
    {
      name: STORE_KEY,
      version: 1,
      storage: safeJSONStorage,
      partialize: (s) => ({
        prefs: s.prefs, agents: s.agents, contracts: s.contracts, events: s.events, alerts: s.alerts,
        notifications: s.notifications, runPrior: s.runPrior,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<AppState> | undefined;
        if (!p || !p.agents || !p.events) return current;
        return { ...current, ...p, prefs: { ...DEFAULT_PREFS, ...(p.prefs ?? {}), notify: { ...DEFAULT_PREFS.notify, ...(p.prefs?.notify ?? {}) }, display: { ...DEFAULT_PREFS.display, ...(p.prefs?.display ?? {}) }, thresholds: { ...DEFAULT_THRESHOLDS, ...(p.prefs?.thresholds ?? {}) } } };
      },
    },
  ),
);
