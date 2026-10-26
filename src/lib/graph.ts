import { AGENT_NAME } from '../data/agents';
import type { SecEvent } from '../types';
import { isBlocking } from './riskScoring';

export type GState = 'normal' | 'untrusted' | 'suspicious' | 'blocked';
export type GKind = 'root' | 'agent' | 'doc' | 'resource' | 'blocked';

export interface GNode {
  id: string; kind: GKind; label: string; sub: string; state: GState; onPath: boolean;
  meta: Record<string, string>; x: number; y: number;
}
export interface GEdge { id: string; from: string; to: string; eventId: string; label: string; state: GState; onPath: boolean; dashed?: boolean }
export type Dir = 'LR' | 'TB';
export interface Graph { nodes: GNode[]; edges: GEdge[]; W: number; H: number; dir: Dir }

export const NODE_W = 196;
export const NODE_H = 66;

/** Sessions worth showing in the filter: anything with delegation, taint or a block. */
export function interestingSessions(events: SecEvent[]) {
  const by = new Map<string, SecEvent[]>();
  events.forEach((e) => by.set(e.session_id, [...(by.get(e.session_id) ?? []), e]));
  return [...by.entries()]
    .filter(([, es]) => es.some((e) => isBlocking(e.decision.action) || e.delegation_chain.length > 1 || e.input_taint.some((t) => t.trust === 'untrusted')))
    .map(([id, es]) => ({ id, events: es, last: Math.max(...es.map((e) => e.ts)), blocked: es.some((e) => isBlocking(e.decision.action)), chain: Math.max(...es.map((e) => e.delegation_chain.length)) }))
    .sort((a, b) => b.chain - a.chain || b.last - a.last);
}

