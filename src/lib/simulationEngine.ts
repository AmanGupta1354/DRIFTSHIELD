import { AGENT_NAME } from '../data/agents';
import { activeBody } from '../data/contracts';
import { POLICIES } from '../data/policies';
import { RESOURCE_BY_ID } from '../data/resources';
import { BENIGN, SCENARIOS, type EventSpec, type ScenarioId, type StepSpec } from '../data/scenarios';
import type {
  Agent, Alert, Decision, EnforcementAction, Family, RoleContract, SecEvent, Signal, ThreatCategory, Thresholds, ToolCallInput,
} from '../types';
import { evaluateToolCall } from './policyEngine';
import { buildTriad, isBlocking, scoreSignals, severityFor } from './riskScoring';

export interface BuildCtx {
  agents: Agent[];
  contracts: RoleContract[];
  thresholds: Thresholds;
}

const pad = (n: number) => String(n).padStart(4, '0');
export const eventIdFor = (base: number, idx: number) => `evt_${pad(base + idx)}`;

export function toolCallInput(spec: EventSpec, rootPrincipal: string, ctx: BuildCtx, parentId: string | null): ToolCallInput {
  const agent = ctx.agents.find((a) => a.id === spec.agentId)!;
  const res = RESOURCE_BY_ID[spec.resourceId];
  const chain = spec.chain ?? [spec.agentId];
  const tiers = chain.map((id) => ctx.agents.find((a) => a.id === id)?.trustTier ?? 2);
  return {
    agentId: spec.agentId, role: agent.role, tool: spec.tool, action: spec.action, resourceId: spec.resourceId,
    sensitivity: spec.sensitivity ?? res.sensitivity, payloadSensitivity: spec.payloadSensitivity,
    destination: spec.destination, taint: spec.taint ?? [], parentEventId: parentId, rootPrincipal,
    delegationChain: chain, delegateTo: spec.delegateTo, prevTool: spec.prevTool,
    actorTier: agent.trustTier, originTier: Math.min(...tiers) as 1 | 2 | 3,
    features: { ...BENIGN, ...spec.features },
  };
}

export interface BuiltEvent {
  event: SecEvent;
  decision: Decision;
}

export function buildEvent(
  spec: EventSpec, opts: { id: string; ts: number; session: string; rootPrincipal: string; parentId: string | null; runKey?: string }, ctx: BuildCtx,
): BuiltEvent {
  const input = toolCallInput(spec, opts.rootPrincipal, ctx, opts.parentId);
  const contract = ctx.contracts.find((c) => c.role === input.role)!;
  const decision = evaluateToolCall(input, activeBody(contract), ctx.thresholds);
  const triggered = decision.signals.filter((s) => s.triggered);
  const event: SecEvent = {
    event_id: opts.id, ts: opts.ts, agent_id: spec.agentId, role: input.role, session_id: opts.session,
    parent_event_id: opts.parentId, tool: spec.tool, action: spec.action, resource: spec.resourceName,
    resource_id: spec.resourceId, resource_sensitivity: input.sensitivity, input_taint: spec.taint ?? [],
    destination: spec.destination?.host, delegate_to: spec.delegateTo, root_principal: opts.rootPrincipal,
    delegation_chain: input.delegationChain,
    decision: { score: decision.score, severity: decision.severity, action: decision.action },
    explanation: decision.explanation, signals: triggered, triad: decision.triad, hard_violation: decision.hardViolation,
    enforced: isBlocking(decision.action), run_key: opts.runKey,
  };
  return { event, decision };
}

// ---------------------------------------------------------------- compile scenario into playable steps

export interface CompiledStep {
  spec: StepSpec;
  index: number;
  emit: BuiltEvent[];
  focus?: BuiltEvent;
  revealed: Signal[];
  liveScore: number;
  liveAction: EnforcementAction;
  hard: boolean;
  triad: ReturnType<typeof buildTriad>;
}

export interface CompiledScenario {
  id: ScenarioId;
  built: Record<string, BuiltEvent>;
  idOf: Record<string, string>;
  steps: CompiledStep[];
}

