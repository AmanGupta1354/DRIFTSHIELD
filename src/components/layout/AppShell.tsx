import { MotionConfig, motion } from 'framer-motion';
import { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { useStore } from '../../store/useStore';
import { useUi } from '../../store/useUi';
import { AgentDrawer, AlertDrawer, EventDrawer } from '../common/Drawers';
import { SimBadge } from '../ui/Badges';
import { PageLoader } from '../ui/Misc';
import { ErrorBoundary } from './ErrorBoundary';
import { MobileNav, Sidebar } from './Sidebar';
import { Toasts } from './Toasts';
import { Topbar } from './Topbar';

export function AppShell() {
  const { pathname } = useLocation();
  const theme = useStore((s) => s.prefs.theme);
  const anim = useStore((s) => s.prefs.animations);
  const banner = useStore((s) => s.prefs.display.showSimBanner);
  const compactTables = useStore((s) => s.prefs.display.compactTables);
  const collapsed = useUi((s) => s.sidebarCollapsed);
  const focusSearch = useUi((s) => s.focusSearch);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-motion', anim);
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', theme === 'dark' ? '#07080c' : '#eef1f7');
  }, [theme, anim]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); focusSearch(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [focusSearch]);

  return (
    <MotionConfig reducedMotion={anim === 'reduced' ? 'always' : 'user'}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-neon focus:px-3 focus:py-2 focus:text-black">Skip to content</a>
      <Sidebar />
      <MobileNav />
      <div className={cn('min-h-full transition-[padding] duration-300', collapsed ? 'lg:pl-[92px]' : 'lg:pl-[264px]')}>
        <div className="mx-auto max-w-[1600px] px-4 pb-10 sm:px-6 lg:px-8">
          <Topbar />
          {banner && (
            <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-warn/25 bg-warn/[0.06] px-4 py-2 text-xs text-warn">
              <SimBadge />
              <span className="text-warn/90">Frontend-only prototype. All agents, events and risk scores are simulated; nothing is enforced outside this browser tab.</span>
            </div>
          )}
          <main id="main" tabIndex={-1} className={cn('outline-none', compactTables && 'compact')}>
            <motion.div key={pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: 'easeOut' }}>
              <ErrorBoundary resetKey={pathname}><Suspense fallback={<PageLoader />}><Outlet /></Suspense></ErrorBoundary>
            </motion.div>
          </main>
        </div>
      </div>
      <EventDrawer />
      <AlertDrawer />
      <AgentDrawer />
      <Toasts />
    </MotionConfig>
  );
}
