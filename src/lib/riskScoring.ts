import { FAMILY_WEIGHTS } from '../data/policies';
import type {
  BehaviourFeatures, Decision, EnforcementAction, Family, Lane, LaneStatus, Severity, Signal, Thresholds, Triad,
  ToolCallInput,
} from '../types';
import { sensRank } from '../types';

/**
 * Deterministic, bounded risk scoring (frontend demonstration of the proposed approach — NOT a validated model).
 *
 *   R = 100 · (1 − Π_f (1 − w_f · s_f))
 *
 * s_f is the STRONGEST triggered signal inside evidence family f (max, not sum), so several related signals
 * from one incident do not multiply the same evidence. Families combine with a noisy-OR, which never exceeds 100.
 * A deterministic hard policy violation bypasses the statistical result: R is floored at 90 and the operation is
 * always blocked, whatever the configured thresholds are.
 */

export const DEFAULT_THRESHOLDS: Thresholds = { allow: 35, watch: 55, stepUp: 75, block: 90 };
export const HARD_VIOLATION_FLOOR = 90;

export const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n));

export function severityFor(score: number): Severity {
  if (score >= 75) return 'critical';
  if (score >= 55) return 'high';
  if (score >= 35) return 'medium';
  if (score >= 20) return 'low';
  return 'informational';
}

export function actionFor(score: number, hard: boolean, t: Thresholds): EnforcementAction {
  if (hard) return score >= t.block ? 'block_quarantine' : 'block';
  if (score < t.allow) return 'allow';
  if (score < t.watch) return 'watch';
  if (score < t.stepUp) return 'step_up';
  if (score < t.block) return 'block';
  return 'block_quarantine';
}

export function scoreSignals(signals: Signal[], t: Thresholds = DEFAULT_THRESHOLDS, applyFloor = true) {
  const strongest = new Map<Family, Signal>();
  for (const s of signals) {
    if (!s.triggered) continue;
    const cur = strongest.get(s.family);
    if (!cur || s.value > cur.value) strongest.set(s.family, s);
  }
  let keep = 1;
  strongest.forEach((s) => {
    keep *= 1 - clamp(s.weight * s.value);
  });
  let score = Math.round(100 * (1 - keep));
  const hardViolation = signals.some((s) => s.triggered && s.hard);
  if (hardViolation && applyFloor) score = Math.max(score, HARD_VIOLATION_FLOOR);
  score = Math.min(100, Math.max(0, score));
  return { score, hardViolation, action: actionFor(score, hardViolation, t), severity: severityFor(score) };
}

// ---------------------------------------------------------------- signal helpers

const sig = (
  detector: Signal['detector'], family: Family, lane: Lane, value: number, triggered: boolean,
  title: string, explanation: string, extra: Partial<Signal> = {},
): Signal => ({
  detector, family, lane, triggered, value: triggered ? clamp(value) : 0, weight: FAMILY_WEIGHTS[family],
  hard: false, title, explanation, ...extra,
});

export function taintSignals(i: ToolCallInput): Signal[] {
  const untrusted = i.taint.filter((t) => t.trust === 'untrusted');
  const sensitive = sensRank(i.sensitivity) >= 2 || sensRank(i.payloadSensitivity ?? 'public') >= 2;
  const isDelegation = i.tool === 'agent.delegate';
  const egress = !!i.destination && !i.destination.approved;
  const hit = untrusted.length > 0 && (sensitive || isDelegation || egress);
  let v = 0;
  if (hit) {
    v = sensRank(i.sensitivity) >= 3 ? 0.7 : sensitive ? 0.6 : isDelegation ? 0.3 : 0.5;
    if (egress) v += 0.1;
    v += Math.min(0.1, 0.04 * Math.max(...untrusted.map((t) => t.hops ?? 0)));
  }
  const src = untrusted[0]?.source ?? 'untrusted input';
  return [
    sig('taint_match', 'taint', 'reason', v, hit, 'Sensitive action follows untrusted input',
      `This ${i.tool} call is influenced by untrusted content (${src}). Untrusted input followed by a sensitive or outbound action is the signature of indirect prompt injection.`,
      { policyId: 'TAINT-01' }),
  ];
}

export function behaviourSignals(f: BehaviourFeatures, tool: string): Signal[] {
  const out: Signal[] = [];
  out.push(sig('behavioural_deviation', 'behaviour', 'routine', f.resourceNovelty * 0.85, f.resourceNovelty >= 0.5,
    'Resource never seen in baseline',
    `The agent has no history of touching this resource (novelty ${(f.resourceNovelty * 100).toFixed(0)}% vs. the golden baseline).`,
    { policyId: 'BASE-01' }));
  const drift = Math.max(clamp(f.jsDivergence / 0.45), clamp(f.cusum / 5));
  out.push(sig('behavioural_deviation', 'behaviour', 'routine', drift * 0.9, f.jsDivergence > 0.15 || f.cusum > 2,
    'Drift against the frozen golden baseline',
    `Jensen–Shannon divergence ${f.jsDivergence.toFixed(2)} and CUSUM ${f.cusum.toFixed(1)} on the sensitive-resource share exceed the golden-baseline tolerance.`,
    { policyId: 'BASE-01' }));
  out.push(sig('sequence_anomaly', 'behaviour', 'routine', 0.9 - 0.4 * clamp(f.bigramProb / 0.02), f.bigramProb < 0.02,
    'Unusual action sequence',
    `The transition into ${tool} has baseline probability ≈ ${(f.bigramProb * 100).toFixed(1)}% — this agent has essentially never done this.`,
    { policyId: 'BASE-02' }));
  out.push(sig('rare_tool', 'behaviour', 'routine', 0.7 * (1 - 0.5 * clamp(f.toolShare / 0.03)), f.toolShare < 0.03,
    'Rare tool for this agent',
    `${tool} makes up only ${(f.toolShare * 100).toFixed(1)}% of this agent's normal calls.`,
    { policyId: 'BASE-01' }));
  out.push(sig('rate_anomaly', 'behaviour', 'routine', clamp((f.rateZ - 2) / 6) * 0.9, f.rateZ > 3,
    'Abnormal call rate',
    `Call rate is ${f.rateZ.toFixed(1)}σ above the agent's baseline.`, { policyId: 'BASE-01' }));
  return out;
}

