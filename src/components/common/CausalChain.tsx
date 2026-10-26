import { motion } from 'framer-motion';
import { ArrowRight, Ban, FileWarning } from 'lucide-react';
import { Fragment, useMemo } from 'react';
import { AGENT_NAME } from '../../data/agents';
import { useOpen } from '../../hooks/useOpen';
import { isBlocking } from '../../lib/riskScoring';
import { TONE, cn, scoreTone } from '../../lib/utils';
import { useStore } from '../../store/useStore';
import { ScorePill } from '../ui/Badges';

/** Walks parent events from `leafId` back to the root and shows the untrusted source that tainted the chain. */
export function CausalChain({ leafId }: { leafId: string }) {
  const events = useStore((s) => s.events);
  const { openEvent } = useOpen();
  const chain = useMemo(() => {
    const byId = new Map(events.map((e) => [e.event_id, e]));
    const out = [];
    let cur = byId.get(leafId);
    while (cur) { out.unshift(cur); cur = cur.parent_event_id ? byId.get(cur.parent_event_id) : undefined; }
    return out;
  }, [events, leafId]);
  const source = chain.flatMap((e) => e.input_taint).find((t) => t.trust === 'untrusted');
  if (!chain.length) return null;

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max items-stretch gap-2">
        {source && (
          <>
            <div className="flex w-44 flex-col justify-center rounded-xl border border-danger/40 bg-danger/10 p-3">
              <div className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-danger"><FileWarning size={13} /> untrusted source</div>
              <div className="mt-1 break-all font-mono text-[11px]">{source.source}</div>
            </div>
            <ArrowRight size={16} className="self-center text-danger" />
          </>
        )}
        {chain.map((e, i) => {
          const last = i === chain.length - 1;
          const blocked = isBlocking(e.decision.action);
          const t = TONE[blocked ? 'danger' : scoreTone(e.decision.score)];
          return (
            <Fragment key={e.event_id}>
              <motion.button
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.12 }}
                onClick={() => openEvent(e.event_id)}
                className={cn('w-52 rounded-xl border p-3 text-left transition-colors hover:brightness-125', t.border, blocked ? 'bg-danger/10 glow-danger' : 'bg-bg/50')}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10.5px] text-muted">{e.event_id}</span>
                  {blocked ? <span className="flex items-center gap-1 font-mono text-[10px] font-semibold text-danger"><Ban size={12} /> BLOCKED</span> : <ScorePill score={e.decision.score} />}
                </div>
                <div className="mt-1 truncate text-[13px] font-medium">{e.tool}</div>
                <div className="truncate text-[11px] text-muted">{AGENT_NAME[e.agent_id] ?? e.agent_id}</div>
                {last && blocked && <div className="mt-1 font-mono text-[11px] text-danger">risk {e.decision.score}/100</div>}
              </motion.button>
              {!last && <ArrowRight size={16} className={cn('self-center', source ? 'text-danger' : 'text-muted')} />}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
