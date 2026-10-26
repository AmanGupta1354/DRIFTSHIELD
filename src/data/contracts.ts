import type { ContractBody, ContractVersion, Role, RoleContract } from '../types';

const D = 86_400_000;
// Contract dates are fixed offsets from "seed time" so the demo looks the same on every reset.
const seedNow = () => Date.now();

function v(
  version: string, status: ContractVersion['status'], daysAgo: number, author: string, notes: string, body: ContractBody,
): ContractVersion {
  return { version, status, date: seedNow() - daysAgo * D, author, notes, body };
}

const base = (b: Partial<ContractBody> & Pick<ContractBody, 'allowedTools' | 'maxSensitivity'>): ContractBody => ({
  approvedEgress: [],
  rateLimit: { callsPerMinute: 60, sensitivePerHour: 20 },
  approvalRequirements: [],
  forbiddenSequences: [],
  ...b,
});

export function buildContracts(): RoleContract[] {
  const proc: ContractBody = base({
    allowedTools: ['catalog.search', 'catalog.read', 'pricing.compare', 'purchase_request.create'],
    maxSensitivity: 'internal',
    approvedEgress: ['api.approved-suppliers.example', 'mail.corp.example'],
    rateLimit: { callsPerMinute: 40, sensitivePerHour: 10 },
    approvalRequirements: ['purchase_request.create above ₹5,00,000 needs manager approval', 'Any restricted scope needs human approval'],
    forbiddenSequences: [
      { first: 'catalog.read', then: 'http.post', reason: 'Catalogue read followed by an external send' },
      { first: 'pricing.compare', then: 'hr_db.query', reason: 'Procurement must never reach HR data' },
    ],
  });
  const res: ContractBody = base({
    allowedTools: ['web.search', 'web.read', 'documents.read'],
    maxSensitivity: 'internal',
    approvedEgress: [],
    rateLimit: { callsPerMinute: 90, sensitivePerHour: 5 },
    approvalRequirements: ['Delegating web-derived content to a confidential-ceiling agent needs approval'],
    forbiddenSequences: [{ first: 'web.read', then: 'hr.records.read', reason: 'Web content must not drive HR reads' }],
  });
  const hr: ContractBody = base({
    allowedTools: ['hr.records.read', 'hr.reports.generate'],
    maxSensitivity: 'confidential',
    approvedEgress: ['mail.corp.example', 'hrportal.corp.example'],
    rateLimit: { callsPerMinute: 30, sensitivePerHour: 15 },
    approvalRequirements: ['Any restricted (salary) scope needs human approval', 'Bulk export above 500 rows needs HR Director sign-off'],
    forbiddenSequences: [{ first: 'hr.records.read', then: 'http.post', reason: 'HR read followed by an external send' }],
  });
  const fin: ContractBody = base({
    allowedTools: ['finance.read', 'invoice.validate', 'report.generate'],
    maxSensitivity: 'confidential',
    approvedEgress: ['mail.corp.example', 'bank-gw.approved.example'],
    rateLimit: { callsPerMinute: 30, sensitivePerHour: 12 },
    approvalRequirements: ['Payments above ₹10,00,000 need dual approval'],
    forbiddenSequences: [{ first: 'finance.read', then: 'http.post', reason: 'Financial read followed by an external send' }],
  });
  const orch: ContractBody = base({
    allowedTools: ['agent.delegate', 'workflow.read', 'task.status'],
    maxSensitivity: 'internal',
    approvedEgress: [],
    rateLimit: { callsPerMinute: 120, sensitivePerHour: 0 },
    approvalRequirements: ['Delegation of web- or document-derived instructions to HR/Finance needs approval'],
    forbiddenSequences: [{ first: 'agent.delegate', then: 'hr_db.query', reason: 'Orchestrator must not touch HR data directly' }],
  });

  const mk = (id: string, role: Role, title: string, history: ContractVersion[]): RoleContract => ({
    id, role, title, activeVersion: history[history.length - 1].version, versions: history,
  });

  return [
    mk('rc_procurement', 'procurement', 'Procurement Role Contract', [
      v('1.0.0', 'superseded', 120, 'sec-platform', 'Initial contract from warm-up baseline.', { ...proc, allowedTools: ['catalog.search', 'catalog.read', 'purchase_request.create'], rateLimit: { callsPerMinute: 60, sensitivePerHour: 20 }, forbiddenSequences: [] }),
      v('1.1.0', 'superseded', 61, 'm.kulkarni', 'Added pricing.compare for quote analysis.', { ...proc, forbiddenSequences: [proc.forbiddenSequences[0]] }),
      v('1.2.0', 'active', 18, 'sec-platform', 'Tightened rate limit; forbade HR reach-through.', proc),
    ]),
    mk('rc_research', 'research', 'Research Role Contract', [
      v('1.0.0', 'superseded', 98, 'sec-platform', 'Initial contract.', { ...res, forbiddenSequences: [], rateLimit: { callsPerMinute: 120, sensitivePerHour: 10 } }),
      v('1.1.0', 'active', 34, 'k.nair', 'Web-derived delegation requires approval.', res),
    ]),
    mk('rc_hr', 'hr', 'HR Role Contract', [
      v('1.0.0', 'superseded', 140, 'sec-platform', 'Initial contract.', { ...hr, approvalRequirements: ['Any restricted (salary) scope needs human approval'], forbiddenSequences: [] }),
      v('2.0.0', 'active', 22, 'hr.director', 'Added bulk-export sign-off and external-send sequence block.', hr),
    ]),
    mk('rc_finance', 'finance', 'Finance Role Contract', [
      v('1.0.0', 'superseded', 150, 'sec-platform', 'Initial contract.', { ...fin, forbiddenSequences: [], approvedEgress: ['mail.corp.example'] }),
      v('1.3.0', 'active', 27, 'cfo.office', 'Added bank gateway egress and sequence rule.', fin),
    ]),
    mk('rc_orchestrator', 'orchestrator', 'Orchestrator Role Contract', [
      v('1.0.0', 'superseded', 75, 'sec-platform', 'Initial contract.', { ...orch, approvalRequirements: [], forbiddenSequences: [] }),
      v('1.1.0', 'active', 12, 'sec-platform', 'Delegation to confidential-ceiling agents now needs approval when input is untrusted.', orch),
    ]),
  ];
}

export function activeBody(c: RoleContract): ContractBody {
  return (c.versions.find((x) => x.version === c.activeVersion) ?? c.versions[c.versions.length - 1]).body;
}

export const ROLE_LABEL: Record<Role, string> = {
  procurement: 'Procurement', research: 'Research', hr: 'HR', finance: 'Finance', orchestrator: 'Orchestrator',
};
