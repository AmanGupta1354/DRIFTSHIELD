import { Check, Copy, Inbox, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { copyText, cn } from '../../lib/utils';
import { useStore } from '../../store/useStore';
import { useUi } from '../../store/useUi';
import { Button } from './Controls';

export function CountUp({ value, className }: { value: number; className?: string }) {
  const reduced = useStore((s) => s.prefs.animations === 'reduced');
  const [shown, setShown] = useState(reduced ? value : 0);
  const from = useRef(reduced ? value : 0);
  useEffect(() => {
    if (reduced) { setShown(value); from.current = value; return; }
    const start = from.current, t0 = performance.now(), dur = 900;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      const v = Math.round(start + (value - start) * e);
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduced]);
  return <span className={cn('tabular-nums', className)}>{shown.toLocaleString('en-US')}</span>;
}

export function Empty({ icon: Icon = Inbox, title, hint, action }: { icon?: LucideIcon; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-xl border border-line/10 bg-fg/5 text-muted"><Icon size={20} /></span>
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="max-w-sm text-xs text-muted">{hint}</p>}
      {action}
    </div>
  );
}

export function CopyButton({ text, label = 'Copy JSON' }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  const push = useUi((s) => s.push);
  return (
    <Button
      size="xs" variant="neon" icon={ok ? Check : Copy}
      onClick={async () => {
        const done = await copyText(text);
        setOk(done);
        push({ title: done ? 'Copied to clipboard' : 'Copy failed', tone: done ? 'ok' : 'warn' });
        setTimeout(() => setOk(false), 1500);
      }}
    >
      {ok ? 'Copied' : label}
    </Button>
  );
}

export function JsonView({ data, className }: { data: unknown; className?: string }) {
  const text = JSON.stringify(data, null, 2);
  const html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?)/g, (m, str, colon, lit, num) => {
      if (str) return colon ? `<span class="text-neon">${str}</span>${colon}` : `<span class="text-ok">${str}</span>`;
      if (lit) return `<span class="text-holo">${lit}</span>`;
      if (num) return `<span class="text-warn">${num}</span>`;
      return m;
    });
  return <pre className={cn('scan overflow-auto rounded-lg border border-line/10 bg-bg/70 p-3 font-mono text-[11.5px] leading-relaxed text-muted', className)} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Spinner() {
  return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-neon/30 border-t-neon" aria-label="Loading" />;
}

export function PageLoader() {
  return (
    <div className="grid h-64 place-items-center">
      <div className="flex items-center gap-3 font-mono text-xs text-muted"><Spinner /> loading module…</div>
    </div>
  );
}

export function Meta({ k, children, mono }: { k: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="label !text-[9.5px]">{k}</div>
      <div className={cn('mt-0.5 break-words text-[13px]', mono && 'font-mono text-xs')}>{children}</div>
    </div>
  );
}

export function Pagination({ page, pages, onPage, total }: { page: number; pages: number; onPage: (p: number) => void; total: number }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line/[0.07] px-4 py-2.5 text-xs text-muted">
      <span className="font-mono">{total} rows</span>
      <div className="flex items-center gap-2">
        <Button size="xs" disabled={page <= 1} onClick={() => onPage(page - 1)}>Prev</Button>
        <span className="font-mono">{page} / {Math.max(1, pages)}</span>
        <Button size="xs" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}
