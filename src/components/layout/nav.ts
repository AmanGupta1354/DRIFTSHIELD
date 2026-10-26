import { Bot, Crosshair, Database, FileLock2, History, LayoutDashboard, Link2, Network, Radar, Settings, ShieldAlert, type LucideIcon } from 'lucide-react';

export interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean }

export const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/dashboard/monitor', label: 'Live Monitor', icon: Radar },
  { to: '/dashboard/fleet', label: 'Agent Fleet', icon: Bot },
  { to: '/dashboard/simulator', label: 'Attack Simulator', icon: Crosshair },
  { to: '/dashboard/alerts', label: 'Security Alerts', icon: ShieldAlert },
  { to: '/dashboard/timeline', label: 'Event Timeline', icon: History },
  { to: '/dashboard/graph', label: 'Delegation Graph', icon: Network },
  { to: '/dashboard/contracts', label: 'Role Contracts', icon: FileLock2 },
  { to: '/dashboard/resources', label: 'Resource Catalogue', icon: Database },
  { to: '/dashboard/audit', label: 'Audit Trail', icon: Link2 },
  { to: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export const titleFor = (path: string) =>
  NAV.find((n) => (n.end ? path === n.to || path === n.to + '/' : path.startsWith(n.to)))?.label ?? 'DriftShield';
