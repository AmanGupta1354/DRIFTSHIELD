// Shared domain types for the DriftShield frontend prototype.
// Everything here describes SIMULATED data — nothing is measured or enforced for real.

export type Sensitivity = 'public' | 'internal' | 'confidential' | 'restricted';
export const SENSITIVITY_ORDER: Sensitivity[] = ['public', 'internal', 'confidential', 'restricted'];
export const sensRank = (s: Sensitivity) => SENSITIVITY_ORDER.indexOf(s);

export type Role = 'procurement' | 'research' | 'hr' | 'finance' | 'orchestrator';
export type Trust = 'trusted' | 'untrusted';
export type Severity = 'informational' | 'low' | 'medium' | 'high' | 'critical';
export type EnforcementAction = 'allow' | 'watch' | 'step_up' | 'block' | 'block_quarantine';
export type AgentState = 'active' | 'watched' | 'paused' | 'quarantined' | 'isolated';
export type TrustTier = 1 | 2 | 3;

/** The three questions behind the USP. */
export type Lane = 'role' | 'reason' | 'routine';
export type LaneStatus = 'pass' | 'warn' | 'fail';

/** Evidence families — only the strongest signal inside a family counts. */
export type Family = 'contract' | 'egress' | 'taint' | 'delegation' | 'behaviour' | 'identity';

export type DetectorKind =
  | 'role_violation'
  | 'taint_match'
  | 'behavioural_deviation'
  | 'sequence_anomaly'
  | 'rate_anomaly'
  | 'rare_tool'
  | 'unapproved_destination'
  | 'delegation_anomaly'
  | 'identity_context';

export type ThreatCategory =
  | 'role_violation'
  | 'taint'
  | 'behavioural_drift'
  | 'unapproved_destination'
  | 'unusual_sequence'
  | 'delegation_anomaly';

export interface Signal {
  detector: DetectorKind;
  family: Family;
  lane: Lane;
  triggered: boolean;
  /** normalised strength 0..1 */
  value: number;
  /** family weight used by the scoring function */
  weight: number;
  hard: boolean;
  policyId?: string;
  title: string;
  explanation: string;
}

export interface TaintTag {
  source: string;
  trust: Trust;
  hops?: number;
}

export interface BehaviourFeatures {
  /** 0 = routine resource, 1 = never seen in the baseline */
  resourceNovelty: number;
  /** P(tool | previous tool) in the agent baseline */
  bigramProb: number;
  /** baseline share of this tool in the agent's calls (0..1) */
  toolShare: number;
  /** rate z-score against the baseline */
  rateZ: number;
  /** Jensen–Shannon divergence against the frozen golden baseline */
  jsDivergence: number;
  /** CUSUM statistic on the sensitive-resource share */
  cusum: number;
  newFingerprint: boolean;
  offHours: boolean;
  noParentTask: boolean;
  /** observed calls per minute (compared to the contract rate limit) */
  callsPerMinute?: number;
}

export interface ToolCallInput {
  agentId: string;
  role: Role;
  tool: string;
  action: string;
  resourceId: string;
  /** sensitivity of the resource touched by this call */
  sensitivity: Sensitivity;
  /** classification of the data the call carries out of the system (egress) */
  payloadSensitivity?: Sensitivity;
  destination?: { host: string; approved: boolean };
  taint: TaintTag[];
  parentEventId: string | null;
  rootPrincipal: string;
  delegationChain: string[];
  delegateTo?: string;
  prevTool?: string;
  /** trust tier of the acting agent, and of the lowest-trust agent in its delegation chain */
  actorTier: TrustTier;
  originTier: TrustTier;
  features: BehaviourFeatures;
}

export interface TriadLane {
  status: LaneStatus;
  summary: string;
}
export type Triad = Record<Lane, TriadLane>;

export interface Decision {
  score: number;
  severity: Severity;
  action: EnforcementAction;
  hardViolation: boolean;
  explanation: string;
  signals: Signal[];
  triad: Triad;
}

