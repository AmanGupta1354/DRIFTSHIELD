import { AGENT_NAME } from '../data/agents';
import { ROLE_LABEL } from '../data/contracts';
import { POLICIES } from '../data/policies';
import type { Alert, EnforcementAction, SecEvent, Severity, Signal } from '../types';
import { clamp, scoreSignals, severityFor } from './riskScoring';
import type { CompiledStep } from './simulationEngine';

/**
 * Explainable-AI layer. Every sentence is produced by deterministic templates from the structured detector
 * evidence of the selected event — no LLM, no external service. To plug in a generative explainer later,
 * implement `Explainer` and swap it in `explainer` below; the UI only depends on the `Xai` shape.
 */

export interface FlaggedSignal { title: string; detail: string; policyId?: string; hard: boolean; value: number }
export interface BreakdownRow { label: string; family: string; contribution: number; level: 'High' | 'Medium' | 'Low'; share: number; hard: boolean }
export type EnforcementStatus = 'blocked' | 'held' | 'forwarded' | 'recommended only';

export interface Xai {
  eventId: string;
  what: string;
  flagged: FlaggedSignal[];
  breakdown: BreakdownRow[];
  why: string;
  recommended: string[];
  detected: string[];
  recommendedAction: string;
  enforcedText: string;
  enforcement: EnforcementStatus;
  score: number;
  severity: Severity;
  decision: EnforcementAction;
  hard: boolean;
  policies: { id: string; text: string }[];
  related: string[];
}

export interface ExplainOptions {
  /** explain a partial evidence set (live narration while the detectors are still reporting) */
  signals?: Signal[];
  alert?: Alert;
  related?: string[];
}

export interface Explainer { explain(e: SecEvent, o?: ExplainOptions): Xai }

const DETECTOR_LABEL: Record<Signal['detector'], string> = {
  role_violation: 'Role violation', taint_match: 'Untrusted input', behavioural_deviation: 'Behavioural deviation',
  sequence_anomaly: 'Sequence anomaly', rate_anomaly: 'Rate anomaly', rare_tool: 'Rare tool use',
  unapproved_destination: 'Unapproved destination', delegation_anomaly: 'Delegation context', identity_context: 'Identity context',
};

const name = (id: string) => AGENT_NAME[id] ?? id;
const level = (c: number): BreakdownRow['level'] => (c >= 0.5 ? 'High' : c >= 0.25 ? 'Medium' : 'Low');

export function whatHappened(e: SecEvent): string {
  const who = name(e.agent_id);
  const taint = e.input_taint.find((t) => t.trust === 'untrusted');
  const act = e.delegate_to ? `delegated work to ${name(e.delegate_to)}` : `called ${e.tool} on ${e.resource} (${e.resource_sensitivity})`;
  const dest = e.destination ? ` and tried to send data to ${e.destination}` : '';
  const after = taint ? ` after processing untrusted input (${taint.source})` : '';
  return `${who} ${act}${dest}${after}.`;
}

export function whyDecision(e: SecEvent, signals: Signal[] = e.signals, score = e.decision.score, action: EnforcementAction = e.decision.action): string {
  const trig = signals.filter((s) => s.triggered);
  const hard = trig.filter((s) => s.hard);
  if (!trig.length) return 'No detector exceeded its threshold. The call fits the role, its inputs and the agent\'s routine, so it was forwarded.';
  const extra: string[] = [];
  const taint = e.input_taint.find((t) => t.trust === 'untrusted');
  if (trig.some((s) => s.detector === 'taint_match')) extra.push(`it followed untrusted input${taint ? ` (${taint.source})` : ''}`);
  if (trig.some((s) => s.detector === 'delegation_anomaly')) extra.push('it traces back to a lower-trust agent');
  if (trig.some((s) => s.detector === 'unapproved_destination')) extra.push('the destination is not approved');
  if (trig.some((s) => s.family === 'behaviour' || s.family === 'identity')) extra.push('it deviates from the agent\'s routine');
  const evidence = extra.length ? ` Supporting evidence: ${extra.join('; ')}.` : '';
  if (action === 'block' || action === 'block_quarantine') {
    const lead = hard.length
      ? `The action violated the ${ROLE_LABEL[e.role]} role contract (${Array.from(new Set(hard.map((s) => s.policyId))).join(', ')}), which blocks independently of the score.`
      : `Combined evidence scored ${score}/100, inside the block band.`;
    return `${lead}${evidence} The simulated policy layer ${action === 'block_quarantine' ? 'blocked it and quarantined sensitive scopes' : 'blocked it'}; the operation was not executed.`;
  }
  if (action === 'step_up') return `Score ${score}/100 falls in the step-up band, so the call is held for human approval.${evidence}`;
  if (action === 'watch') return `Score ${score}/100: allowed with closer monitoring and full argument capture.${evidence}`;
  return `Score ${score}/100 is below the watch threshold, so the call was allowed.`;
}

