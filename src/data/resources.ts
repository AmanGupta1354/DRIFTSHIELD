import type { Resource } from '../types';

export const RESOURCES: Resource[] = [
  {
    id: 'res_product_catalog', name: 'Public product catalogue', kind: 'data', tools: ['catalog.search'],
    sensitivity: 'public', owner: 'Procurement Operations', approvedRoles: ['procurement', 'research', 'orchestrator'],
    destinationTrust: 'n/a', policies: [], note: 'Publicly published SKUs and list prices.',
  },
  {
    id: 'res_supplier_directory', name: 'Internal supplier directory', kind: 'data', tools: ['catalog.read'],
    sensitivity: 'internal', owner: 'Procurement Operations', approvedRoles: ['procurement'],
    destinationTrust: 'n/a', policies: ['RC-01'], note: 'Vetted supplier contacts and onboarding status.',
  },
  {
    id: 'res_supplier_uploads', name: 'Supplier-submitted documents', kind: 'source', tools: ['catalog.read'],
    sensitivity: 'internal', owner: 'Procurement Operations', approvedRoles: ['procurement'],
    destinationTrust: 'untrusted-source', policies: ['TAINT-01'],
    note: 'PDFs uploaded by external suppliers. Content is always tagged UNTRUSTED by the taint tracker.',
  },
  {
    id: 'res_pricing_engine', name: 'Pricing comparison service', kind: 'data', tools: ['pricing.compare'],
    sensitivity: 'internal', owner: 'Procurement Operations', approvedRoles: ['procurement'],
    destinationTrust: 'n/a', policies: [], note: 'Computes quote comparisons across suppliers.',
  },
  {
    id: 'res_purchase_requests', name: 'Internal purchase requests', kind: 'data', tools: ['purchase_request.create'],
    sensitivity: 'internal', owner: 'Finance Controls', approvedRoles: ['procurement'],
    destinationTrust: 'n/a', policies: ['RC-09'], note: 'Draft purchase requests awaiting manager approval.',
  },
  {
    id: 'res_web_public', name: 'Open web (search + pages)', kind: 'source', tools: ['web.search', 'web.read'],
    sensitivity: 'public', owner: 'Security Engineering', approvedRoles: ['research'],
    destinationTrust: 'untrusted-source', policies: ['TAINT-01'],
    note: 'Everything fetched from the open web is tagged UNTRUSTED.',
  },
  {
    id: 'res_doc_library', name: 'Shared document library', kind: 'data', tools: ['documents.read'],
    sensitivity: 'internal', owner: 'Knowledge Management', approvedRoles: ['research'],
    destinationTrust: 'n/a', policies: [], note: 'Internal policy documents and research notes.',
  },
  {
    id: 'res_workflow_registry', name: 'Workflow & task registry', kind: 'data', tools: ['workflow.read', 'task.status', 'agent.delegate'],
    sensitivity: 'internal', owner: 'Platform Engineering', approvedRoles: ['orchestrator'],
    destinationTrust: 'n/a', policies: ['DEL-01'], note: 'Task graph used to delegate work between agents.',
  },
  {
    id: 'res_fin_reports', name: 'Confidential financial reports', kind: 'data', tools: ['finance.read', 'report.generate'],
    sensitivity: 'confidential', owner: 'CFO Office', approvedRoles: ['finance'],
    destinationTrust: 'n/a', policies: ['RC-03', 'RC-07'], note: 'Quarterly P&L, cash-flow and forecast reports.',
  },
  {
    id: 'res_invoice_store', name: 'Invoice store', kind: 'data', tools: ['invoice.validate'],
    sensitivity: 'confidential', owner: 'Accounts Payable', approvedRoles: ['finance'],
    destinationTrust: 'n/a', policies: ['RC-03'], note: 'Supplier invoices and bank details.',
  },
  {
    id: 'res_hr_reports', name: 'Confidential HR reports', kind: 'data', tools: ['hr.records.read', 'hr.reports.generate'],
    sensitivity: 'confidential', owner: 'HR Director', approvedRoles: ['hr'],
    destinationTrust: 'n/a', policies: ['RC-03'], note: 'Headcount, attrition and engagement reports.',
  },
  {
    id: 'res_hr_salaries', name: 'Restricted salary records', kind: 'data', tools: ['hr_db.query', 'hr.export'],
    sensitivity: 'restricted', owner: 'HR Director', approvedRoles: [],
    destinationTrust: 'n/a', policies: ['RC-01', 'RC-03', 'TAINT-01'],
    note: 'Individual compensation. No agent role is approved; human approval only.',
  },
  {
    id: 'res_supplier_api', name: 'Approved supplier API', kind: 'destination', tools: ['http.post'],
    sensitivity: 'internal', owner: 'Procurement Operations', approvedRoles: ['procurement'],
    destinationTrust: 'approved-external', endpoint: 'api.approved-suppliers.example', policies: ['RC-07'],
    note: 'Contracted supplier ordering endpoint, on the egress allowlist.',
  },
  {
    id: 'res_internal_mail', name: 'Internal mail relay', kind: 'destination', tools: ['email.send'],
    sensitivity: 'internal', owner: 'IT Operations', approvedRoles: ['procurement', 'finance', 'hr'],
    destinationTrust: 'internal', endpoint: 'mail.corp.example', policies: ['RC-07'],
    note: 'Corporate mail relay. Internal recipients only.',
  },
  {
    id: 'res_ext_unapproved', name: 'External HTTP destinations (unapproved)', kind: 'destination', tools: ['http.post'],
    sensitivity: 'public', owner: 'Security Engineering', approvedRoles: [],
    destinationTrust: 'unapproved-external', endpoint: 'files.unvetted-share.example', policies: ['RC-07'],
    note: 'Any host that is not on a role egress allowlist (paste sites, file shares, unknown collectors).',
  },
];

export const RESOURCE_BY_ID = Object.fromEntries(RESOURCES.map((r) => [r.id, r]));

export function resourceForTool(tool: string): Resource | undefined {
  return RESOURCES.find((r) => r.tools.includes(tool) && r.kind !== 'destination');
}
