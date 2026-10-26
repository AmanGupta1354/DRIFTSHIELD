import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface CardProps {
  title?: ReactNode;
  icon?: LucideIcon;
  /** terminal-style section id, e.g. RISK_OVERVIEW */
  code?: string;
  right?: ReactNode;
  className?: string;
  bodyClassName?: string;
  glow?: 'danger' | 'ok' | 'neon' | 'brand';
  brackets?: boolean;
  children?: ReactNode;
}

export function Card({ title, icon: Icon, code, right, className, bodyClassName, glow, brackets, children }: CardProps) {
  return (
    <section
      className={cn(
        'glass holo-edge flex min-w-0 flex-col',
        brackets && 'brackets',
        glow === 'danger' && 'glow-danger',
        glow === 'ok' && 'glow-ok',
        glow === 'neon' && 'glow-neon',
        glow === 'brand' && 'glow-brand',
        className,
      )}
    >
      {(title || right) && (
        <header className="flex min-h-[46px] items-center justify-between gap-3 border-b border-line/[0.07] px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            {Icon && <Icon size={15} className="shrink-0 text-neon" aria-hidden />}
            <div className="min-w-0">
              {code && <div className="label !text-[9.5px] leading-none text-neon/70">{`// ${code}`}</div>}
              <h2 className="truncate text-[13px] font-semibold tracking-wide text-fg">{title}</h2>
            </div>
          </div>
          {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
        </header>
      )}
      <div className={cn('min-h-0 flex-1 p-4', bodyClassName)}>{children}</div>
    </section>
  );
}
