import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { Button } from '../ui/Controls';
import { Logo } from './Sidebar';

const LINKS = [
  { to: '/#product', label: 'Product' },
  { to: '/#how', label: 'How It Works' },
  { to: '/#security', label: 'Security' },
  { to: '/#architecture', label: 'Architecture' },
];

export function PublicNav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-line/[0.07] bg-bg/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" aria-label="DriftShield home"><Logo /></Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {LINKS.map((l) => <Link key={l.to} to={l.to} className="rounded-lg px-3 py-2 text-[13px] text-muted transition-colors hover:text-fg">{l.label}</Link>)}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Link to="/login"><Button variant="ghost" size="md">Sign In</Button></Link>
          <Link to="/dashboard"><Button variant="primary" size="md">Launch Dashboard</Button></Link>
        </div>
        <button className="grid h-9 w-9 place-items-center rounded-lg border border-line/10 md:hidden" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
      {open && (
        <nav className="border-t border-line/[0.07] px-4 pb-4 pt-2 md:hidden" aria-label="Mobile">
          {LINKS.map((l) => <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm text-muted hover:text-fg">{l.label}</Link>)}
          <div className="mt-2 grid grid-cols-2 gap-2"><Link to="/login" onClick={() => setOpen(false)}><Button size="md" className="w-full">Sign In</Button></Link><Link to="/dashboard" onClick={() => setOpen(false)}><Button variant="primary" size="md" className="w-full">Launch Dashboard</Button></Link></div>
        </nav>
      )}
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-line/[0.07] bg-bg2/40">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-sm text-xs text-muted">Identity Drift Detection in Autonomous AI Agents.</p>
          <p className="mt-1 text-xs text-muted">Built by Team DarkNeuron.</p>
        </div>
        <div><div className="label mb-2">Product</div><ul className="space-y-1.5 text-[13px] text-muted">{LINKS.map((l) => <li key={l.to}><Link className="hover:text-fg" to={l.to}>{l.label}</Link></li>)}</ul></div>
        <div><div className="label mb-2">Explore</div><ul className="space-y-1.5 text-[13px] text-muted"><li><Link className="hover:text-fg" to="/#demo">Attack demonstration</Link></li><li><Link className="hover:text-fg" to="/login">Sign In</Link></li><li><Link className="hover:text-fg" to="/dashboard">Security dashboard</Link></li></ul></div>
      </div>
      <div className="border-t border-line/[0.07] px-4 py-4 text-center text-[11px] text-muted">The current demonstration uses simulated agents and events. No real agents are monitored and no real data is accessed.</div>
    </footer>
  );
}

export function PublicLayout() {
  return (
    <div className="min-h-full">
      <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-neon focus:px-3 focus:py-2 focus:text-black">Skip to content</a>
      <PublicNav />
      <main id="content"><Outlet /></main>
      <PublicFooter />
    </div>
  );
}
