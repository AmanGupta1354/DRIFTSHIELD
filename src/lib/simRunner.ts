import { SCENARIOS, type ScenarioId } from '../data/scenarios';
import { useSim } from '../store/useSim';
import { useStore } from '../store/useStore';
import { useUi } from '../store/useUi';
import type { AgentState } from '../types';
import { alertFromEvent, compileScenario, stateFor, type CompiledStep } from './simulationEngine';

/**
 * Deterministic scenario playback. One run at a time; the same predefined steps every time.
 * Everything here mutates only the in-browser store — nothing contacts a real system.
 */

let token = 0;
let nextResolver: (() => void) | null = null;
const STAGE_MS = 340;
const HOLD_MS = 1500;
let logId = 0;

const sim = () => useSim.getState();
const app = () => useStore.getState();

async function sleep(ms: number, myToken: number) {
  let left = ms / app().prefs.speed;
  while (left > 0) {
    if (myToken !== token) return false;
    const chunk = Math.min(60, left);
    await new Promise((r) => setTimeout(r, chunk));
    if (sim().status !== 'paused') left -= chunk;
  }
  return myToken === token;
}

function pushLog(text: string, tone: 'safe' | 'info' | 'warn' | 'block') {
  useSim.setState((s) => ({ logs: [...s.logs, { id: ++logId, text, tone }].slice(-60) }));
}

function applySideEffects(id: ScenarioId, cs: CompiledStep, alertCounter: { n: number }) {
  const sc = SCENARIOS[id];
  const compiled = sim().compiled!;
  const now = Date.now();
  cs.emit.forEach((b, i) => app().commitEvent({ ...b.event, ts: now + i, run_key: id }));

  if (cs.spec.contain && app().prefs.autoContain) {
    const b = compiled.built[cs.spec.contain];
    const to = stateFor(b.decision.action) as AgentState | null;
    if (to) {
      app().containFromRun(
        id, b.event.agent_id, to,
        `${b.decision.action === 'block_quarantine' ? 'Blocked and quarantined' : 'Blocked'} ${b.event.tool} (score ${b.decision.score}): ${b.decision.signals.filter((s) => s.triggered).slice(0, 2).map((s) => s.title).join(' + ')}`,
        b.decision.score,
      );
    }
  }
  if (cs.spec.alert) {
    const b = compiled.built[cs.spec.alert];
    const ev = { ...b.event, ts: now, run_key: id };
    const idx = alertCounter.n++;
    const related = sc.events.map((e) => e.key).filter((k) => compiled.idOf[k]).map((k) => compiled.idOf[k]);
    const chainUpTo: string[] = [];
    let cur: string | null = ev.event_id;
    const byId = Object.fromEntries(Object.values(compiled.built).map((x) => [x.event.event_id, x.event]));
    while (cur && byId[cur]) {
      chainUpTo.unshift(cur);
      cur = byId[cur].parent_event_id;
    }
    void related;
    const alert = alertFromEvent(ev, b.decision.signals, {
      id: `ALR-${sc.alertBase + idx}`, title: sc.alertTitles[cs.spec.alert] ?? ev.explanation,
      category: sc.id === 'M' ? undefined : sc.category, run_key: id, relatedEventIds: chainUpTo,
    });
    app().addAlert(alert);
    if (app().prefs.notify.toasts && (alert.severity === 'critical' || alert.severity === 'high' || app().prefs.notify.medium)) {
      useUi.getState().push({ title: `${alert.severity.toUpperCase()} alert ${alert.id}`, body: alert.title, tone: alert.severity === 'critical' ? 'danger' : 'warn', severity: alert.severity });
    }
  }
}

async function playFrom(id: ScenarioId, startAt: number, myToken: number) {
  const compiled = sim().compiled!;
  const alertCounter = { n: compiled.steps.slice(0, startAt).filter((s) => s.spec.alert).length };
  for (let i = startAt; i < compiled.steps.length; i++) {
    if (myToken !== token) return;
    const cs = compiled.steps[i];
    useSim.setState({ stepIndex: i, stage: 0, decided: false, status: sim().status === 'paused' ? 'paused' : 'running' });
    cs.spec.log.slice(0, 1).forEach((l) => pushLog(l, cs.spec.tone));
    const focus = Math.max(0, cs.spec.stage);
    for (let s = 0; s <= focus; s++) {
      useSim.setState({ stage: s });
      if (!(await sleep(STAGE_MS + ((cs.spec.tone === 'block' || cs.liveScore >= 55) && s >= 2 && s <= 4 ? 420 : 0), myToken))) return;
      const line = cs.spec.log[s + 1];
      if (line && s < focus) pushLog(line, cs.spec.tone);
    }
    cs.spec.log.slice(Math.max(1, focus + 1)).forEach((l) => pushLog(l, cs.spec.tone));
    if (cs.focus && cs.liveScore > 0) {
      pushLog(`[score] ${cs.liveScore}/100 → ${cs.liveAction.toUpperCase()}`, cs.spec.tone);
    }
    applySideEffects(id, cs, alertCounter);
    useSim.setState({ decided: true });
    if (i === compiled.steps.length - 1) break;
    if (!(await sleep(HOLD_MS + (cs.spec.tone === 'block' || cs.liveScore >= 55 ? 900 : 0), myToken))) return;
    if (!app().prefs.autoPlay) {
      useSim.setState({ status: 'awaiting' });
      await new Promise<void>((r) => (nextResolver = r));
      nextResolver = null;
      if (myToken !== token) return;
      useSim.setState({ status: 'running' });
    }
  }
  if (myToken === token) useSim.setState({ status: 'done' });
}

export function startScenario(id: ScenarioId) {
  const st = app();
  token++;
  nextResolver?.();
  // a run is idempotent: wipe the previous run of the same scenario first
  (Object.keys(SCENARIOS) as ScenarioId[]).forEach((k) => st.clearRun(k));
  const compiled = compileScenario(id, { agents: app().agents, contracts: app().contracts, thresholds: app().prefs.thresholds });
  useSim.setState({ status: 'running', scenarioId: id, compiled, stepIndex: -1, stage: -1, logs: [], decided: false });
  pushLog(`$ driftshield run --scenario ${id} --simulate`, 'info');
  pushLog('[gateway] SIMULATION — no real systems are contacted', 'info');
  void playFrom(id, 0, token);
}

export function pauseRun() {
  if (sim().status === 'running' || sim().status === 'awaiting') useSim.setState({ status: 'paused' });
}
export function resumeRun() {
  if (sim().status === 'paused') useSim.setState({ status: nextResolver ? 'awaiting' : 'running' });
}
export function nextStep() {
  nextResolver?.();
}
export function resetRun() {
  token++;
  nextResolver?.();
  nextResolver = null;
  const id = sim().scenarioId;
  if (id) app().clearRun(id);
  useSim.setState({ status: 'idle', scenarioId: null, compiled: null, stepIndex: -1, stage: -1, logs: [], decided: false });
}
export function replayRun() {
  const id = sim().scenarioId;
  if (!id) return;
  resetRun();
  startScenario(id);
}

/** Clear every simulated run (used by the global demo reset). */
export function stopAndClearAll() {
  token++;
  nextResolver?.();
  nextResolver = null;
  useSim.setState({ status: 'idle', scenarioId: null, compiled: null, stepIndex: -1, stage: -1, logs: [], decided: false });
}
