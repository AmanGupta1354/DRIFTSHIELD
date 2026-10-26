export const chartTip = {
  contentStyle: {
    background: 'rgb(var(--bg2) / 0.95)',
    border: '1px solid rgb(var(--line) / 0.15)',
    borderRadius: 10,
    fontSize: 12,
    color: 'rgb(var(--fg))',
    boxShadow: '0 10px 30px -10px rgb(0 0 0 / 0.6)',
  },
  labelStyle: { color: 'rgb(var(--muted))', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 },
  itemStyle: { color: 'rgb(var(--fg))' },
  cursor: { stroke: 'rgb(var(--neon) / 0.4)', strokeDasharray: '3 3' },
} as const;
