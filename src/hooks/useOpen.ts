import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/** Drawers are addressed by URL (?event= / ?alert= / ?agent=) so any page can deep-link to them. */
export function useOpen() {
  const [params, setParams] = useSearchParams();
  const set = useCallback(
    (key: 'event' | 'alert' | 'agent' | null, id?: string) => {
      const next = new URLSearchParams(params);
      ['event', 'alert', 'agent'].forEach((k) => next.delete(k));
      if (key && id) next.set(key, id);
      setParams(next, { replace: false });
    },
    [params, setParams],
  );
  return {
    eventId: params.get('event'),
    alertId: params.get('alert'),
    agentId: params.get('agent'),
    openEvent: (id: string) => set('event', id),
    openAlert: (id: string) => set('alert', id),
    openAgent: (id: string) => set('agent', id),
    close: () => set(null),
  };
}