export function recommendations(e: SecEvent, signals: Signal[] = e.signals, action: EnforcementAction = e.decision.action): string[] {
  const t = (d: Signal['detector']) => signals.some((s) => s.triggered && s.detector === d);
  if (action === 'allow') return ['No action needed.'];
  const out: string[] = [];
  const taint = e.input_taint.find((x) => x.trust === 'untrusted');
  if (action === 'block' || action === 'block_quarantine') out.push('Preserve the event evidence.');
  if (t('taint_match') && taint) out.push(`Inspect the source: ${taint.source}.`);
  if (t('delegation_anomaly')) out.push('Check the delegation chain back to the root principal.');
  if (t('unapproved_destination')) out.push(`Review other sessions that contacted ${e.destination ?? 'the destination'}.`);
  if (t('identity_context')) out.push('Rotate the agent token and verify the client fingerprint.');
  if (signals.some((s) => s.triggered && s.family === 'behaviour')) out.push('Compare recent actions with the golden baseline.');
  out.push(`Review ${name(e.agent_id)}'s recent actions.`);
  if (action === 'block_quarantine') out.push('Require human review before restoring the agent.');
  if (action === 'step_up') out.push('Approve or reject the held call after reviewing the evidence.');
  return out.slice(0, 5);
}

const ENFORCED: Record<EnforcementAction, [string, EnforcementStatus]> = {
  allow: ['Forwarded to the tool.', 'forwarded'],
  watch: ['Forwarded; agent placed on watch.', 'forwarded'],
  step_up: ['Held for approval (simulated).', 'held'],
  block: ['Not forwarded — 403 returned (simulated).', 'blocked'],
  block_quarantine: ['Not forwarded; sensitive scopes quarantined (simulated).', 'blocked'],
};
const RECOMMEND_TEXT: Record<EnforcementAction, string> = {
  allow: 'No action', watch: 'Allow and watch', step_up: 'Hold for human approval', block: 'Block the operation',
  block_quarantine: 'Block, quarantine sensitive scopes, pause the agent',
};

export const deterministicExplainer: Explainer = {
  explain(e, o = {}) {
    const signals = o.signals ?? e.signals;
    const trig = signals.filter((s) => s.triggered);
    const partial = !!o.signals;
    const r = partial ? scoreSignals(signals, undefined, false) : { score: e.decision.score, severity: e.decision.severity, action: e.decision.action, hardViolation: e.hard_violation };
    // strongest signal per evidence family, exactly as the scorer sees it
    const best = new Map<string, Signal>();
    trig.forEach((s) => { const c = best.get(s.family); if (!c || s.value > c.value) best.set(s.family, s); });
    const rows = [...best.values()].map((s) => ({ s, c: clamp(s.weight * s.value) }));
    const total = rows.reduce((a, x) => a + x.c, 0) || 1;
    const breakdown: BreakdownRow[] = rows
      .map(({ s, c }) => ({ label: DETECTOR_LABEL[s.detector], family: s.family, contribution: c, level: level(c), share: c / total, hard: s.hard }))
      .sort((a, b) => b.contribution - a.contribution);
    const action = r.action as EnforcementAction;
    const [enforcedDefault, status] = ENFORCED[action];
    const seen = new Set<string>();
    const policies = trig
      .map((s) => s.policyId).filter((p): p is string => !!p && !seen.has(p) && !!seen.add(p))
      .map((id) => ({ id, text: POLICIES[id]?.title ?? id }));
    const shadow = o.alert && !o.alert.actuallyBlocked && (action === 'block' || action === 'block_quarantine');
    return {
      eventId: e.event_id,
      what: whatHappened(e),
      flagged: trig.sort((a, b) => b.weight * b.value - a.weight * a.value).slice(0, 6)
        .map((s) => ({ title: s.title, detail: s.explanation, policyId: s.policyId, hard: s.hard, value: s.value })),
      breakdown,
      why: whyDecision(e, signals, r.score, action),
      recommended: recommendations(e, signals, action),
      detected: trig.length ? Array.from(new Set(trig.map((s) => s.title))) : ['Nothing unusual'],
      recommendedAction: RECOMMEND_TEXT[action],
      enforcedText: shadow ? 'Not enforced — monitor-only (shadow) mode in this simulation.' : o.alert?.enforced ?? enforcedDefault,
      enforcement: shadow ? 'recommended only' : status,
      score: r.score, severity: r.severity, decision: action, hard: r.hardViolation, policies,
      related: o.related ?? [e.event_id],
    };
  },
};

export const explainer: Explainer = deterministicExplainer;
export const explainEvent = (e: SecEvent, o?: ExplainOptions) => explainer.explain(e, o);

// ---------------------------------------------------------------- live narration while a scenario plays

export const STAGE_TITLE = ['Request', 'Role check', 'Context analysis', 'Behaviour check', 'Risk assessment', 'Enforcement', 'Outcome'];

export function narrateStep(cs: CompiledStep, decided: boolean): string {
  const f = cs.focus?.event;
  if (!f) return cs.spec.detail;
  const who = name(f.agent_id);
  const trig = cs.revealed.filter((s) => s.triggered);
  const isFinal = decided && !!cs.spec.focus && !!cs.spec.emit?.includes(cs.spec.focus);
  if (isFinal) return whyDecision(f, cs.focus!.decision.signals, cs.focus!.decision.score, cs.focus!.decision.action);
  if (!cs.revealed.length) return `${who} requested ${f.tool} on ${f.resource}. The gateway is evaluating it before it reaches the tool.`;
  if (trig.length) {
    const top = [...trig].sort((a, b) => b.value * b.weight - a.value * a.weight)[0];
    const others = trig.filter((s) => s !== top).slice(0, 2).map((s) => s.title.toLowerCase());
    return `${top.explanation}${others.length ? ` Also flagged: ${others.join(', ')}.` : ''} Risk so far: ${cs.liveScore}/100.`;
  }
  return `${whatHappened(f)} ${whyDecision(f, [], 0, 'allow')}`;
}

export { severityFor };
