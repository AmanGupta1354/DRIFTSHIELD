import { lazy, Suspense, useEffect } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { PublicLayout } from './components/layout/PublicLayout';
import { RequireAuth } from './components/layout/RequireAuth';
import { Button } from './components/ui/Controls';
import { Empty, PageLoader } from './components/ui/Misc';
import { useStore } from './store/useStore';

const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const LiveMonitor = lazy(() => import('./pages/LiveMonitor'));
const AgentFleet = lazy(() => import('./pages/AgentFleet'));
const AttackSimulator = lazy(() => import('./pages/AttackSimulator'));
const Alerts = lazy(() => import('./pages/Alerts'));
const Timeline = lazy(() => import('./pages/Timeline'));
const DelegationGraph = lazy(() => import('./pages/DelegationGraph'));
const RoleContracts = lazy(() => import('./pages/RoleContracts'));
const Resources = lazy(() => import('./pages/Resources'));
const Audit = lazy(() => import('./pages/Audit'));
const Settings = lazy(() => import('./pages/Settings'));

const LEGACY = ['monitor', 'fleet', 'simulator', 'alerts', 'timeline', 'graph', 'contracts', 'resources', 'audit', 'settings'];

export default function App() {
  const theme = useStore((s) => s.prefs.theme);
  const anim = useStore((s) => s.prefs.animations);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-motion', anim);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#07080c' : '#eef1f7');
  }, [theme, anim]);

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<PublicLayout />}><Route index element={<Landing />} /></Route>
        <Route path="login" element={<Login />} />
        <Route path="dashboard" element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route index element={<Dashboard />} />
          <Route path="monitor" element={<LiveMonitor />} />
          <Route path="fleet" element={<AgentFleet />} />
          <Route path="simulator" element={<AttackSimulator />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="timeline" element={<Timeline />} />
          <Route path="graph" element={<DelegationGraph />} />
          <Route path="contracts" element={<RoleContracts />} />
          <Route path="resources" element={<Resources />} />
          <Route path="audit" element={<Audit />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Empty title="Page not found" hint="That dashboard page does not exist." action={<Link to="/dashboard"><Button variant="neon">Back to overview</Button></Link>} />} />
        </Route>
        {LEGACY.map((p) => <Route key={p} path={p} element={<Navigate to={`/dashboard/${p}`} replace />} />)}
        <Route path="*" element={<div className="grid min-h-full place-items-center"><Empty title="404 — page not found" action={<Link to="/"><Button variant="neon">Back to home</Button></Link>} /></div>} />
      </Routes>
    </Suspense>
  );
}