export function compileScenario(id: ScenarioId, ctx: BuildCtx): CompiledScenario {
  const sc = SCENARIOS[id];
  const idOf: Record<string, string> = {};
  sc.events.forEach((e, i) => (idOf[e.key] = eventIdFor(sc.eventBase, i)));
  const built: Record<string, BuiltEvent> = {};
  sc.events.forEach((e, i) => {
    built[e.key] = buildEvent(
      e,
      { id: idOf[e.key], ts: 0, session: e.session ?? sc.session, rootPrincipal: sc.rootPrincipal, parentId: e.parent ? idOf[e.parent] : null, runKey: id },
      ctx,
    );
    void i;
  });

  let lastScore = 0, lastAction: EnforcementAction = 'allow', lastHard = false, lastTriad = buildTriad([]);
  let lastRevealed: Signal[] = [];
  const steps: CompiledStep[] = sc.steps.map((spec, index) => {
    const emit = (spec.emit ?? []).map((k) => built[k]);
    const focusKey = spec.focus ?? (spec.emit ? spec.emit[spec.emit.length - 1] : undefined);
    const focus = focusKey ? built[focusKey] : undefined;
    let revealed = lastRevealed;
    if (focus) {
      const rv: Family[] | 'all' = spec.reveal ?? 'all';
      revealed = rv === 'all' ? focus.decision.signals : focus.decision.signals.filter((s) => rv.includes(s.family));
      const r = scoreSignals(revealed, ctx.thresholds, rv === 'all');
      lastScore = revealed.length ? r.score : 0;
      lastAction = revealed.length ? r.action : 'allow';
      lastHard = r.hardViolation && revealed.length > 0;
      lastTriad = buildTriad(revealed);
      lastRevealed = revealed;
    }
    return { spec, index, emit, focus, revealed, liveScore: lastScore, liveAction: lastAction, hard: lastHard, triad: lastTriad };
  });
  return { id, built, idOf, steps };
}

// ---------------------------------------------------------------- alerts

export function categoryFor(signals: Signal[], fallback?: ThreatCategory): ThreatCategory {
  if (fallback) return fallback;
  const t = (d: Signal['detector']) => signals.some((s) => s.triggered && s.detector === d);
  if (t('taint_match')) return 'taint';
  if (t('delegation_anomaly')) return 'delegation_anomaly';
  if (t('unapproved_destination')) return 'unapproved_destination';
  if (t('role_violation')) return 'role_violation';
  if (t('sequence_anomaly')) return 'unusual_sequence';
  return 'behavioural_drift';
}

const REFS: Record<ThreatCategory, { mitre: string; owasp: string }> = {
  taint: { mitre: 'AML.T0080 AI Agent Context Poisoning', owasp: 'ASI01 Goal Hijack' },
  unapproved_destination: { mitre: 'AML.T0086 Exfiltration via AI Agent Tool Invocation', owasp: 'ASI01 Goal Hijack' },
  role_violation: { mitre: 'AML.T0086 Exfiltration via AI Agent Tool Invocation', owasp: 'Agentic tool misuse (mapping illustrative)' },
  delegation_anomaly: { mitre: 'AML.T0080 AI Agent Context Poisoning', owasp: 'ASI01 Goal Hijack · inter-agent communication' },
  behavioural_drift: { mitre: 'Not mapped (illustrative)', owasp: 'Rogue agent behaviour (mapping illustrative)' },
  unusual_sequence: { mitre: 'Not mapped (illustrative)', owasp: 'Agentic tool misuse (mapping illustrative)' },
};

const CATEGORY_LABEL: Record<ThreatCategory, string> = {
  role_violation: 'Role violation', taint: 'Taint / untrusted input', behavioural_drift: 'Behavioural drift',
  unapproved_destination: 'Unapproved destination', unusual_sequence: 'Unusual sequence', delegation_anomaly: 'Delegation anomaly',
};
export const categoryLabel = (c: ThreatCategory) => CATEGORY_LABEL[c];

const RECOMMENDED: Record<EnforcementAction, string> = {
  allow: 'No action required', watch: 'Allow and watch: lower thresholds, capture full arguments',
  step_up: 'Hold the call for human step-up approval', block: 'Block this operation',
  block_quarantine: 'Block the operation, quarantine sensitive scopes, pause the agent and snapshot evidence',
};

