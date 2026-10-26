import type { Agent, Alert, AlertStatus, RoleContract, SecEvent, Sensitivity, TaintTag, ThreatCategory, Thresholds } from '../types';
import { buildAgents } from './agents';
import { buildContracts } from './contracts';
import { RESOURCE_BY_ID, resourceForTool } from './resources';
import type { EventSpec } from './scenarios';
import { alertFromEvent, buildEvent, type BuildCtx } from '../lib/simulationEngine';

const MIN = 60_000;
const HOUR = 3_600_000;

/** KPI counters start from these illustrative values and move only when simulated events are committed. */
export const BASE_KPI = { monitored: 1284, suspicious: 23, blocked: 17 };

const U = (source: string, hops = 0): TaintTag => ({ source, trust: 'untrusted', hops });

interface Incident {
  agent: string; hoursAgo: number; status: AlertStatus; title: string; category?: ThreatCategory; shadow?: boolean;
  spec: Omit<EventSpec, 'key' | 'agentId'>;
  pre?: { tool: string; action: string; resourceId: string; resourceName: string };
}

const INCIDENTS: Incident[] = [
  { agent: 'agt_research_03', hoursAgo: 9, status: 'acknowledged', title: 'Web Crawler Agent burst-crawled 214 pages, 6σ above baseline', category: 'behavioural_drift',
    spec: { tool: 'web.read', action: 'Crawl burst: 214 pages in 90 s', resourceId: 'res_web_public', resourceName: 'open-web (214 pages)', taint: [U('mixed-web-crawl')], features: { rateZ: 6.1, resourceNovelty: 0.6, callsPerMinute: 140, noParentTask: true } } },
  { agent: 'agt_procure_03', hoursAgo: 30, status: 'closed', title: 'Legacy Quote Agent token used from an unknown client — gateway token revoked', category: 'behavioural_drift',
    spec: { tool: 'catalog.read', action: 'Read supplier directory from fp_77b2 at 03:12', resourceId: 'res_supplier_directory', resourceName: 'supplier.directory', features: { newFingerprint: true, offHours: true, noParentTask: true, rateZ: 5.9, callsPerMinute: 58 } } },
  { agent: 'agt_hr_02', hoursAgo: 4, status: 'open', title: 'Onboarding Assistant sensitive-read share trending above golden baseline', category: 'behavioural_drift',
    spec: { tool: 'hr.records.read', action: 'Read 96 employee records (usual 30)', resourceId: 'res_hr_reports', resourceName: 'hr.employee_records', features: { jsDivergence: 0.2, cusum: 3.4 } } },
  { agent: 'agt_finance_02', hoursAgo: 5, status: 'acknowledged', title: 'Invoice Validator generated a report straight after a 400-invoice batch', category: 'unusual_sequence',
    spec: { tool: 'report.generate', action: 'Generate payables report after 400 validations', resourceId: 'res_fin_reports', resourceName: 'finance.payables', prevTool: 'invoice.validate', features: { bigramProb: 0.004 } },
    pre: { tool: 'invoice.validate', action: 'Validate invoice batch (400)', resourceId: 'res_invoice_store', resourceName: 'invoice.batch_0921' } },
  { agent: 'agt_orchestrator_02', hoursAgo: 7, status: 'open', title: 'Workflow Router delegated a task derived from an untrusted newsletter', category: 'delegation_anomaly',
    spec: { tool: 'agent.delegate', action: 'Delegate "reconcile partner payouts" to Finance Agent', resourceId: 'res_workflow_registry', resourceName: 'workflow.tasks', delegateTo: 'agt_finance_01', chain: ['agt_research_02', 'agt_orchestrator_02'], taint: [U('partner-portal.example/newsletter', 1)], features: { resourceNovelty: 0.5 } } },
  { agent: 'agt_procure_02', hoursAgo: 11, status: 'closed', title: 'Procurement EU requested HR records outside its role contract', category: 'role_violation',
    spec: { tool: 'hr.records.read', action: 'Read HR headcount report', resourceId: 'res_hr_reports', resourceName: 'hr.headcount', features: { resourceNovelty: 1, bigramProb: 0.002, toolShare: 0 } } },
  { agent: 'agt_research_02', hoursAgo: 16, status: 'closed', title: 'Market Intel Agent attempted finance.read after an untrusted page', category: 'taint',
    spec: { tool: 'finance.read', action: 'Read Q3 cash-flow report', resourceId: 'res_fin_reports', resourceName: 'finance.cashflow_q3', taint: [U('tariff-watch.example/post-118', 0)], prevTool: 'web.read', features: { resourceNovelty: 1, bigramProb: 0.003, toolShare: 0 } },
    pre: { tool: 'web.read', action: 'Read tariff-watch.example/post-118', resourceId: 'res_web_public', resourceName: 'tariff-watch.example/post-118' } },
  { agent: 'agt_finance_01', hoursAgo: 20, status: 'closed', title: 'Finance Agent tried to email a confidential report to an external address', category: 'unapproved_destination',
    spec: { tool: 'email.send', action: 'Send payables summary to ext-recipient@mailbox.example', resourceId: 'res_internal_mail', resourceName: 'mail.relay', payloadSensitivity: 'confidential', destination: { host: 'mailbox.example', approved: false }, features: { resourceNovelty: 0.8, bigramProb: 0.01, toolShare: 0 } } },
  { agent: 'agt_procure_01', hoursAgo: 2, status: 'acknowledged', title: 'Procurement Agent exceeded its contract rate limit during a quote sweep', category: 'behavioural_drift',
    spec: { tool: 'purchase_request.create', action: 'Create 22 purchase requests in 30 s', resourceId: 'res_purchase_requests', resourceName: 'purchase.requests', features: { rateZ: 3.6, callsPerMinute: 52 } } },
  { agent: 'agt_research_01', hoursAgo: 18, status: 'closed', title: 'Research Agent call rate slightly above baseline', category: 'behavioural_drift',
    spec: { tool: 'web.search', action: '48 searches in 5 minutes', resourceId: 'res_web_public', resourceName: 'web.search', features: { rateZ: 3.3 } } },
  { agent: 'agt_orchestrator_01', hoursAgo: 1.5, status: 'open', title: 'Orchestrator is reading workflows it has never touched', category: 'behavioural_drift',
    spec: { tool: 'workflow.read', action: 'Read 14 legacy finance workflows', resourceId: 'res_workflow_registry', resourceName: 'workflow.legacy_finance', features: { resourceNovelty: 0.6, rateZ: 4 } } },
  { agent: 'agt_hr_01', hoursAgo: 3, status: 'open', shadow: true, title: 'HR Agent read confidential records right after an unvetted benchmark page', category: 'taint',
    spec: { tool: 'hr.records.read', action: 'Read compensation-band report', resourceId: 'res_hr_reports', resourceName: 'hr.comp_bands', taint: [U('hr-benchmarks.example/salary-guide', 1)], prevTool: 'documents.read', features: { bigramProb: 0.015, noParentTask: true } } },
];

