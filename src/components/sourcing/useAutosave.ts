'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Sauvegarde différée d'un formulaire de cockpit.
 *
 * La saisie recalcule à chaque frappe, mais n'envoie pas une requête par caractère :
 * les patchs sont fusionnés et partis après un temps de repos (600 ms par défaut).
 *
 * En cas d'échec réseau, le patch reste en attente et retry() le rejoue — une saisie
 * n'est jamais perdue parce qu'une requête a échoué.
 */
export function useAutosave<T extends Record<string, unknown>>(
  send: (patch: T) => Promise<Response>,
  delay = 600,
) {
  const [state, setState] = useState<SaveState>('idle');
  const pending = useRef<Partial<T>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);

  const flush = useCallback(async () => {
    if (inFlight.current) return;
    const patch = pending.current;
    if (!Object.keys(patch).length) return;

    inFlight.current = true;
    setState('saving');
    try {
      const res = await send(patch as T);
      if (!res.ok) throw new Error(String(res.status));
      // Le patch n'est vidé qu'après confirmation du serveur.
      pending.current = {};
      setState('saved');
    } catch {
      setState('error');
    } finally {
      inFlight.current = false;
    }
  }, [send]);

  const push = useCallback(
    (patch: Partial<T>) => {
      pending.current = { ...pending.current, ...patch };
      setState('saving');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, delay);
    },
    [delay, flush],
  );

  const retry = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    void flush();
  }, [flush]);

  // Dernière chance : on tente d'envoyer ce qui reste avant de quitter la page.
  useEffect(() => {
    const onLeave = () => {
      if (Object.keys(pending.current).length) void flush();
    };
    window.addEventListener('beforeunload', onLeave);
    return () => {
      window.removeEventListener('beforeunload', onLeave);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [flush]);

  return { state, push, retry, hasPending: () => Object.keys(pending.current).length > 0 };
}
