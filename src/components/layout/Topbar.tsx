import { Bell, LogOut, Moon, RotateCcw, Search, Sun } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AGENT_NAME } from '../../data/agents';
import { RESOURCES } from '../../data/resources';
import { stopAndClearAll } from '../../lib/simRunner';
import { ago, cn } from '../../lib/utils';
import { useAuth } from '../../lib/auth';
import { useStore } from '../../store/useStore';
import { useUi } from '../../store/useUi';
import { SeverityBadge, SimBadge } from '../ui/Badges';
import { IconButton } from '../ui/Controls';
import { ConfirmDialog } from '../ui/Overlays';
import { NAV, titleFor } from './nav';

interface Hit { kind: string; label: string; sub: string; go: () => void }

function GlobalSearch() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  const tick = useUi((s) => s.searchFocusTick);
  const { agents, alerts, events } = useStore();

  useEffect(() => { if (tick) ref.current?.focus(); }, [tick]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const hits = useMemo<Hit[]>(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    const out: Hit[] = [];
    const done = () => { setOpen(false); setQ(''); };
    NAV.filter((n) => n.label.toLowerCase().includes(s)).forEach((n) => out.push({ kind: 'page', label: n.label, sub: n.to, go: () => { nav(n.to); done(); } }));
    agents.filter((a) => (a.name + a.id + a.role).toLowerCase().includes(s)).slice(0, 4).forEach((a) => out.push({ kind: 'agent', label: a.name, sub: a.id, go: () => { nav(`/dashboard/fleet?agent=${a.id}`); done(); } }));
    alerts.filter((a) => (a.title + a.id + a.category).toLowerCase().includes(s)).slice(0, 4).forEach((a) => out.push({ kind: 'alert', label: a.title, sub: a.id, go: () => { nav(`/dashboard/alerts?alert=${a.id}`); done(); } }));
    events.filter((e) => (e.event_id + e.tool + e.resource + e.action).toLowerCase().includes(s)).slice(0, 4).forEach((e) => out.push({ kind: 'event', label: `${e.tool} → ${e.resource}`, sub: e.event_id, go: () => { nav(`/dashboard/timeline?event=${e.event_id}`); done(); } }));
    RESOURCES.filter((r) => (r.name + r.id).toLowerCase().includes(s)).slice(0, 3).forEach((r) => out.push({ kind: 'resource', label: r.name, sub: r.id, go: () => { nav(`/dashboard/resources?res=${r.id}`); done(); } }));
    return out.slice(0, 12);
  }, [q, agents, alerts, events, nav]);

  return (
    <div ref={box} className="relative w-full max-w-md">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
      <input
        ref={ref} value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Enter' && hits[0]) hits[0].go(); if (e.key === 'Escape') { setOpen(false); (e.target as HTMLInputElement).blur(); } }}
        placeholder="Search agents, alerts, events…" aria-label="Global search" className="input !pl-9 !pr-14"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-line/15 px-1.5 py-0.5 font-mono text-[10px] text-muted sm:block">⌘K</kbd>
      {open && q && (
        <div className="glass absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto p-1.5">
          {hits.length === 0 ? <p className="px-3 py-4 text-center text-xs text-muted">No matches for “{q}”.</p> : hits.map((h, i) => (
            <button key={i} onClick={h.go} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-neon/10">
              <span className="w-14 shrink-0 font-mono text-[10px] uppercase tracking-wider text-neon/80">{h.kind}</span>
              <span className="min-w-0 flex-1 truncate text-[13px]">{h.label}</span>
              <span className="shrink-0 font-mono text-[10.5px] text-muted">{h.sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Notifications() {
  const [open, setOpen] = useState(false);
  const items = useStore((s) => s.notifications);
  const mark = useStore((s) => s.markNotificationsRead);
  const unread = items.filter((n) => !n.read).length;
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div ref={box} className="relative">
      <div className="relative">
        <IconButton icon={Bell} label="Notifications" onClick={() => { setOpen(!open); if (!open) setTimeout(mark, 1200); }} />
        {unread > 0 && <span className="pointer-events-none absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 font-mono text-[9px] font-bold text-white">{unread}</span>}
      </div>
      {open && (
        <div className="glass absolute right-0 top-full z-50 mt-2 w-[min(92vw,360px)] p-2">
          <div className="label px-2 py-1.5">// notifications</div>
          {items.length === 0 ? <p className="px-3 py-6 text-center text-xs text-muted">No notifications yet. Start an attack scenario to generate alerts.</p> : (
            <ul className="max-h-80 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <Link to={n.alertId ? `/dashboard/alerts?alert=${n.alertId}` : '/dashboard/alerts'} onClick={() => setOpen(false)} className={cn('block rounded-lg px-3 py-2 hover:bg-neon/10', !n.read && 'bg-brand/5')}>
                    <div className="flex items-center justify-between gap-2"><SeverityBadge severity={n.severity} /><span className="font-mono text-[10.5px] text-muted">{ago(n.ts)}</span></div>
                    <p className="mt-1 text-xs">{n.title}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function Topbar() {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const theme = useStore((s) => s.prefs.theme);
  const setTheme = useStore((s) => s.setThemeMode);
  const resetData = useStore((s) => s.resetData);
  const setMobile = useUi((s) => s.setMobileNav);
  const mobile = useUi((s) => s.mobileNav);
  const push = useUi((s) => s.push);
  const [confirm, setConfirm] = useState(false);
  const signOut = useAuth((s) => s.signOut);

  return (
    <>
      <header className="sticky top-0 z-30 -mx-4 mb-4 border-b border-line/[0.06] bg-bg/60 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex items-center gap-3">
          <button className="grid h-9 w-9 place-items-center rounded-lg border border-line/10 lg:hidden" aria-label={mobile ? 'Close menu' : 'Open menu'} aria-expanded={mobile} onClick={() => setMobile(!mobile)}>
            <span className="relative block h-3.5 w-4">
              <span className={cn('absolute left-0 top-0 h-0.5 w-4 rounded bg-fg transition-all', mobile && 'top-1.5 rotate-45')} />
              <span className={cn('absolute left-0 top-1.5 h-0.5 w-4 rounded bg-fg transition-all', mobile && 'opacity-0')} />
              <span className={cn('absolute left-0 top-3 h-0.5 w-4 rounded bg-fg transition-all', mobile && 'top-1.5 -rotate-45')} />
            </span>
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold leading-tight">{titleFor(pathname)}</h1>
          </div>
          <div className="ml-auto hidden flex-1 justify-center px-4 md:flex"><GlobalSearch /></div>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <SimBadge className="hidden sm:inline-flex" />
            <Notifications />
            <IconButton icon={theme === 'dark' ? Sun : Moon} label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
            <IconButton icon={RotateCcw} label="Reset demo" onClick={() => setConfirm(true)} />
            <div className="hidden items-center gap-2 border-l border-line/10 pl-3 xl:flex">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-neon to-brand text-[11px] font-bold text-black">SA</span>
              <div className="leading-tight"><div className="text-xs font-medium">Security Analyst</div><div className="font-mono text-[10px] text-muted">demo session</div></div>
            </div>
            <IconButton icon={LogOut} label="Sign out" onClick={() => { signOut(); nav('/login'); }} />
          </div>
        </div>
        <div className="mt-3 md:hidden"><GlobalSearch /></div>
      </header>
      <ConfirmDialog
        open={confirm} onClose={() => setConfirm(false)} title="Reset the demo?" confirmLabel="Reset demo" tone="danger"
        onConfirm={() => { stopAndClearAll(); resetData(); push({ title: 'Demo reset', body: 'Seed data restored', tone: 'ok' }); }}
      >
        <p>This stops any running scenario and restores agents, alerts, events, role contracts and counters to the original demo state. Your theme and preferences are kept.</p>
      </ConfirmDialog>
    </>
  );
}

export { AGENT_NAME };
