import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, ShieldAlert, X } from 'lucide-react';
import { TONE, cn } from '../../lib/utils';
import { useUi } from '../../store/useUi';

export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(92vw,360px)] flex-col gap-2" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => {
          const tone = TONE[t.tone];
          const Icon = t.tone === 'danger' ? ShieldAlert : t.tone === 'warn' ? AlertTriangle : CheckCircle2;
          return (
            <motion.div
              key={t.id} layout initial={{ opacity: 0, x: 40, scale: 0.96 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 40 }}
              className={cn('glass pointer-events-auto flex items-start gap-3 p-3', t.tone === 'danger' && 'glow-danger')}
            >
              <Icon size={18} className={cn('mt-0.5 shrink-0', tone.text)} aria-hidden />
              <div className="min-w-0 flex-1"><p className="text-[13px] font-semibold">{t.title}</p>{t.body && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{t.body}</p>}</div>
              <button aria-label="Dismiss" onClick={() => dismiss(t.id)} className="text-muted hover:text-fg"><X size={14} /></button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
