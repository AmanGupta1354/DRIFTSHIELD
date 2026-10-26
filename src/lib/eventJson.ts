import type { SecEvent } from '../types';

/** Shape shown to the analyst — mirrors the illustrative event object from the solution report. */
export function eventJson(e: SecEvent) {
  return {
    event_id: e.event_id,
    agent_id: e.agent_id,
    role: e.role,
    session_id: e.session_id,
    parent_event_id: e.parent_event_id,
    tool: e.tool,
    action: e.action,
    resource: e.resource,
    resource_sensitivity: e.resource_sensitivity,
    input_taint: e.input_taint,
    ...(e.destination ? { destination: e.destination } : {}),
    ...(e.delegate_to ? { delegate_to: e.delegate_to } : {}),
    root_principal: e.root_principal,
    delegation_chain: e.delegation_chain,
    decision: e.decision,
    evidence: e.signals.map((s) => ({ detector: s.detector, family: s.family, triggered: s.triggered, weight: s.weight, value: Number(s.value.toFixed(2)), policy: s.policyId, explanation: s.explanation })),
    explanation: e.explanation,
    enforced: e.enforced,
    simulated: true,
    timestamp: new Date(e.ts).toISOString(),
  };
}
