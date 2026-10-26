import type { LucideIcon } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

type Variant = 'primary' | 'neon' | 'ghost' | 'danger' | 'subtle' | 'ok';
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'xs' | 'sm' | 'md';
  icon?: LucideIcon;
}

const V: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:brightness-110',
  neon: 'border border-neon/40 bg-neon/10 text-neon hover:bg-neon/20',
  ghost: 'text-muted hover:bg-fg/5 hover:text-fg',
  danger: 'border border-danger/40 bg-danger/10 text-danger hover:bg-danger/20',
  ok: 'border border-ok/40 bg-ok/10 text-ok hover:bg-ok/20',
  subtle: 'border border-line/10 bg-fg/[0.04] text-fg hover:bg-fg/[0.08]',
};
const S = { xs: 'h-7 gap-1 px-2 text-[11px]', sm: 'h-8 gap-1.5 px-3 text-xs', md: 'h-9 gap-2 px-4 text-[13px]' };

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = 'subtle', size = 'sm', icon: Icon, className, children, ...rest }, ref,
) {
  return (
    <button
      ref={ref}
      {...rest}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-lg font-medium transition-all active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40',
        V[variant], S[size], className,
      )}
    >
      {Icon && <Icon size={size === 'md' ? 15 : 13} aria-hidden />}
      {children}
    </button>
  );
});

export function IconButton({ icon: Icon, label, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string }) {
  return (
    <button
      {...rest}
      aria-label={label}
      title={label}
      className={cn('inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line/10 bg-fg/[0.03] text-muted transition-colors hover:border-neon/40 hover:text-fg', className)}
    >
      <Icon size={16} aria-hidden />
    </button>
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-2">
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-fg">{label}</span>
        {description && <span className="block text-xs text-muted">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn('relative h-6 w-11 shrink-0 rounded-full border transition-colors', checked ? 'border-neon/50 bg-neon/25' : 'border-line/15 bg-fg/10')}
      >
        <span className={cn('absolute top-0.5 h-4.5 w-4.5 rounded-full bg-fg transition-all', checked ? 'left-[22px] bg-neon shadow-[0_0_10px_rgb(var(--neon))]' : 'left-0.5')} style={{ height: 18, width: 18 }} />
      </button>
    </label>
  );
}

export function Segmented<T extends string | number>({ value, onChange, options, size = 'sm' }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; size?: 'sm' | 'xs' }) {
  return (
    <div role="tablist" className="inline-flex rounded-lg border border-line/10 bg-bg/50 p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-md font-mono uppercase tracking-wider transition-colors',
            size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-2 py-0.5 text-[10px]',
            o.value === value ? 'bg-neon/15 text-neon shadow-[inset_0_0_0_1px_rgb(var(--neon)/0.35)]' : 'text-muted hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Select<T extends string>({ value, onChange, options, label, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string; className?: string }) {
  return (
    <label className={cn('flex flex-col gap-1', className)}>
      <span className="label !text-[9.5px]">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className="input !py-1.5 text-xs">
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-bg text-fg">{o.label}</option>
        ))}
      </select>
    </label>
  );
}

export function Field({ label, children, hint, error }: { label: string; children: ReactNode; hint?: string; error?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="label">{label}</span>
      {children}
      {error ? <span className="text-xs text-danger" role="alert">{error}</span> : hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </div>
  );
}

export function Tip({ text, children }: { text: string; children: ReactNode }) {
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span role="tooltip" className="pointer-events-none absolute -top-1 left-1/2 z-50 hidden w-max max-w-[min(240px,70vw)] -translate-x-1/2 -translate-y-full rounded-md border border-line/15 bg-bg2 px-2 py-1 text-[11px] font-normal normal-case tracking-normal text-fg shadow-xl group-hover/tip:block group-focus-within/tip:block">
        {text}
      </span>
    </span>
  );
}
