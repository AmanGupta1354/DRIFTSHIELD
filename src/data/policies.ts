import type { Family } from '../types';

/** Policy / rule identifiers referenced by alerts and the resource policy tester. */
export const POLICIES: Record<string, { title: string; hard: boolean; family: Family }> = {
  'RC-01': { title: 'Tool is not in the role contract allowlist', hard: true, family: 'contract' },
  'RC-03': { title: 'Resource sensitivity exceeds the role ceiling', hard: true, family: 'contract' },
  'RC-05': { title: 'Forbidden action sequence', hard: true, family: 'contract' },
  'RC-07': { title: 'Egress destination is not in the approved list', hard: true, family: 'egress' },
  'RC-09': { title: 'Contract rate limit exceeded', hard: false, family: 'contract' },
  'TAINT-01': { title: 'Sensitive action follows untrusted input', hard: false, family: 'taint' },
  'DEL-01': { title: 'Low-trust agent triggered a higher-privilege action', hard: false, family: 'delegation' },
  'BASE-01': { title: 'Deviation from the frozen golden baseline', hard: false, family: 'behaviour' },
  'BASE-02': { title: 'Action sequence never seen in the baseline', hard: false, family: 'behaviour' },
  'ID-01': { title: 'Identity context mismatch (fingerprint / hour / no task)', hard: false, family: 'identity' },
};

/** Family weights (starting values from the solution report, "to be tuned"). */
export const FAMILY_WEIGHTS: Record<Family, number> = {
  contract: 0.9,
  egress: 0.8,
  taint: 0.7,
  delegation: 0.6,
  behaviour: 0.5,
  identity: 0.5,
};

export const FAMILY_LABEL: Record<Family, string> = {
  contract: 'Contract',
  egress: 'Sensitivity / Egress',
  taint: 'Taint',
  delegation: 'Delegation',
  behaviour: 'Behaviour',
  identity: 'Identity context',
};
