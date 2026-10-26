import { create } from 'zustand';

/**
 * DEMO-ONLY sign-in. There is no authentication backend: these credentials are public on purpose (shown on the
 * login page for judges) and the "session" is just a flag in sessionStorage. This is NOT production authentication.
 */
export const DEMO_CREDENTIALS = { email: 'analyst@driftshield.demo', password: 'DriftShield@2026' } as const;
const SESSION_KEY = 'driftshield:demo-session';
const REMEMBER_KEY = 'driftshield:remember-email';

export interface DemoSession { email: string; name: string; since: number }

function read<T>(storage: 'session' | 'local', key: string): T | null {
  try {
    const s = storage === 'session' ? window.sessionStorage : window.localStorage;
    const raw = s.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function write(storage: 'session' | 'local', key: string, value: unknown | null) {
  try {
    const s = storage === 'session' ? window.sessionStorage : window.localStorage;
    if (value === null) s.removeItem(key);
    else s.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: the session then lives only in memory */
  }
}

interface AuthState {
  session: DemoSession | null;
  signIn: (email: string, password: string, remember: boolean) => Promise<{ ok: true } | { ok: false; error: string }>;
  signOut: () => void;
}

export const rememberedEmail = () => read<string>('local', REMEMBER_KEY) ?? '';

export const useAuth = create<AuthState>((set) => ({
  session: read<DemoSession>('session', SESSION_KEY),
  signIn: async (email, password, remember) => {
    await new Promise((r) => setTimeout(r, 900)); // simulated network latency
    const ok = email.trim().toLowerCase() === DEMO_CREDENTIALS.email && password === DEMO_CREDENTIALS.password;
    if (!ok) return { ok: false, error: 'Invalid email or password. Use the hackathon demo credentials shown on this page.' };
    const session: DemoSession = { email: DEMO_CREDENTIALS.email, name: 'Security Analyst', since: Date.now() };
    write('session', SESSION_KEY, session); // never store the password
    write('local', REMEMBER_KEY, remember ? session.email : null);
    set({ session });
    return { ok: true };
  },
  signOut: () => {
    write('session', SESSION_KEY, null);
    set({ session: null });
  },
}));