export interface SecEvent {
  event_id: string;
  ts: number;
  agent_id: string;
  role: Role;
  session_id: string;
  parent_event_id: string | null;
  tool: string;
  action: string;
  resource: string;
  resource_id: string;
  resource_sensitivity: Sensitivity;
  input_taint: TaintTag[];
  destination?: string;
  delegate_to?: string;
  root_principal: string;
  delegation_chain: string[];
  decision: { score: number; severity: Severity; action: EnforcementAction };
  explanation: string;
  signals: Signal[];
  triad: Triad;
  hard_violation: boolean;
  enforced: boolean;
  run_key?: string;
}

export type AlertStatus = 'open' | 'acknowledged' | 'closed';

export interface Alert {
  id: string;
  ts: number;
  agentId: string;
  category: ThreatCategory;
  title: string;
  score: number;
  severity: Severity;
  status: AlertStatus;
  summary: string;
  explanation: string;
  signalTitles: string[];
  violatedPolicies: { id: string; text: string }[];
  taintInfo: string;
  behaviouralDeviations: string[];
  eventIds: string[];
  triad: Triad;
  detected: string[];
  recommended: string;
  enforced: string;
  /** true only when the simulated gateway actually withheld the operation */
  actuallyBlocked: boolean;
  recommendedResponse: string[];
  mitre: string;
  owasp: string;
  run_key?: string;
}

export interface BaselineProfile {
  sessions: number;
  goldenVersion: string;
  callsPerMinute: number;
  toolShare: Record<string, number>;
  sensitiveShareGolden: number;
  sensitiveShareRolling: number;
  jsDivergence: number;
}

export interface ContainmentEntry {
  id: string;
  ts: number;
  from: AgentState;
  to: AgentState;
  by: string;
  note: string;
  run_key?: string;
}

export interface Agent {
  id: string;
  name: string;
  role: Role;
  owner: string;
  state: AgentState;
  trustTier: TrustTier;
  risk: number;
  lastSeen: number;
  lastSuspicious?: string;
  baseline: BaselineProfile;
  containment: ContainmentEntry[];
}

export type ContractStatus = 'active' | 'draft' | 'pending_approval' | 'approved' | 'superseded';

export interface ForbiddenSequence {
  first: string;
  then: string;
  reason: string;
}

export interface ContractBody {
  allowedTools: string[];
  maxSensitivity: Sensitivity;
  approvedEgress: string[];
  rateLimit: { callsPerMinute: number; sensitivePerHour: number };
  approvalRequirements: string[];
  forbiddenSequences: ForbiddenSequence[];
}

export interface ContractVersion {
  version: string;
  status: ContractStatus;
  date: number;
  author: string;
  notes: string;
  body: ContractBody;
}

export interface RoleContract {
  id: string;
  role: Role;
  title: string;
  /** version currently enforced */
  activeVersion: string;
  versions: ContractVersion[];
}

export interface Resource {
  id: string;
  name: string;
  kind: 'data' | 'destination' | 'source';
  tools: string[];
  sensitivity: Sensitivity;
  owner: string;
  approvedRoles: Role[];
  destinationTrust: 'n/a' | 'internal' | 'approved-external' | 'unapproved-external' | 'untrusted-source';
  endpoint?: string;
  policies: string[];
  note: string;
}

export interface Thresholds {
  allow: number; // below -> allow
  watch: number; // below -> watch
  stepUp: number; // below -> step-up approval
  block: number; // below -> block operation; at/above -> pause/quarantine
}

export interface Prefs {
  theme: 'dark' | 'light';
  animations: 'full' | 'reduced';
  autoPlay: boolean;
  speed: 0.5 | 1 | 2;
  notify: { critical: boolean; high: boolean; medium: boolean; toasts: boolean };
  thresholds: Thresholds;
  display: { compactTables: boolean; showSimBanner: boolean; showLaneHints: boolean };
  autoContain: boolean;
}

export interface Notification {
  id: string;
  ts: number;
  title: string;
  body: string;
  severity: Severity;
  alertId?: string;
  read: boolean;
}

export type StageKey = 'request' | 'identity' | 'taint' | 'drift' | 'score' | 'policy' | 'outcome';
