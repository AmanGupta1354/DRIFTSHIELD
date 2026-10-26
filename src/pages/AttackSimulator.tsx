import { motion } from 'framer-motion';
import { Activity, Brain, FileSearch, Network, Pause, Play, RotateCcw, Repeat, ShieldCheck, SkipForward, Siren, Swords } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CausalChain } from '../components/common/CausalChain';
import { RiskGauge } from '../components/common/RiskGauge';
import { TriadPanel } from '../components/common/Triad';
import { XaiPanel } from '../components/common/XaiPanel';
import { Pipeline, PipelineTrack, stageStates } from '../components/simulator/Pipeline';
import { Terminal } from '../components/simulator/Terminal';
import { DriftChart } from '../components/simulator/DriftChart';
import { ActionBadge, Badge, SimBadge } from '../components/ui/Badges';
import { Button, Toggle } from '../components/ui/Controls';
import { Card } from '../components/ui/Card';
import { Collapse } from '../components/ui/Misc';
import { SCENARIO_LIST, SCENARIOS, type DriftMetric, type ScenarioId } from '../data/scenarios';
import { useOpen } from '../hooks/useOpen';
import { categoryLabel, compileScenario } from '../lib/simulationEngine';
import { nextStep, pauseRun, replayRun, resetRun, resumeRun, startScenario } from '../lib/simRunner';
import { isBlocking } from '../lib/riskScoring';
import { narrateStep, STAGE_TITLE } from '../lib/xai';
import { TONE, cn } from '../lib/utils';
import { useSim } from '../store/useSim';
import { useStore } from '../store/useStore';

const TONE_STEP = { safe: 'ok', info: 'neon', warn: 'warn', block: 'danger' } as const;