/** Deterministic pseudo-random generator so every reset yields the same history. */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const BACKGROUND: { agent: string; tool: string; actions: string[]; res: string; name: string }[] = [
  { agent: 'agt_procure_01', tool: 'catalog.search', actions: ['Search catalogue: M8 washers', 'Search catalogue: safety gloves', 'Search catalogue: conveyor belts'], res: 'res_product_catalog', name: 'catalog.products' },
  { agent: 'agt_procure_01', tool: 'pricing.compare', actions: ['Compare quotes for pallet racking', 'Compare quotes for LED panels'], res: 'res_pricing_engine', name: 'pricing.compare' },
  { agent: 'agt_procure_02', tool: 'catalog.read', actions: ['Read supplier profile: Aurelia GmbH', 'Read supplier profile: Nordic Parts'], res: 'res_supplier_directory', name: 'supplier.directory' },
  { agent: 'agt_research_01', tool: 'web.search', actions: ['Search: "logistics cost index"', 'Search: "supplier ESG ratings"'], res: 'res_web_public', name: 'web.search' },
  { agent: 'agt_research_02', tool: 'documents.read', actions: ['Read market-notes-q3.docx', 'Read competitor-brief.pdf'], res: 'res_doc_library', name: 'doc.library' },
  { agent: 'agt_orchestrator_01', tool: 'task.status', actions: ['Check status of wf_quarterly_review', 'Check status of wf_onboarding'], res: 'res_workflow_registry', name: 'workflow.tasks' },
  { agent: 'agt_orchestrator_02', tool: 'workflow.read', actions: ['Read workflow wf_invoice_run', 'Read workflow wf_vendor_audit'], res: 'res_workflow_registry', name: 'workflow.tasks' },
  { agent: 'agt_hr_01', tool: 'hr.reports.generate', actions: ['Generate attrition report (aggregated)', 'Generate headcount report'], res: 'res_hr_reports', name: 'hr.reports' },
  { agent: 'agt_finance_01', tool: 'invoice.validate', actions: ['Validate invoice INV-88104', 'Validate invoice INV-88152'], res: 'res_invoice_store', name: 'invoice.store' },
  { agent: 'agt_finance_01', tool: 'finance.read', actions: ['Read monthly close summary'], res: 'res_fin_reports', name: 'finance.close_summary' },
];

