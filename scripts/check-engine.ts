import { buildAgents } from '../src/data/agents';
import { buildContracts } from '../src/data/contracts';
import { SCENARIOS, type ScenarioId } from '../src/data/scenarios';
import { DEFAULT_THRESHOLDS } from '../src/lib/riskScoring';
import { compileScenario } from '../src/lib/simulationEngine';

const ctx = { agents: buildAgents(), contracts: buildContracts(), thresholds: DEFAULT_THRESHOLDS };
for (const id of Object.keys(SCENARIOS) as ScenarioId[]) {
  const c = compileScenario(id, ctx);
  console.log(`\n== ${id} ${SCENARIOS[id].title}`);
  for (const [k, b] of Object.entries(c.built)) {
    console.log(`  ${k} ${b.event.event_id} ${b.event.tool.padEnd(24)} score=${String(b.decision.score).padStart(3)} ${b.decision.action} [${b.event.signals.map((s) => s.detector + ':' + s.value.toFixed(2)).join(' ')}]`);
  }
}
