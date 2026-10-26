import { Bot, Crosshair, Database, FileLock2, History, LayoutDashboard, Link2, Network, Radar, Settings, ShieldAlert, type LucideIcon } from 'lucide-react';

export interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean }

export const NAV: NavItem[] = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/monitor', label: 'Live Monitor', icon: Radar },
  { to: '/fleet', label: 'Agent Fleet', icon: Bot },
  { to: '/simulator', label: 'Attack Simulator', icon: Crosshair },
  { to: '/alerts', label: 'Security Alerts', icon: ShieldAlert },
  { to: '/timeline', label: 'Event Timeline', icon: History },
  { to: '/graph', label: 'Delegation Graph', icon: Network },
  { to: '/contracts', label: 'Role Contracts', icon: FileLock2 },
  { to: '/resources', label: 'Resource Catalogue', icon: Database },
  { to: '/audit', label: 'Audit Trail', icon: Link2 },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export const titleFor = (path: string) =>
  NAV.find((n) => (n.end ? path === n.to : path.startsWith(n.to)))?.label ?? 'DriftShield';
