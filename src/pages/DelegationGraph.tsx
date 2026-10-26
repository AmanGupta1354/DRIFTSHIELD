import { motion } from 'framer-motion';
import { Crosshair, Maximize2, Minus, Network, Play, Plus, RotateCcw, Route } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '../components/ui/Card';
import { Badge, ScorePill } from '../components/ui/Badges';
import { Button, IconButton, Segmented, Select, Toggle } from '../components/ui/Controls';
import { Empty, Meta } from '../components/ui/Misc';
import { useOpen } from '../hooks/useOpen';
import { buildGraph, interestingSessions, NODE_H, NODE_W, type Dir, type GEdge, type GNode, type GState } from '../lib/graph';
import { startScenario } from '../lib/simRunner';
import { cn, fmtTime } from '../lib/utils';
import { useStore } from '../store/useStore';
import { useSim } from '../store/useSim';

const COLOR: Record<GState, string> = { normal: 'var(--neon)', untrusted: 'var(--warn)', suspicious: 'var(--brand)', blocked: 'var(--danger)' };
const LEGEND: [GState, string][] = [['normal', 'Normal activity'], ['untrusted', 'Untrusted input'], ['suspicious', 'Suspicious transition'], ['blocked', 'Blocked action']];

function edgePath(a: GNode, b: GNode, dir: Dir) {
  if (dir === 'TB') {
    const x1 = a.x + NODE_W / 2, y1 = a.y + NODE_H, x2 = b.x + NODE_W / 2, y2 = b.y;
    const dy = Math.max(30, (y2 - y1) / 2);
    return { d: `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`, mx: (x1 + x2) / 2, my: (y1 + y2) / 2 + 8 };
  }
  const x1 = a.x + NODE_W, y1 = a.y + NODE_H / 2, x2 = b.x, y2 = b.y + NODE_H / 2;
  const dx = Math.max(40, (x2 - x1) / 2);
  return { d: `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`, mx: (x1 + x2) / 2, my: (y1 + y2) / 2 };
}

