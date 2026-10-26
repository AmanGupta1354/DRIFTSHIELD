import { lazy } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { Button } from './components/ui/Controls';
import { Empty } from './components/ui/Misc';

const Overview = lazy(() => import('./pages/Overview'));
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

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Overview />} />
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
        <Route
          path="*"
          element={<Empty title="404 — route not found" hint="That page does not exist in this prototype." action={<Link to="/"><Button variant="neon">Back to overview</Button></Link>} />}
        />
      </Route>
    </Routes>
  );
}
