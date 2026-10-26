import { RESOURCE_BY_ID } from '../data/resources';
import { FAMILY_WEIGHTS } from '../data/policies';
import type { ContractBody, Decision, Signal, Thresholds, ToolCallInput, Resource, Role } from '../types';
import { sensRank } from '../types';
import {
  behaviourSignals, clamp, decisionFromSignals, delegationSignals, identitySignals, taintSignals,
} from './riskScoring';

const mk = (
  detector: Signal['detector'], family: Signal['family'], lane: Signal['lane'], value: number, triggered: boolean,
  title: string, explanation: string, policyId: string, hard: boolean,
): Signal => ({
  detector, family, lane, triggered, value: triggered ? value : 0, weight: FAMILY_WEIGHTS[family], hard: hard && triggered,
  policyId, title, explanation,
});

/** Deterministic role-contract checks (the "ROLE" question). */
export function contractSignals(i: ToolCallInput, c: ContractBody): Signal[] {
  const out: Signal[] = [];
  const toolOk = c.allowedTools.includes(i.tool);
  out.push(mk('role_violation', 'contract', 'role', 0.9, !toolOk, 'Tool not permitted for this role',
    `${i.tool} is not in the ${i.role} role contract (allowed: ${c.allowedTools.join(', ')}).`, 'RC-01', true));

  const over = sensRank(i.sensitivity) - sensRank(c.maxSensitivity);
  out.push(mk('role_violation', 'contract', 'role', 0.75 + 0.05 * over, over > 0, 'Resource sensitivity above role ceiling',
    `${i.resourceId} is ${i.sensitivity.toUpperCase()}; the ${i.role} role ceiling is ${c.maxSensitivity.toUpperCase()}.`, 'RC-03', true));

  const seq = i.prevTool ? c.forbiddenSequences.find((s) => s.first === i.prevTool && s.then === i.tool) : undefined;
  out.push(mk('role_violation', 'contract', 'role', 0.95, !!seq, 'Forbidden action sequence',
    seq ? `${seq.first} → ${seq.then}: ${seq.reason}.` : 'No forbidden sequence.', 'RC-05', true));

  const cpm = i.features.callsPerMinute ?? 0;
  const ratio = cpm / Math.max(1, c.rateLimit.callsPerMinute);
  out.push(mk('rate_anomaly', 'contract', 'routine', Math.min(0.9, 0.4 + 0.25 * (ratio - 1)), ratio > 1, 'Contract rate limit exceeded',
    `${cpm} calls/min against a contract limit of ${c.rateLimit.callsPerMinute}.`, 'RC-09', false));

  if (i.destination) {
    const listed = c.approvedEgress.includes(i.destination.host);
    const bad = !i.destination.approved || !listed;
    const heavy = sensRank(i.payloadSensitivity ?? 'public') >= 2;
    out.push(mk('unapproved_destination', 'egress', 'role', heavy ? 0.9 : 0.75, bad, 'Egress destination not approved',
      `${i.destination.host} is not on the ${i.role} egress allowlist${heavy ? ` and the payload is ${(i.payloadSensitivity ?? '').toUpperCase()}` : ''}.`, 'RC-07', true));
  }
  return out;
}

export function evaluateToolCall(i: ToolCallInput, contract: ContractBody, t: Thresholds): Decision {
  const signals: Signal[] = [
    ...contractSignals(i, contract),
    ...taintSignals(i),
    ...delegationSignals(i),
    ...behaviourSignals(i.features, i.tool),
    ...identitySignals(i.features),
  ];
  return decisionFromSignals(signals, t);
}

// ---------------------------------------------------------------- resource policy tester

export interface AccessVerdict {
  allowed: boolean;
  violations: { id: string; text: string }[];
}

/** Which contract / resource policy would a role break by touching this resource? */
export function checkAccess(role: Role, tool: string, res: Resource, c: ContractBody): AccessVerdict {
  const v: AccessVerdict['violations'] = [];
  if (!c.allowedTools.includes(tool)) v.push({ id: 'RC-01', text: `${tool} is not in the ${role} role contract.` });
  if (sensRank(res.sensitivity) > sensRank(c.maxSensitivity)) {
    v.push({ id: 'RC-03', text: `${res.name} is ${res.sensitivity.toUpperCase()}; the ${role} ceiling is ${c.maxSensitivity.toUpperCase()}.` });
  }
  if (res.approvedRoles.length === 0 && res.kind !== 'destination') {
    v.push({ id: 'RES-ACL', text: `${res.name} has no approved agent roles (human approval only).` });
  } else if (res.kind !== 'destination' && !res.approvedRoles.includes(role)) {
    v.push({ id: 'RES-ACL', text: `${role} is not in the approved roles for ${res.name}.` });
  }
  if (res.kind === 'destination' && res.endpoint && !c.approvedEgress.includes(res.endpoint)) {
    v.push({ id: 'RC-07', text: `${res.endpoint} is not on the ${role} egress allowlist.` });
  }
  return { allowed: v.length === 0, violations: v };
}

export function resourceFor(id: string): Resource | undefined {
  return RESOURCE_BY_ID[id];
}

export { clamp };