export interface SeedData {
  agents: Agent[];
  contracts: RoleContract[];
  events: SecEvent[];
  alerts: Alert[];
}

export function buildSeed(thresholds: Thresholds): SeedData {
  const now = Date.now();
  const agents = buildAgents();
  const contracts = buildContracts();
  const ctx: BuildCtx = { agents, contracts, thresholds };
  const rnd = lcg(20261026);

  interface Tmp { ev: SecEvent; alertOf?: Incident; incident?: boolean }
  const tmp: Tmp[] = [];
  let n = 0;
  const tid = () => `tmp_${n++}`;

  // benign background traffic over the last 24 hours
  for (let i = 0; i < 64; i++) {
    const b = BACKGROUND[Math.floor(rnd() * BACKGROUND.length)];
    const ts = now - Math.floor(rnd() * 24 * HOUR) - MIN;
    const spec: EventSpec = {
      key: 'b', agentId: b.agent, tool: b.tool, action: b.actions[Math.floor(rnd() * b.actions.length)],
      resourceId: b.res, resourceName: b.name, features: { rateZ: rnd() * 1.2, callsPerMinute: 4 + Math.floor(rnd() * 9) },
    };
    const sens: Sensitivity = RESOURCE_BY_ID[b.res].sensitivity;
    void sens;
    const { event } = buildEvent(spec, { id: tid(), ts, session: `ses_bg_${String(i % 17).padStart(2, '0')}`, rootPrincipal: 'task queue', parentId: null }, ctx);
    tmp.push({ ev: event });
  }

  // incidents (optionally with a precursor event in the same session)
  const incidentAlerts: { tmpId: string; inc: Incident; precursorId?: string }[] = [];
  INCIDENTS.forEach((inc, idx) => {
    const ts = now - inc.hoursAgo * HOUR;
    const session = `ses_inc_${String(idx + 1).padStart(2, '0')}`;
    let parentId: string | null = null;
    let precursorId: string | undefined;
    if (inc.pre) {
      const pre = buildEvent(
        { key: 'p', agentId: inc.agent, tool: inc.pre.tool, action: inc.pre.action, resourceId: inc.pre.resourceId, resourceName: inc.pre.resourceName, taint: inc.spec.taint },
        { id: tid(), ts: ts - 2 * MIN, session, rootPrincipal: 'task queue', parentId: null }, ctx,
      );
      tmp.push({ ev: pre.event });
      parentId = pre.event.event_id;
      precursorId = parentId;
    }
    const spec: EventSpec = { ...inc.spec, key: 'i', agentId: inc.agent };
    const built = buildEvent(spec, { id: tid(), ts, session, rootPrincipal: 'task queue', parentId }, ctx);
    tmp.push({ ev: built.event, incident: true });
    incidentAlerts.push({ tmpId: built.event.event_id, inc, precursorId });
  });

  // chronological ids evt_0001…
  tmp.sort((a, b) => a.ev.ts - b.ev.ts);
  const map = new Map<string, string>();
  tmp.forEach((t, i) => map.set(t.ev.event_id, `evt_${String(i + 1).padStart(4, '0')}`));
  const events = tmp.map((t) => ({
    ...t.ev, event_id: map.get(t.ev.event_id)!, parent_event_id: t.ev.parent_event_id ? map.get(t.ev.parent_event_id)! : null,
  }));
  const byId = new Map(events.map((e) => [e.event_id, e]));

  const alerts: Alert[] = incidentAlerts
    .map(({ tmpId, inc, precursorId }, i) => {
      const ev = byId.get(map.get(tmpId)!)!;
      const related = [precursorId ? map.get(precursorId)! : null, ev.event_id].filter(Boolean) as string[];
      return alertFromEvent(ev, ev.signals, {
        id: `ALR-${2000 + i + 1}`, title: inc.title, category: inc.category, status: inc.status, shadow: inc.shadow, relatedEventIds: related,
      });
    })
    .sort((a, b) => b.ts - a.ts);

  return { agents, contracts, events, alerts };
}

export const SEED_RESOURCE_COUNT = Object.keys(RESOURCE_BY_ID).length;
void resourceForTool;