export function identitySignals(f: BehaviourFeatures): Signal[] {
  return [
    sig('identity_context', 'identity', 'routine', 0.85, f.newFingerprint, 'New client fingerprint',
      'The valid credential is being presented from a client fingerprint never seen for this agent.', { policyId: 'ID-01' }),
    sig('identity_context', 'identity', 'routine', 0.5, f.offHours, 'Activity at unusual hours',
      'Calls arrive outside this agent\'s normal working window.', { policyId: 'ID-01' }),
    sig('identity_context', 'identity', 'reason', 0.7, f.noParentTask, 'No originating task',
      'No parent task or human request explains why the agent is acting now.', { policyId: 'ID-01' }),
  ];
}

export function delegationSignals(i: ToolCallInput): Signal[] {
  const len = i.delegationChain.length;
  const hit = len >= 2 && i.originTier < i.actorTier;
  const v = hit ? Math.min(0.9, 0.3 + 0.15 * (i.actorTier - i.originTier) + 0.05 * (len - 2)) : 0;
  return [
    sig('delegation_anomaly', 'delegation', 'reason', v, hit, 'Low-trust origin drove a higher-privilege agent',
      `The action was triggered through a ${len}-agent delegation chain that starts at a tier-${i.originTier} agent, but is executed by a tier-${i.actorTier} agent.`,
      { policyId: 'DEL-01' }),
  ];
}

// ---------------------------------------------------------------- triad + explanation

const LANE_PASS: Record<Lane, string> = {
  role: 'Tool, resource sensitivity and destination are within the role contract.',
  reason: 'The action traces back to the original task with no untrusted influence.',
  routine: 'The action is consistent with the agent\'s golden baseline.',
};

export function buildTriad(signals: Signal[]): Triad {
  const lane = (l: Lane) => {
    const hit = signals.filter((s) => s.triggered && s.lane === l).sort((a, b) => b.value - a.value);
    let status: LaneStatus = 'pass';
    if (hit.some((s) => s.hard || s.value >= 0.5)) status = 'fail';
    else if (hit.length) status = 'warn';
    return { status, summary: hit.length ? hit[0].explanation : LANE_PASS[l] };
  };
  return { role: lane('role'), reason: lane('reason'), routine: lane('routine') };
}

export function explain(signals: Signal[], score: number, action: EnforcementAction): string {
  const trig = signals.filter((s) => s.triggered);
  if (!trig.length) return 'Within the role contract, traceable to its task and consistent with the agent\'s baseline.';
  const parts: string[] = [];
  if (trig.some((s) => s.lane === 'role')) parts.push('violates the role contract');
  if (trig.some((s) => s.detector === 'taint_match')) parts.push('follows untrusted input');
  else if (trig.some((s) => s.detector === 'delegation_anomaly')) parts.push('traces back to a lower-trust agent');
  else if (trig.some((s) => s.lane === 'reason')) parts.push('has no originating task');
  if (trig.some((s) => s.lane === 'routine')) parts.push('deviates from the agent\'s routine');
  const joined = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
  const verdict: Record<EnforcementAction, string> = {
    allow: 'Allowed.', watch: 'Allowed with closer monitoring.', step_up: 'Held for human step-up approval.',
    block: 'Operation blocked.', block_quarantine: 'Operation blocked and sensitive scopes quarantined.',
  };
  return `The requested operation ${joined}. Risk ${score}/100. ${verdict[action]}`;
}

export function decisionFromSignals(signals: Signal[], t: Thresholds): Decision {
  const r = scoreSignals(signals, t);
  return {
    score: r.score, severity: r.severity, action: r.action, hardViolation: r.hardViolation,
    explanation: explain(signals, r.score, r.action), signals, triad: buildTriad(signals),
  };
}

export const ACTION_LABEL: Record<EnforcementAction, string> = {
  allow: 'ALLOW', watch: 'WATCH', step_up: 'STEP-UP', block: 'BLOCK', block_quarantine: 'BLOCK + QUARANTINE',
};
export const ACTION_RANGE_LABEL: Record<EnforcementAction, string> = {
  allow: 'Allow', watch: 'Watch', step_up: 'Step-up approval', block: 'Block operation', block_quarantine: 'Pause agent / quarantine scopes',
};
export const isBlocking = (a: EnforcementAction) => a === 'block' || a === 'block_quarantine';