const ENFORCED_TEXT: Record<EnforcementAction, string> = {
  allow: 'Nothing enforced', watch: 'Call forwarded; agent placed on watch',
  step_up: 'Call held for approval (simulated)', block: 'Call not forwarded — 403 returned (simulated)',
  block_quarantine: 'Call not forwarded; sensitive scopes quarantined (simulated)',
};

function responseSteps(cat: ThreatCategory, a: EnforcementAction): string[] {
  const common = ['Review the evidence bundle and the hash-chained audit entries', 'Confirm whether the role contract needs an approved change'];
  const per: Record<ThreatCategory, string[]> = {
    taint: ['Quarantine the untrusted source document', 'Inspect other agents that read the same file'],
    unapproved_destination: ['Add the destination to the block list', 'Review other sessions that contacted the same host'],
    role_violation: ['Verify the agent\'s declared role and owner', 'Check for over-broad scopes on the agent token'],
    delegation_anomaly: ['Trace the root principal through the delegation graph', 'Require approval for delegation from low-trust agents'],
    behavioural_drift: ['Compare the rolling profile with the frozen golden baseline', 'Rotate the agent token if the client fingerprint is new'],
    unusual_sequence: ['Replay the session timeline for the sequence', 'Tune the sequence rule if the change is legitimate'],
  };
  return [...per[cat], ...common, ...(isBlocking(a) ? ['Restore the agent from the Agent Fleet when the owner approves'] : [])];
}

export function alertFromEvent(
  event: SecEvent, signals: Signal[], opts: { id: string; title: string; category?: ThreatCategory; status?: Alert['status']; run_key?: string; shadow?: boolean; relatedEventIds?: string[] },
): Alert {
  const cat = categoryFor(signals, opts.category);
  const trig = signals.filter((s) => s.triggered);
  const action = event.decision.action;
  const shadow = !!opts.shadow;
  const policies = Array.from(new Set(trig.map((s) => s.policyId).filter(Boolean) as string[]))
    .map((id) => ({ id, text: POLICIES[id]?.title ?? id }));
  const taint = event.input_taint.filter((t) => t.trust === 'untrusted');
  const actuallyBlocked = isBlocking(action) && !shadow;
  return {
    id: opts.id, ts: event.ts, agentId: event.agent_id, category: cat, title: opts.title, score: event.decision.score,
    severity: severityFor(event.decision.score), status: opts.status ?? 'open', summary: event.explanation,
    explanation: `${AGENT_NAME[event.agent_id] ?? event.agent_id} called ${event.tool} on ${event.resource}. ${event.explanation}`,
    signalTitles: trig.map((s) => s.title), violatedPolicies: policies,
    taintInfo: taint.length
      ? `Untrusted input in ancestry: ${taint.map((t) => t.source).join(', ')} (hop${taint.length > 1 || (taint[0].hops ?? 0) > 0 ? 's' : ''} ${taint.map((t) => t.hops ?? 0).join(', ')}).`
      : 'No untrusted input in the ancestry of this event.',
    behaviouralDeviations: trig.filter((s) => s.family === 'behaviour' || s.family === 'identity').map((s) => `${s.title} — ${s.explanation}`),
    eventIds: opts.relatedEventIds ?? [event.event_id],
    triad: buildTriad(signals), detected: trig.map((s) => s.title), recommended: RECOMMENDED[action],
    enforced: shadow ? 'Not enforced — agent is in monitor-only (shadow) mode in this simulation' : ENFORCED_TEXT[action],
    actuallyBlocked, recommendedResponse: responseSteps(cat, action), mitre: REFS[cat].mitre, owasp: REFS[cat].owasp,
    run_key: opts.run_key,
  };
}

/** Agent state implied by an enforcement decision (ladder from the solution report). */
export function stateFor(action: EnforcementAction): Agent['state'] | null {
  if (action === 'block_quarantine') return 'quarantined';
  if (action === 'block') return 'watched';
  if (action === 'watch' || action === 'step_up') return 'watched';
  return null;
}

export function agentRiskAfter(prev: number, score: number) {
  return Math.max(Math.round(prev * 0.6 + score * 0.4), score >= 55 ? score : 0, prev > score ? prev : 0) || prev;
}
