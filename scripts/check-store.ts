import { SCENARIOS } from '../src/data/scenarios';
import { compileScenario } from '../src/lib/simulationEngine';
import { useStore } from '../src/store/useStore';

const st = () => useStore.getState();
const before = JSON.stringify(st().agents);
const ev0 = st().events.length;
for (const id of ['A', 'E'] as const) {
  const c = compileScenario(id, { agents: st().agents, contracts: st().contracts, thresholds: st().prefs.thresholds });
  Object.values(c.built).forEach((b, i) => st().commitEvent({ ...b.event, ts: Date.now() + i, run_key: id }));
  const last = Object.values(c.built).pop()!;
  st().containFromRun(id, last.event.agent_id, 'quarantined', 'test', last.decision.score);
  console.log(id, 'agent', last.event.agent_id, st().agents.find((a) => a.id === last.event.agent_id)!.state, st().agents.find((a) => a.id === last.event.agent_id)!.risk);
}
st().clearRun('A');
st().clearRun('E');
const after = st().agents; JSON.parse(before).forEach((a: any, i: number) => { for (const k of Object.keys(a)) if (JSON.stringify(a[k]) !== JSON.stringify((after[i] as any)[k])) console.log('diff', a.id, k); });
console.log('events restored:', st().events.length === ev0, 'agents restored:', JSON.stringify(st().agents) === before);
void SCENARIOS;