export default function DelegationGraph() {
  const events = useStore((s) => s.events);
  const { openEvent } = useOpen();
  const sim = useSim();
  const sessions = useMemo(() => interestingSessions(events), [events]);
  const [session, setSession] = useState<string>('');
  const [highlight, setHighlight] = useState(true);
  const [sel, setSel] = useState<{ type: 'node'; id: string } | { type: 'edge'; id: string } | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const wrap = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  // default: the live scenario E session if present, else the richest recorded session
  useEffect(() => {
    if (session && sessions.some((s) => s.id === session)) return;
    const pick = sessions.find((s) => s.id === 'ses_sim_E') ?? sessions[0];
    if (pick) setSession(pick.id);
  }, [sessions, session]);
  const runE = sim.scenarioId === 'E' && sim.status !== 'idle';
  useEffect(() => { if (runE && sessions.some((s) => s.id === 'ses_sim_E')) setSession('ses_sim_E'); }, [runE, sessions]);

  const [dirPref, setDirPref] = useState<'auto' | Dir>('auto');
  const [box, setBox] = useState({ w: 800, h: 560 });
  const lr = useMemo(() => buildGraph(events, session ? [session] : [], 'LR'), [events, session]);
  const tb = useMemo(() => buildGraph(events, session ? [session] : [], 'TB'), [events, session]);
  const fitK = (g: { W: number; H: number }) => Math.min(box.w / g.W, box.h / g.H);
  const graph = dirPref === 'LR' ? lr : dirPref === 'TB' ? tb : fitK(tb) > fitK(lr) * 1.05 ? tb : lr;
  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);

  const fit = useCallback(() => {
    const el = wrap.current;
    if (!el || !graph.nodes.length) return;
    const { width, height } = el.getBoundingClientRect();
    setBox({ w: width, h: height });
    const k = Math.min(1.2, Math.max(0.3, Math.min(width / graph.W, height / graph.H)));
    setView({ k, x: (width - graph.W * k) / 2, y: (height - graph.H * k) / 2 });
  }, [graph]);
  useEffect(() => { const t = setTimeout(fit, 30); return () => clearTimeout(t); }, [fit, session, graph.dir]);
  useEffect(() => { window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit); }, [fit]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top;
      setView((v) => {
        const k = Math.min(2.5, Math.max(0.3, v.k * (e.deltaY < 0 ? 1.1 : 0.9)));
        return { k, x: px - ((px - v.x) / v.k) * k, y: py - ((py - v.y) / v.k) * k };
      });
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, []);

  const zoom = (f: number) => setView((v) => {
    const el = wrap.current!.getBoundingClientRect();
    const k = Math.min(2.5, Math.max(0.3, v.k * f));
    const cx = el.width / 2, cy = el.height / 2;
    return { k, x: cx - ((cx - v.x) / v.k) * k, y: cy - ((cy - v.y) / v.k) * k };
  });

  const selNode = sel?.type === 'node' ? byId.get(sel.id) : undefined;
  const selEdge = sel?.type === 'edge' ? graph.edges.find((e) => e.id === sel.id) : undefined;
  const selEvent = selEdge ? events.find((e) => e.event_id === selEdge.eventId) : undefined;
  const hasPath = graph.edges.some((e) => e.onPath);
  const dim = (onPath: boolean) => highlight && hasPath && !onPath;
  const info = sessions.find((s) => s.id === session);

  return (
    <div className="space-y-4">
      <Card bodyClassName="!p-3">
        <div className="flex flex-wrap items-end gap-4">
          <Select className="w-64" label="Session" value={session} onChange={(v) => { setSession(v); setSel(null); }}
            options={sessions.length ? sessions.map((s) => ({ value: s.id, label: `${s.id} · ${s.events.length} ev${s.blocked ? ' · blocked' : ''}${s.chain > 1 ? ` · ${s.chain}-agent chain` : ''}` })) : [{ value: '', label: 'no sessions' }]} />
          <Toggle checked={highlight} onChange={setHighlight} label="Highlight attack path" />
          <div><div className="label mb-1 !text-[9.5px]">Layout</div><Segmented size="xs" value={dirPref} onChange={setDirPref} options={[{ value: 'auto', label: 'Auto' }, { value: 'LR', label: '→' }, { value: 'TB', label: '↓' }]} /></div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button variant="primary" icon={Play} onClick={() => { setSession('ses_sim_E'); startScenario('E'); }}>Run scenario E live</Button>
            <IconButton icon={Plus} label="Zoom in" onClick={() => zoom(1.2)} />
            <IconButton icon={Minus} label="Zoom out" onClick={() => zoom(1 / 1.2)} />
            <IconButton icon={Maximize2} label="Fit to screen" onClick={fit} />
            <IconButton icon={RotateCcw} label="Reset graph" onClick={() => { setSel(null); setHighlight(true); fit(); }} />
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card title="Causal delegation graph" code="PROVENANCE" icon={Network} bodyClassName="!p-0" right={<div className="hidden items-center gap-3 sm:flex">{LEGEND.map(([s, l]) => <span key={s} className="flex items-center gap-1.5 text-[10.5px] text-muted"><span className="h-2 w-2 rounded-full" style={{ background: `rgb(${COLOR[s]})` }} />{l}</span>)}</div>}>
          <div
            ref={wrap}
            className="relative h-[560px] cursor-grab touch-none overflow-hidden active:cursor-grabbing"
            onPointerDown={(e) => { if ((e.target as Element).closest('[data-node],[data-edge]')) return; drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
            onPointerMove={(e) => { const d = drag.current; if (d) setView((v) => ({ ...v, x: d.vx + e.clientX - d.x, y: d.vy + e.clientY - d.y })); }}
            onPointerUp={() => (drag.current = null)}
            onClick={(e) => { if (!(e.target as Element).closest('[data-node],[data-edge]')) setSel(null); }}
          >
            {graph.nodes.length === 0 ? <Empty icon={Network} title="No session selected" hint="Run scenario E to watch the delegation chain being built." /> : (
              <svg className="h-full w-full" role="img" aria-label="Delegation graph">
                <defs>
                  {(Object.keys(COLOR) as GState[]).map((s) => (
                    <marker key={s} id={`arrow-${s}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill={`rgb(${COLOR[s]})`} /></marker>
                  ))}
                </defs>
                <g style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, transformOrigin: '0 0', transition: drag.current ? 'none' : 'transform .25s ease' }}>
                  {graph.edges.map((ed: GEdge) => {
                    const a = byId.get(ed.from), b = byId.get(ed.to);
                    if (!a || !b) return null;
                    const p = edgePath(a, b, graph.dir);
                    const c = `rgb(${COLOR[ed.state]})`;
                    const active = sel?.type === 'edge' && sel.id === ed.id;
                    return (
                      <motion.g key={ed.id} data-edge initial={{ opacity: 0 }} animate={{ opacity: dim(ed.onPath) ? 0.18 : 1 }} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setSel({ type: 'edge', id: ed.id }); }}>
                        <path d={p.d} fill="none" stroke="transparent" strokeWidth={16} />
                        <path d={p.d} fill="none" stroke={c} strokeWidth={ed.onPath ? 3 : active ? 2.8 : 1.6} strokeDasharray={ed.dashed ? '4 6' : undefined} markerEnd={`url(#arrow-${ed.state})`}
                          className={cn(!ed.dashed && (ed.onPath || ed.state === 'blocked' || ed.state === 'suspicious') && 'edge-flow')} style={{ filter: ed.onPath ? `drop-shadow(0 0 5px ${c})` : undefined }} />
                        <g transform={`translate(${p.mx}, ${p.my - 8})`}><rect x={-ed.label.length * 3.2 - 6} y={-9} width={ed.label.length * 6.4 + 12} height={18} rx={6} fill="rgb(var(--bg2) / 0.9)" stroke={c} strokeOpacity={0.4} /><text textAnchor="middle" y={4} fontSize={10} fontFamily="JetBrains Mono, monospace" fill={c}>{ed.label}</text></g>
                      </motion.g>
                    );
                  })}
                  {graph.nodes.map((n) => {
                    const c = `rgb(${COLOR[n.state]})`;
                    const active = sel?.type === 'node' && sel.id === n.id;
                    return (
                      <motion.g key={n.id} data-node initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: dim(n.onPath) ? 0.25 : 1, scale: 1, x: n.x, y: n.y }} transition={{ duration: 0.35 }} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); setSel({ type: 'node', id: n.id }); }}>
                        <rect width={NODE_W} height={NODE_H} rx={12} fill="rgb(var(--panel) / 0.85)" stroke={c} strokeWidth={active || n.onPath ? 2 : 1.2} style={{ filter: n.state === 'blocked' || n.onPath ? `drop-shadow(0 0 8px ${c})` : undefined }} />
                        {n.state === 'blocked' && <rect width={NODE_W} height={NODE_H} rx={12} fill={c} fillOpacity={0.12} />}
                        <text x={14} y={22} fontSize={9.5} fontFamily="JetBrains Mono, monospace" fill={c} letterSpacing={1.4}>{n.kind === 'doc' ? 'UNTRUSTED DOC' : n.kind === 'blocked' ? 'BLOCKED OP' : n.kind === 'root' ? 'ROOT PRINCIPAL' : n.kind === 'resource' ? 'TARGET' : 'AGENT'}</text>
                        <text x={14} y={41} fontSize={13} fontWeight={600} fill="rgb(var(--fg))">{n.label.length > 24 ? n.label.slice(0, 23) + '…' : n.label}</text>
                        <text x={14} y={57} fontSize={10} fontFamily="JetBrains Mono, monospace" fill="rgb(var(--muted))">{n.sub.length > 28 ? n.sub.slice(0, 27) + '…' : n.sub}</text>
                      </motion.g>
                    );
                  })}
                </g>
              </svg>
            )}
            <div className="pointer-events-none absolute bottom-2 left-3 font-mono text-[10px] text-muted">scroll to zoom · drag to pan · click a node or edge</div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card title="Inspector" code="NODE_EDGE_DETAIL" icon={Crosshair}>
            {selNode ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">{selNode.label}</h3><Badge tone={selNode.state === 'blocked' ? 'danger' : selNode.state === 'suspicious' ? 'brand' : selNode.state === 'untrusted' ? 'warn' : 'neon'}>{selNode.state}</Badge></div>
                <Meta k="kind">{selNode.kind}</Meta><Meta k="identifier" mono>{selNode.sub}</Meta>
                {Object.entries(selNode.meta).map(([k, v]) => <Meta key={k} k={k} mono={k !== 'action'}>{v}</Meta>)}
                {selNode.kind === 'blocked' && selNode.meta.event && <Button size="sm" variant="neon" onClick={() => openEvent(selNode.meta.event)}>Open blocked event</Button>}
              </div>
            ) : selEdge && selEvent ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Edge · {selEdge.label}</h3><ScorePill score={selEvent.decision.score} /></div>
                <p className="text-xs text-muted">This relationship was established by event:</p>
                <Meta k="event" mono>{selEvent.event_id}</Meta><Meta k="time">{fmtTime(selEvent.ts)}</Meta><Meta k="tool" mono>{selEvent.tool}</Meta><Meta k="action">{selEvent.action}</Meta>
                <Meta k="decision">{selEvent.decision.action} · {selEvent.explanation}</Meta>
                <Button size="sm" variant="neon" onClick={() => openEvent(selEvent.event_id)}>Open event investigation</Button>
              </div>
            ) : <p className="py-6 text-center text-xs text-muted">Select a node to see its metadata, or an edge to see the event that created the relationship.</p>}
          </Card>
          <Card title="Attack path" code="ROOT_CAUSE" icon={Route}>
            {hasPath ? (
              <ol className="space-y-1.5 text-xs">
                {graph.nodes.filter((n) => n.onPath).sort((a, b) => a.x - b.x).map((n, i) => (
                  <li key={n.id} className="flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-full border border-danger/40 bg-danger/10 font-mono text-[10px] text-danger">{i + 1}</span><span className="truncate">{n.label}</span><span className="ml-auto font-mono text-[10px] text-muted">{n.kind}</span></li>
                ))}
              </ol>
            ) : <p className="text-xs text-muted">No blocked operation in this session, so there is no attack path to trace.</p>}
            {info && <p className="mt-3 border-t border-line/[0.07] pt-2 font-mono text-[10.5px] text-muted">{info.events.length} events in {info.id}</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