export function buildGraph(all: SecEvent[], sessionIds: string[], dir: Dir = 'LR'): Graph {
  const events = all.filter((e) => sessionIds.includes(e.session_id)).sort((a, b) => a.ts - b.ts);
  const nodes = new Map<string, GNode>();
  const edges = new Map<string, GEdge>();
  const rank: Record<GState, number> = { normal: 0, untrusted: 1, suspicious: 2, blocked: 3 };
  const bump = (n: GNode, s: GState) => { if (rank[s] > rank[n.state]) n.state = s; };
  const node = (id: string, kind: GKind, label: string, sub: string, state: GState, meta: Record<string, string> = {}) => {
    const cur = nodes.get(id);
    if (cur) { bump(cur, state); Object.assign(cur.meta, meta); return cur; }
    const n: GNode = { id, kind, label, sub, state, onPath: false, meta, x: 0, y: 0 };
    nodes.set(id, n);
    return n;
  };
  const edge = (from: string, to: string, eventId: string, label: string, state: GState, dashed = false) => {
    const id = `${from}>${to}`;
    const cur = edges.get(id);
    if (cur) { if (rank[state] > rank[cur.state]) cur.state = state; return; }
    edges.set(id, { id, from, to, eventId, label, state, onPath: false, dashed });
  };

  const byId = new Map(all.map((e) => [e.event_id, e]));
  const blockedEvents = events.filter((e) => isBlocking(e.decision.action));
  const target = [...blockedEvents].sort((a, b) => b.decision.score - a.decision.score)[0];
  const pathIds = new Set<string>();
  let walk: SecEvent | undefined = target;
  while (walk) {
    pathIds.add(walk.event_id);
    walk = walk.parent_event_id ? byId.get(walk.parent_event_id) : undefined;
  }

  for (const e of events) {
    const sus = e.decision.score >= 35 ? 'suspicious' : 'normal';
    const tainted = e.input_taint.some((t) => t.trust === 'untrusted');
    const state: GState = isBlocking(e.decision.action) ? 'blocked' : tainted && e.decision.score >= 20 ? 'suspicious' : sus;
    const agent = node(`a:${e.agent_id}`, 'agent', AGENT_NAME[e.agent_id] ?? e.agent_id, e.agent_id, state === 'blocked' ? 'suspicious' : state, { role: e.role, 'last tool': e.tool, 'risk score': String(e.decision.score) });
    if (e.decision.score > Number(agent.meta['risk score'] ?? 0)) agent.meta['risk score'] = String(e.decision.score);

    // root principal → first agent in the chain
    const rootLabel = e.root_principal;
    const first = e.delegation_chain[0] ?? e.agent_id;
    node('root', 'root', rootLabel.split('·')[0].trim(), rootLabel.includes('·') ? rootLabel.split('·')[1].trim() : 'root principal', 'normal', { 'root principal': rootLabel });
    if (!nodes.has(`a:${first}`)) node(`a:${first}`, 'agent', AGENT_NAME[first] ?? first, first, tainted ? 'suspicious' : 'normal');
    edge('root', `a:${first}`, e.event_id, 'task', 'normal');

    for (const t of e.input_taint.filter((x) => x.trust === 'untrusted')) {
      node(`d:${t.source}`, 'doc', t.source, 'untrusted input', 'untrusted', { trust: 'untrusted', source: t.source });
      const reader = e.delegation_chain[0] ?? e.agent_id;
      if (e.tool === 'web.read' || e.tool === 'catalog.read' || e.tool === 'documents.read' || (t.hops ?? 0) === 0) edge(`d:${t.source}`, `a:${reader}`, e.event_id, 'tainted input', 'untrusted');
    }
    for (let i = 0; i < e.delegation_chain.length - 1; i++) {
      const [a, b] = [e.delegation_chain[i], e.delegation_chain[i + 1]];
      if (!nodes.has(`a:${b}`)) node(`a:${b}`, 'agent', AGENT_NAME[b] ?? b, b, tainted ? 'suspicious' : 'normal');
      edge(`a:${a}`, `a:${b}`, e.event_id, 'handoff', tainted ? 'suspicious' : 'normal');
    }
    if (e.delegate_to) {
      node(`a:${e.delegate_to}`, 'agent', AGENT_NAME[e.delegate_to] ?? e.delegate_to, e.delegate_to, tainted ? 'suspicious' : 'normal');
      edge(`a:${e.agent_id}`, `a:${e.delegate_to}`, e.event_id, 'delegates', tainted ? 'suspicious' : 'normal');
    }
    if (isBlocking(e.decision.action)) {
      const bid = `x:${e.event_id}`;
      node(bid, 'blocked', `✗ ${e.tool}`, `BLOCKED · risk ${e.decision.score}`, 'blocked', { event: e.event_id, tool: e.tool, action: e.action, 'risk score': String(e.decision.score), decision: e.decision.action });
      edge(`a:${e.agent_id}`, bid, e.event_id, 'attempt', 'blocked');
      const dest = e.destination ?? e.resource;
      node(`r:${dest}`, 'resource', dest, e.destination ? 'unapproved destination' : e.resource_sensitivity, 'normal', { resource: e.resource, sensitivity: e.resource_sensitivity });
      edge(bid, `r:${dest}`, e.event_id, 'not reached', 'blocked', true);
    } else if (['confidential', 'restricted'].includes(e.resource_sensitivity)) {
      node(`r:${e.resource}`, 'resource', e.resource, e.resource_sensitivity, 'normal', { sensitivity: e.resource_sensitivity });
      edge(`a:${e.agent_id}`, `r:${e.resource}`, e.event_id, e.tool, state === 'normal' ? 'normal' : 'suspicious');
    }
  }

  // attack path highlighting
  edges.forEach((ed) => {
    ed.onPath = !!target && pathIds.has(ed.eventId) && ed.label !== 'task' && ed.label !== 'not reached';
  });
  edges.forEach((ed) => {
    if (ed.onPath) { const a = nodes.get(ed.from); const b = nodes.get(ed.to); if (a) a.onPath = true; if (b) b.onPath = true; }
  });

  // layered layout (longest path from sources)
  const list = [...nodes.values()];
  const layer = new Map<string, number>();
  list.forEach((n) => layer.set(n.id, 0));
  for (let pass = 0; pass < list.length; pass++) {
    let changed = false;
    edges.forEach((ed) => {
      const l = (layer.get(ed.from) ?? 0) + 1;
      if (l > (layer.get(ed.to) ?? 0) && l <= list.length) { layer.set(ed.to, l); changed = true; }
    });
    if (!changed) break;
  }
  const cols = new Map<number, GNode[]>();
  list.forEach((n) => { const l = layer.get(n.id)!; cols.set(l, [...(cols.get(l) ?? []), n]); });
  const along = dir === 'LR' ? NODE_W + 84 : NODE_H + 64; // distance between layers
  const across = dir === 'LR' ? NODE_H + 30 : NODE_W + 32; // distance between siblings
  const span = (n: number) => n * across - (dir === 'LR' ? 30 : 32);
  const maxCol = Math.max(...[...cols.values()].map((c) => c.length), 1);
  [...cols.entries()].forEach(([l, ns]) => {
    ns.sort((a, b) => a.kind.localeCompare(b.kind));
    const off = (span(maxCol) - span(ns.length)) / 2;
    ns.forEach((n, i) => {
      if (dir === 'LR') { n.x = 40 + l * along; n.y = 40 + off + i * across; }
      else { n.y = 40 + l * along; n.x = 40 + off + i * across; }
    });
  });
  const layers = Math.max(...cols.keys(), 0) + 1;
  const W = dir === 'LR' ? 80 + layers * along - 84 + 0 : 80 + span(maxCol);
  const H = dir === 'LR' ? 80 + span(maxCol) : 80 + layers * along - 64 + 0;
  return { nodes: list, edges: [...edges.values()], W, H, dir };
}
