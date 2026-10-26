import { AnimatePresence, motion } from 'framer-motion';
import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import { useMemo } from 'react';
import { RiskGauge } from '../components/common/RiskGauge';
import { SignalList, TriadPanel } from '../components/common/Triad';
import { Pipeline, PipelineTrack, stageStates } from '../components/simulator/Pipeline';
import { Terminal } from '../components/simulator/Terminal';
import { ActionBadge, Badge, ScorePill, SensBadge, SimBadge, TrustBadge } from '../components/ui/Badges';
import { Button, Segmented, Toggle } from '../components/ui/Controls';
import { Card } from '../components/ui/Card';
import { Empty, Meta } from '../components/ui/Misc';
import { AGENT_NAME } from '../data/agents';
import { SCENARIOS } from '../data/scenarios';
import { useOpen } from '../hooks/useOpen';
import { isBlocking } from '../lib/riskScoring';
import { nextStep, pauseRun, resetRun, resumeRun, startScenario } from '../lib/simRunner';
import { cn, fmtTime } from '../lib/utils';
import { useSim } from '../store/useSim';
import { useStore } from '../store/useStore';
import { Radar } from 'lucide-react';

export default function LiveMonitor() {
  const sim = useSim();
  const prefs = useStore((s) => s.prefs);
  const setPrefs = useStore((s) => s.setPrefs);
  const events = useStore((s) => s.events);
  const { openEvent } = useOpen();
  const compiled = sim.compiled;
  const cs = compiled && sim.stepIndex >= 0 ? compiled.steps[sim.stepIndex] : undefined;
  const ev = cs?.focus?.event;
  const running = sim.status === 'running' || sim.status === 'paused' || sim.status === 'awaiting';
  const streamed = useMemo(() => events.filter((e) => e.run_key === 'M'), [events]);
  const states = stageStates(sim.stage, sim.decided, cs?.revealed ?? [], cs?.liveScore ?? 0, cs?.liveAction ?? 'allow', !!cs?.focus);
  const blocked = !!cs && sim.decided && isBlocking(cs.liveAction);
  const total = SCENARIOS.M.steps.length;
  const detecting = !!cs && !sim.decided && sim.stage >= 2 && sim.stage <= 4 && (cs.liveScore >= 35 || cs.revealed.some((s) => s.triggered));

  return (
    <div className="space-y-4">
      <Card bodyClassName="!p-3">
        <div className="flex flex-wrap items-center gap-3">
          {!running ? (
            <Button variant="primary" size="md" icon={Play} onClick={() => startScenario('M')}>{sim.status === 'done' && sim.scenarioId === 'M' ? 'Restart simulation' : 'Start simulation'}</Button>
          ) : sim.status === 'paused' ? (
            <Button variant="primary" size="md" icon={Play} onClick={resumeRun}>Resume</Button>
          ) : (
            <Button variant="neon" size="md" icon={Pause} onClick={pauseRun} disabled={sim.status === 'awaiting'}>Pause simulation</Button>
          )}
          {running && !prefs.autoPlay && <Button size="md" icon={SkipForward} disabled={sim.status !== 'awaiting'} onClick={nextStep}>Next event</Button>}
          <Button size="md" icon={RotateCcw} onClick={resetRun} disabled={sim.status === 'idle'}>Reset simulation</Button>
          <div className="ml-auto flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2"><span className="label">speed</span>
              <Segmented size="xs" value={prefs.speed} onChange={(v) => setPrefs({ speed: v })} options={[{ value: 0.5, label: '0.5×' }, { value: 1, label: '1×' }, { value: 2, label: '2×' }]} />
            </div>
            <div className="w-56"><Toggle checked={prefs.autoPlay} onChange={(v) => setPrefs({ autoPlay: v })} label="Automatic playback" /></div>
            <SimBadge />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-fg/10"><motion.div className="h-full bg-gradient-to-r from-neon to-brand" animate={{ width: sim.scenarioId === 'M' ? `${((sim.stepIndex + (sim.decided ? 1 : 0)) / total) * 100}%` : '0%' }} /></div>
          <span className="font-mono text-[11px] text-muted">{sim.scenarioId === 'M' ? `event ${Math.max(0, sim.stepIndex + 1)} / ${total}` : sim.scenarioId ? `scenario ${sim.scenarioId} streaming` : 'idle'}</span>
        </div>
      </Card>

      <Card title="Gateway pipeline" code="REQUEST_FLOW" icon={Radar} brackets glow={blocked ? 'danger' : detecting ? 'neon' : undefined}
        right={detecting ? <Badge tone="warn">detection in progress</Badge> : blocked ? <Badge tone="danger">blocked</Badge> : undefined}>
        <Pipeline states={states} outcomeLabel={blocked ? 'Blocked' : 'Allowed'} />
        <div className="mt-3"><PipelineTrack progress={sim.stage < 0 ? 0 : (sim.stage + (sim.decided ? 1 : 0.4)) / 7} blocked={blocked} /></div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card title="Intercepted tool call" code="CURRENT_CALL" icon={Radar} className={cn(blocked && 'glow-danger')}>
          {!ev ? <Empty icon={Radar} title="No call in flight" hint="Start the simulation to stream a controlled playlist of nine tool calls — mostly routine, three need attention." /> : (
            <AnimatePresence mode="wait">
              <motion.div key={ev.event_id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                  <Meta k="agent id" mono>{ev.agent_id}</Meta>
                  <Meta k="session id" mono>{ev.session_id}</Meta>
                  <Meta k="tool name" mono><span className="text-neon">{ev.tool}</span></Meta>
                  <div className="col-span-2 sm:col-span-3"><Meta k="requested action">{ev.action}</Meta></div>
                  <Meta k="target resource" mono>{ev.resource}</Meta>
                  <Meta k="resource sensitivity"><SensBadge s={ev.resource_sensitivity} /></Meta>
                  <Meta k="input provenance">{ev.input_taint.length ? <span className="flex flex-wrap items-center gap-1.5"><TrustBadge trust={ev.input_taint[0].trust} /><span className="break-all font-mono text-[11px]">{ev.input_taint[0].source}</span></span> : <span className="text-muted">trusted task input</span>}</Meta>
                  <div className="col-span-2 sm:col-span-2"><Meta k="behavioural deviation"><span className={cn(cs?.triad.routine.status === 'pass' && 'text-muted')}>{cs ? cs.triad.routine.summary : '—'}</span></Meta></div>
                  <Meta k="risk score">{sim.stage >= 4 || sim.decided ? <ScorePill score={cs?.liveScore ?? 0} /> : <span className="font-mono text-xs text-muted">computing…</span>}</Meta>
                  <Meta k="final decision">{sim.decided && cs ? <ActionBadge action={cs.liveAction} /> : <span className="font-mono text-xs text-muted">pending</span>}</Meta>
                  <Meta k="agent">{AGENT_NAME[ev.agent_id]}</Meta>
                </div>
                {cs && (sim.stage >= 1) && <TriadPanel triad={cs.triad} action={sim.decided ? cs.liveAction : undefined} compact />}
                {cs && cs.revealed.some((s) => s.triggered) && sim.stage >= 3 && <SignalList signals={cs.revealed} />}
              </motion.div>
            </AnimatePresence>
          )}
        </Card>

        <div className="space-y-4">
          <Card title="Risk score" code="SCORER" icon={Radar}><RiskGauge score={cs?.liveScore ?? 0} size={170} /><div className="mt-1 text-center">{cs && cs.liveScore > 0 ? <ActionBadge action={cs.liveAction} /> : <Badge>no signals</Badge>}</div></Card>
          <Terminal lines={sim.logs} running={sim.status === 'running'} className="h-[300px]" empty="$ start the simulation to stream gateway logs" />
        </div>
      </div>

      <Card title="Processed stream" code="DECISION_LOG" icon={Radar} bodyClassName="!p-0">
        {streamed.length === 0 ? <Empty title="No streamed events yet" hint="Events appear here and in the Overview feed as the simulation processes them." /> : (
          <ul className="divide-y divide-line/[0.06]">
            {[...streamed].sort((a, b) => b.ts - a.ts).map((e) => (
              <li key={e.event_id}>
                <button onClick={() => openEvent(e.event_id)} className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-neon/[0.06]">
                  <span className="w-16 shrink-0 font-mono text-[11px] text-muted">{fmtTime(e.ts)}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px]"><span className="font-medium">{AGENT_NAME[e.agent_id]}</span> <span className="text-muted">→</span> <span className="font-mono text-xs text-neon">{e.tool}</span> <span className="text-muted">{e.resource}</span></span>
                  <ScorePill score={e.decision.score} /><ActionBadge action={e.decision.action} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
