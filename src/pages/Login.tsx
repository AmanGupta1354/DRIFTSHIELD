import { motion } from 'framer-motion';
import { AlertCircle, ArrowLeft, CheckCircle2, Copy, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { GatewayVisual } from '../components/landing/GatewayVisual';
import { Logo } from '../components/layout/Sidebar';
import { Badge } from '../components/ui/Badges';
import { Button } from '../components/ui/Controls';
import { DEMO_CREDENTIALS, rememberedEmail, useAuth } from '../lib/auth';
import { cn, copyText } from '../lib/utils';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const nav = useNavigate();
  const loc = useLocation();
  const session = useAuth((s) => s.session);
  const signIn = useAuth((s) => s.signIn);
  const [email, setEmail] = useState(rememberedEmail);
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(!!rememberedEmail());
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok'>('idle');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const from = (loc.state as { from?: string } | null)?.from ?? '/dashboard';

  if (session && status !== 'ok') return <Navigate to={from} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v: typeof errors = {};
    if (!email.trim()) v.email = 'Enter your email address.';
    else if (!EMAIL_RE.test(email.trim())) v.email = 'Enter a valid email address.';
    if (!password) v.password = 'Enter your password.';
    setErrors(v);
    setMessage('');
    if (Object.keys(v).length) return;
    setStatus('loading');
    const r = await signIn(email, password, remember);
    if (r.ok) {
      setStatus('ok');
      setMessage('Signed in. Opening the security dashboard…');
      setTimeout(() => nav(from, { replace: true }), 700);
    } else {
      setStatus('idle');
      setMessage(r.error);
    }
  };

  const fill = () => { setEmail(DEMO_CREDENTIALS.email); setPassword(DEMO_CREDENTIALS.password); setErrors({}); setMessage(''); };

  return (
    <div className="grid min-h-full lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden flex-col justify-between border-r border-line/[0.07] bg-bg2/40 p-10 lg:flex">
        <Link to="/" aria-label="DriftShield home"><Logo /></Link>
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">Verify the behaviour,<br />not just the identity.</h2>
          <p className="mt-3 text-sm text-muted">Runtime security for autonomous AI agents.</p>
          <div className="mt-6 flex gap-2">{(['ROLE', 'REASON', 'ROUTINE'] as const).map((k, i) => <Badge key={k} tone={(['neon', 'holo', 'brand'] as const)[i]}>{k}</Badge>)}</div>
          <GatewayVisual className="mt-8" />
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-muted"><span className="h-2 w-2 animate-pulse rounded-full bg-ok" /> Simulation environment online · no real data</div>
      </aside>

      <section className="flex flex-col px-4 py-6 sm:px-10">
        <div className="flex items-center justify-between lg:justify-end">
          <Link to="/" className="lg:hidden" aria-label="DriftShield home"><Logo /></Link>
          <Link to="/" className="flex items-center gap-1.5 text-xs text-muted hover:text-fg"><ArrowLeft size={13} /> Back to website</Link>
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-8">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in to DriftShield</h1>
          <p className="mt-1 text-sm text-muted">Access the security operations console.</p>

          <form onSubmit={submit} noValidate className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="label mb-1.5 block">Email</label>
              <div className="relative"><Mail size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input id="email" type="email" autoComplete="username" className={cn('input !pl-9', errors.email && '!border-danger/60')} value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-err' : undefined} placeholder="you@company.com" /></div>
              {errors.email && <p id="email-err" className="mt-1 text-xs text-danger" role="alert">{errors.email}</p>}
            </div>
            <div>
              <label htmlFor="password" className="label mb-1.5 block">Password</label>
              <div className="relative"><Lock size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input id="password" type={show ? 'text' : 'password'} autoComplete="current-password" className={cn('input !pl-9 !pr-10', errors.password && '!border-danger/60')} value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors.password} aria-describedby={errors.password ? 'pw-err' : undefined} placeholder="••••••••" />
                <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-fg">{show ? <EyeOff size={15} /> : <Eye size={15} />}</button></div>
              {errors.password && <p id="pw-err" className="mt-1 text-xs text-danger" role="alert">{errors.password}</p>}
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--brand))]" /> Remember my email on this device</label>

            {message && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} role="alert" className={cn('flex items-start gap-2 rounded-lg border px-3 py-2.5 text-[13px]', status === 'ok' ? 'border-ok/35 bg-ok/10 text-ok' : 'border-danger/35 bg-danger/10 text-danger')}>
                {status === 'ok' ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}{message}
              </motion.div>
            )}
            <Button type="submit" variant="primary" size="md" className="w-full" disabled={status !== 'idle'}>
              {status === 'loading' ? <><Loader2 size={15} className="animate-spin" /> Signing in…</> : status === 'ok' ? 'Signed in' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-6 rounded-xl border border-warn/30 bg-warn/[0.06] p-4">
            <div className="flex items-center justify-between gap-2"><h2 className="text-[13px] font-semibold">Hackathon Demo Access</h2><Badge tone="warn">demo only</Badge></div>
            <dl className="mt-3 space-y-1.5 font-mono text-[12.5px]">
              <div className="flex justify-between gap-3"><dt className="text-muted">Email</dt><dd className="break-all text-right">{DEMO_CREDENTIALS.email}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Password</dt><dd>{DEMO_CREDENTIALS.password}</dd></div>
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="neon" type="button" onClick={fill}>Fill demo credentials</Button>
              <Button size="sm" type="button" icon={Copy} onClick={async () => { setCopied(await copyText(DEMO_CREDENTIALS.password)); setTimeout(() => setCopied(false), 1500); }}>{copied ? 'Copied' : 'Copy password'}</Button>
            </div>
            <p className="mt-3 text-[11px] leading-snug text-muted">Simulated sign-in for the prototype. There is no authentication backend, and this is not production-grade security.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
