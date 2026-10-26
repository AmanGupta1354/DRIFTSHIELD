import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DriftMetric } from '../../data/scenarios';
import { chartTip } from '../charts/common';

export function DriftChart({ data }: { data: DriftMetric[] }) {
  return (
    <div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: -18, right: 8, top: 8 }}>
            <CartesianGrid stroke="rgb(var(--line) / 0.07)" vertical={false} />
            <XAxis dataKey="session" tick={{ fill: 'rgb(var(--muted))', fontSize: 11 }} axisLine={false} tickLine={false} label={{ value: 'session', position: 'insideBottomRight', offset: -2, fill: 'rgb(var(--muted))', fontSize: 10 }} />
            <YAxis tick={{ fill: 'rgb(var(--muted))', fontSize: 11 }} axisLine={false} tickLine={false} unit="%" domain={[0, 24]} />
            <Tooltip {...chartTip} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine y={8} stroke="rgb(var(--warn) / 0.5)" strokeDasharray="4 4" label={{ value: 'drift tolerance', fill: 'rgb(var(--warn))', fontSize: 10, position: 'insideTopLeft' }} />
            <Line name="Golden (frozen)" dataKey="golden" stroke="rgb(var(--ok))" strokeWidth={2} dot={false} />
            <Line name="Rolling (gated)" dataKey="rolling" stroke="rgb(var(--neon))" strokeWidth={2} dot={{ r: 2 }} />
            <Line name="Actual sensitive share" dataKey="naive" stroke="rgb(var(--danger))" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-[11px] text-muted">Sensitive-resource share of calls. The rolling profile follows only slowly (max shift per day), while drift is always measured against the frozen golden profile.</p>
    </div>
  );
}
