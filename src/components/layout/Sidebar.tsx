import { motion } from 'framer-motion';
import { PanelLeftClose, PanelLeftOpen, ShieldCheck, X } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { useSim } from '../../store/useSim';
import { useStore } from '../../store/useStore';
import { useUi } from '../../store/useUi';
import { NAV } from './nav';

export function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-brand/40 bg-brand/10 glow-brand">
        <ShieldCheck size={21} className="text-brand" aria-hidden />
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-neon shadow-[0_0_8px_rgb(var(--neon))]" />
      </div>
      {!collapsed && (
        <div className="min-w-0 leading-tight">
          <div className="text-[15px] font-bold tracking-wide">Drift<span className="holo-text">Shield</span></div>
          <div className="label !text-[9.5px]">Agent Runtime Security</div>
        </div>
      )}
    </div>
  );
}

function RunIndicator({ collapsed }: { collapsed: boolean }) {
  const status = useSim((s) => s.status);
  const id = useSim((s) => s.scenarioId);
  const label = status === 'idle' ? 'Idle' : status === 'done' ? 'Complete' : status === 'paused' ? 'Paused' : status === 'awaiting' ? 'Awaiting step' : 'Running';
  const live = status === 'running' || status === 'awaiting';
  return (
    <div className={cn('rounded-xl border border-line/10 bg-bg/50 p-3', collapsed && 'p-2')} aria-live="polite">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok/70" />}
          <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', live ? 'bg-ok' : status === 'paused' ? 'bg-warn' : status === 'done' ? 'bg-neon' : 'bg-muted/60')} />
        </span>
        {!collapsed && <span className="font-mono text-[11px] uppercase tracking-widest">Demo {label}</span>}
      </div>
      {!collapsed && <div className="mt-1 font-mono text-[10.5px] text-muted">{id ? (id === 'M' ? 'live stream playlist' : `scenario ${id}`) : 'no scenario running'}</div>}
    </div>
  );
}

function Items({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const open = useStore((s) => s.alerts.filter((a) => a.status === 'open').length);
  return (
    <nav aria-label="Primary" className="flex flex-col gap-0.5">
      {NAV.map((n) => (
        <NavLink
          key={n.to} to={n.to} end={n.end} onClick={onNavigate} title={collapsed ? n.label : undefined}
          className={({ isActive }) =>
            cn(
              'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
              collapsed && 'justify-center px-0',
              isActive ? 'bg-neon/10 text-fg' : 'text-muted hover:bg-fg/5 hover:text-fg',
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && <motion.span layoutId="navActive" className="absolute left-0 top-1.5 h-[calc(100%-12px)] w-[3px] rounded-full bg-neon shadow-[0_0_10px_rgb(var(--neon))]" />}
              <n.icon size={17} className={cn('shrink-0', isActive && 'text-neon')} aria-hidden />
              {!collapsed && <span className="truncate">{n.label}</span>}
              {n.to === '/alerts' && open > 0 && (
                <span className={cn('ml-auto rounded-full bg-brand/90 px-1.5 font-mono text-[10px] font-semibold text-white', collapsed && 'absolute right-1 top-0.5 ml-0 px-1 text-[9px]')}>{open}</span>
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

export function Sidebar() {
  const collapsed = useUi((s) => s.sidebarCollapsed);
  const toggle = useUi((s) => s.toggleSidebar);
  return (
    <aside className={cn('glass fixed inset-y-3 left-3 z-40 hidden flex-col !rounded-2xl p-3 transition-[width] duration-300 lg:flex', collapsed ? 'w-[68px]' : 'w-[240px]')}>
      <div className={cn('mb-4 mt-1 px-1', collapsed && 'flex justify-center px-0')}><Logo collapsed={collapsed} /></div>
      <div className="min-h-0 flex-1 overflow-y-auto"><Items collapsed={collapsed} /></div>
      <div className="mt-3 space-y-2">
        <RunIndicator collapsed={collapsed} />
        <button onClick={toggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className="flex w-full items-center justify-center gap-2 rounded-lg border border-line/10 py-1.5 text-xs text-muted hover:text-fg">
          {collapsed ? <PanelLeftOpen size={15} /> : <><PanelLeftClose size={15} /> Collapse</>}
        </button>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const open = useUi((s) => s.mobileNav);
  const set = useUi((s) => s.setMobileNav);
  return (
    <>
      <motion.div
        className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm lg:hidden" initial={false}
        animate={{ opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none' }} onClick={() => set(false)}
      />
      <motion.aside
        className="glass fixed inset-y-0 left-0 z-[60] flex w-[270px] flex-col !rounded-none !rounded-r-2xl p-4 lg:hidden"
        initial={false} animate={{ x: open ? 0 : '-105%' }} transition={{ type: 'spring', stiffness: 400, damping: 40 }} aria-hidden={!open}
      >
        <div className="mb-4 flex items-center justify-between">
          <Logo />
          <button aria-label="Close menu" onClick={() => set(false)} className="rounded-lg p-2 text-muted hover:text-fg"><X size={18} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto"><Items collapsed={false} onNavigate={() => set(false)} /></div>
        <div className="mt-3"><RunIndicator collapsed={false} /></div>
      </motion.aside>
    </>
  );
}