export default function AttackSimulator() {
  const sim = useSim();
  const autoPlay = useStore((s) => s.prefs.autoPlay);
  const setPrefs = useStore((s) => s.setPrefs);
  const { openEvent, openAlert } = useOpen();
  const [picked, setPicked] = useState<ScenarioId>('E');
  const listRef = useRef<HTMLOListElement>(null);
  const running = sim.status === 'running' || sim.status === 'paused' || sim.status === 'awaiting';
  const id = (sim.scenarioId && sim.scenarioId !== 'M' ? sim.scenarioId : picked) as Exclude<ScenarioId, 'M'>;
  const spec = SCENARIOS[id];
  const live = sim.scenarioId === id ? sim.compiled : null;

  // before a run starts, preview the compiled scenario (so the step list is visible)
  const preview = useMemo(() => {
    const st = useStore.getState();
    return compileScenario(id, { agents: st.agents, contracts: st.contracts, thresholds: st.prefs.thresholds });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const compiled = live ?? preview;
  const cs = live && sim.stepIndex >= 0 ? compiled.steps[sim.stepIndex] : undefined;

  useEffect(() => {
    const el = listRef.current;
    const cur = el?.querySelector<HTMLElement>('[data-current="1"]');
    if (el && cur) el.scrollTo({ top: cur.offsetTop - el.clientHeight / 3, behavior: 'smooth' });
  }, [sim.stepIndex]);

  useEffect(() => {
    if (sim.scenarioId === 'M' && sim.status !== 'idle') resetRun();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finalStep = compiled.steps[compiled.steps.length - 1];
  const finalEvent = finalStep.focus?.event;
  const finalAlertId = useStore((s) => s.alerts.find((a) => a.run_key === id)?.id);
  const done = sim.status === 'done' && sim.scenarioId === id;
  const allEvents = useStore((s) => s.events);
  const emittedIds = useMemo(() => new Set(allEvents.filter((e) => e.run_key === id).map((e) => e.event_id)), [allEvents, id]);

  const states = stageStates(
    sim.stage, sim.decided, cs?.revealed ?? [], cs?.liveScore ?? 0, cs?.liveAction ?? 'allow', !!cs?.focus,
  );
  const decisionAction = cs?.liveAction ?? 'allow';
  const finalNow = !!cs && sim.decided && !!cs.spec.focus && !!cs.spec.emit?.includes(cs.spec.focus);
  const finalAlert = useStore((s) => s.alerts.find((a) => a.run_key === id));
  const blockedNow = !!cs && sim.decided && isBlocking(decisionAction) && !!cs.spec.emit?.length;

  const metrics = compiled.steps.slice(0, Math.max(0, sim.stepIndex + 1)).map((s) => s.spec.metrics).filter(Boolean) as DriftMetric[];

  return (
    <div className="space-y-4">
      {/* USP strip */}
      <div className="grid gap-3 md:grid-cols-3">
        {[
          { l: 'ROLE', q: 'Allowed for this role?', i: ShieldCheck, c: 'neon' },
          { l: 'REASON', q: 'Why is it acting now?', i: Brain, c: 'holo' },
          { l: 'ROUTINE', q: 'Normal for this agent?', i: Activity, c: 'brand' },
        ].map((x) => (
          <div key={x.l} className="glass flex items-center gap-3 px-4 py-3">
            <span className={cn('grid h-9 w-9 place-items-center rounded-lg border', TONE[x.c as 'neon'].border, TONE[x.c as 'neon'].bg, TONE[x.c as 'neon'].text)}><x.i size={17} /></span>
            <div><div className={cn('font-mono text-xs font-semibold tracking-[0.2em]', TONE[x.c as 'neon'].text)}>{x.l}</div><div className="text-xs text-muted">{x.q}</div></div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[330px_minmax(0,1fr)]">
        {/* scenario selector */}
        <div className="space-y-3">
          <Card title="Scenarios" code="ATTACK_LIBRARY" icon={Swords} right={<SimBadge />} bodyClassName="space-y-2 !p-3">
            {SCENARIO_LIST.map((s) => {
              const active = s.id === id;
              return (
                <button
                  key={s.id}
                  onClick={() => { if (running) resetRun(); else if (sim.status === 'done') resetRun(); setPicked(s.id as Exclude<ScenarioId, 'M'>); }}
                  aria-pressed={active}
                  className={cn('group relative flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all', active ? 'border-neon/50 bg-neon/10 glow-neon' : 'border-line/10 bg-bg/40 hover:border-neon/30')}
                >
                  <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg border font-mono text-sm font-bold', active ? 'border-neon/60 text-neon' : 'border-line/15 text-muted')}>{s.id}</span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold leading-tight">{s.title}</span>
                    <span className="mt-0.5 block text-[11px] text-muted">{s.subtitle}</span>
                    {s.id === 'E' && <Badge tone="brand" className="mt-1.5">Differentiator</Badge>}
                  </span>
                </button>
              );
            })}
          </Card>

          <Card title="Scenario controls" code="CONTROLS" icon={Play} bodyClassName="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {!running ? (
                <Button variant="primary" size="md" icon={Play} className="col-span-2" onClick={() => startScenario(id)}>
                  {done ? 'Run again' : 'Start attack'}
                </Button>
              ) : sim.status === 'paused' ? (
                <Button variant="primary" size="md" icon={Play} onClick={resumeRun}>Resume</Button>
              ) : (
                <Button variant="neon" size="md" icon={Pause} onClick={pauseRun} disabled={sim.status === 'awaiting'}>Pause</Button>
              )}
              {running && (
                <Button size="md" icon={SkipForward} disabled={sim.status !== 'awaiting'} onClick={nextStep}>Next step</Button>
              )}
              <Button icon={RotateCcw} disabled={sim.status === 'idle'} onClick={resetRun}>Reset</Button>
              <Button icon={Repeat} disabled={!sim.scenarioId} onClick={replayRun}>Replay</Button>
              <Button icon={FileSearch} disabled={!done || !finalEvent} onClick={() => finalEvent && openEvent(finalEvent.event_id)}>View evidence</Button>
              <Button icon={Siren} disabled={!done || !finalAlertId} onClick={() => finalAlertId && openAlert(finalAlertId)}>Open investigation</Button>
            </div>
            <Toggle checked={autoPlay} onChange={(v) => setPrefs({ autoPlay: v })} label="Auto-play" description="Off: advance each step yourself with “Next step”." />
            <p className="text-[11px] text-muted">Deterministic and repeatable. Nothing leaves your browser.</p>
          </Card>
        </div>

        {/* stage */}
        <div className="min-w-0 space-y-4">
          <Card title={`Scenario ${spec.id} — ${spec.title}`} code={spec.category.toUpperCase()} icon={Swords} right={<Badge tone="holo">{categoryLabel(spec.category)}</Badge>}>
            <p className="text-[13px] text-muted">{spec.description}</p>
            <Collapse title="Initial conditions">
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {spec.initialState.map((s) => (
                  <li key={s} className="flex items-start gap-2 text-xs text-muted"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-neon" />{s}</li>
                ))}
              </ul>
            </Collapse>
          </Card>

          <Card title="Gateway pipeline" code="DRIFTSHIELD_PIPELINE" icon={ShieldCheck} brackets right={sim.status !== 'idle' && sim.scenarioId === id ? <Badge tone={sim.status === 'done' ? 'neon' : sim.status === 'paused' ? 'warn' : 'ok'} dot>{sim.status}</Badge> : <Badge tone="muted">ready</Badge>}>
            <Pipeline states={states} outcomeLabel={blockedNow || (done && isBlocking(decisionAction)) ? 'Blocked' : 'Allowed'} />
            <div className="mt-3"><PipelineTrack progress={sim.stage < 0 ? 0 : (sim.stage + (sim.decided ? 1 : 0.4)) / 7} blocked={blockedNow} /></div>
            {cs && (
              <motion.div key={sim.stepIndex} initial={{ opacity: 0.4, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-lg border border-neon/25 bg-neon/[0.06] px-4 py-3">
                <div className="flex flex-wrap items-center gap-2"><Badge tone="neon">XAI · {STAGE_TITLE[cs.spec.stage]}</Badge><span className="text-[13px] font-semibold">{cs.spec.title}</span></div>
                <p className="mt-1.5 text-[13px] leading-relaxed">{narrateStep(cs, sim.decided)}</p>
              </motion.div>
            )}
            {(blockedNow || (done && isBlocking(finalEvent?.decision.action ?? 'allow'))) && (
              <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="mt-4 rounded-xl border border-danger/50 bg-danger/10 px-4 py-3 text-center font-mono text-[13px] font-semibold tracking-wider text-danger glow-danger">
                {spec.headline}
              </motion.div>
            )}
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Attack sequence" code="STEP_TIMELINE" icon={Activity} bodyClassName="!p-0">
              <ol ref={listRef} className="max-h-[560px] overflow-y-auto p-3">
                {compiled.steps.map((s, i) => {
                  const state = !live ? 'pending' : i < sim.stepIndex ? 'done' : i === sim.stepIndex ? 'current' : 'pending';
                  const t = TONE[TONE_STEP[s.spec.tone]];
                  return (
                    <li key={i} data-current={state === 'current' ? '1' : undefined} className={cn('relative flex gap-3 rounded-lg px-2 py-2 transition-colors', state === 'current' && 'bg-fg/[0.05]')}>
                      <div className="flex flex-col items-center">
                        <span className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-full border font-mono text-[10px] font-semibold', state === 'pending' ? 'border-line/15 text-muted' : cn(t.border, t.bg, t.text), state === 'current' && 'animate-pulse')}>{i + 1}</span>
                        {i < compiled.steps.length - 1 && <span className={cn('mt-1 w-px flex-1', state === 'done' ? 'bg-neon/40' : 'bg-line/10')} />}
                      </div>
                      <div className="min-w-0 pb-2">
                        <div className={cn('text-[13px] font-medium leading-tight', state === 'pending' && 'text-muted')}>{s.spec.title}</div>
                        {(state === 'current' || state === 'done') && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1 text-xs leading-relaxed text-muted">{s.spec.detail}</motion.p>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Card>

            <div className="flex min-w-0 flex-col gap-4">
              <Card title="Live risk" code="RISK_SCORE" icon={Activity} glow={blockedNow ? 'danger' : undefined}>
                <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 sm:flex-nowrap">
                  <div className="w-[190px] shrink-0"><RiskGauge score={cs?.liveScore ?? 0} size={190} /></div>
                  <div className="min-w-0 space-y-2 text-center sm:text-left">
                    <div className="flex flex-wrap justify-center gap-2 sm:justify-start">{cs && cs.liveScore > 0 ? <ActionBadge action={cs.liveAction} /> : <Badge>awaiting evidence</Badge>}{cs?.hard && <Badge tone="danger">hard violation</Badge>}</div>
                    <p className="text-[11px] text-muted">Illustrative score from configured mock signals.</p>
                  </div>
                </div>
              </Card>
              <Terminal lines={sim.scenarioId === id ? sim.logs : []} running={sim.status === 'running'} empty="$ press “Start attack” to run the simulation" className="h-[340px] flex-1" />
            </div>
          </div>

          <Card title="Role · Reason · Routine" icon={Brain} bodyClassName="space-y-4">
            {cs ? (
              <>
                <TriadPanel triad={cs.triad} action={finalNow ? cs.liveAction : undefined} compact />
                {cs.focus ? <XaiPanel event={cs.focus.event} alert={finalNow ? finalAlert : undefined} signals={finalNow ? undefined : cs.revealed} pending={!finalNow} live /> : null}
              </>
            ) : <p className="py-6 text-center text-xs text-muted">Start the scenario to see the evidence and its explanation.</p>}
          </Card>

          {id === 'D' && metrics.length > 0 && (
            <Card title="Drift vs frozen golden baseline" code="BASELINE_DRIFT" icon={Activity}>
              <DriftChart data={metrics} />
              <div className="mt-2 flex flex-wrap gap-4 font-mono text-[11px] text-muted"><span>JS divergence: <b className="text-fg">{metrics[metrics.length - 1].js.toFixed(2)}</b></span><span>CUSUM: <b className="text-fg">{metrics[metrics.length - 1].cusum.toFixed(1)}</b></span></div>
            </Card>
          )}

          {(done || (live && emittedIds.size > 0)) && finalEvent && (
            <Card title="Investigation — causal chain" code="CAUSAL_CHAIN" icon={Network} right={id === 'E' ? <Link to="/dashboard/graph"><Button size="xs" variant="neon" icon={Network}>Open delegation graph</Button></Link> : undefined}>
              <CausalChain leafId={finalEvent.event_id} />
              {!emittedIds.has(finalEvent.event_id) && <p className="mt-2 text-xs text-muted">The chain completes when the final operation reaches enforcement.</p>}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
