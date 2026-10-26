import { create } from 'zustand';
import type { ScenarioId } from '../data/scenarios';
import type { CompiledScenario } from '../lib/simulationEngine';

export interface LogLine {
  id: number;
  text: string;
  tone: 'safe' | 'info' | 'warn' | 'block';
}

export type SimStatus = 'idle' | 'running' | 'paused' | 'awaiting' | 'done';

interface SimState {
  status: SimStatus;
  scenarioId: ScenarioId | null;
  compiled: CompiledScenario | null;
  stepIndex: number;
  stage: number;
  logs: LogLine[];
  /** set once the policy-enforcement stage of the current step has produced its decision */
  decided: boolean;
  set: (p: Partial<SimState>) => void;
}

export const useSim = create<SimState>((set) => ({
  status: 'idle',
  scenarioId: null,
  compiled: null,
  stepIndex: -1,
  stage: -1,
  logs: [],
  decided: false,
  set: (p) => set(p),
}));
