import { useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';
import type { LogLine } from '../../store/useSim';

const TONE = { safe: 'text-ok', info: 'text-neon', warn: 'text-warn', block: 'text-danger' } as const;

export function Terminal({ lines, running, title = 'driftshield@gateway:~$', className, empty }: { lines: LogLine[]; running?: boolean; title?: string; className?: string; empty?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);
  return (
    <div className={cn('scan flex min-h-0 flex-col overflow-hidden rounded-xl border border-line/10 bg-bg/80', className)}>
      <div className="flex items-center gap-2 border-b border-line/[0.07] bg-fg/[0.03] px-3 py-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-danger/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-warn/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-ok/80" />
        <span className="ml-2 truncate font-mono text-[11px] text-muted">{title}</span>
        {running && <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-ok">● live</span>}
      </div>
      <div ref={ref} className="min-h-0 flex-1 overflow-y-auto p-3 font-mono text-[11.5px] leading-relaxed" role="log" aria-live="polite">
        {lines.length === 0 && <div className="text-muted">{empty ?? 'Waiting for events…'}</div>}
        {lines.map((l, i) => (
          <div key={l.id} className={cn('animate-[fadeIn_.25s_ease]', TONE[l.tone], i === lines.length - 1 && running && 'caret')}>
            <span className="mr-2 text-muted/60">{String(l.id).padStart(3, '0')}</span>
            {l.text}
          </div>
        ))}
      </div>
    </div>
  );
}
