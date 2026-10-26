import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../../lib/auth';

/** Redirects to /login unless a demo session exists (frontend-only gate, not real access control). */
export function RequireAuth({ children }: { children: ReactNode }) {
  const session = useAuth((s) => s.session);
  const loc = useLocation();
  if (!session) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  return <>{children}</>;
}
