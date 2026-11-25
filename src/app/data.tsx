import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { CalendarEvent, DrawResult } from '../domain/calendar';
import { AccessError, type MeData, type RankingResult } from '../data/types';
import { useAuth } from './auth';

interface Loadable<T> { data: T | null; error: string | null; loading: boolean; denied: boolean }

interface DataState {
  me: Loadable<MeData>;
  reload(): void;
}

const Ctx = createContext<DataState | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { data } = useAuth();
  const [me, setMe] = useState<Loadable<MeData>>({ data: null, error: null, loading: true, denied: false });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!data) return;
    let alive = true;
    setMe((s) => ({ ...s, loading: true, error: null }));
    data.getMe().then(
      (d) => alive && setMe({ data: d, error: null, loading: false, denied: false }),
      (e) => alive && setMe({ data: null, error: e instanceof Error ? e.message : 'Erro ao carregar.', loading: false, denied: e instanceof AccessError }),
    );
    return () => { alive = false; };
  }, [data, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return <Ctx.Provider value={{ me, reload }}>{children}</Ctx.Provider>;
}

export function useMe() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useMe fora do DataProvider');
  return v;
}

function useLoad<T>(fn: (() => Promise<T>) | null, deps: unknown[]): Loadable<T> {
  const [s, setS] = useState<Loadable<T>>({ data: null, error: null, loading: true, denied: false });
  useEffect(() => {
    if (!fn) return;
    let alive = true;
    setS((p) => ({ ...p, loading: true }));
    fn().then(
      (d) => alive && setS({ data: d, error: null, loading: false, denied: false }),
      (e) => alive && setS({ data: null, error: e instanceof Error ? e.message : 'Erro ao carregar.', loading: false, denied: e instanceof AccessError }),
    );
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return s;
}

export function useRanking(cycleId: string | null, enabled = true): Loadable<RankingResult | null> {
  const { data } = useAuth();
  return useLoad(data && cycleId && enabled ? () => data.getRanking(cycleId) : null, [data, cycleId, enabled]);
}

export function useCalendar(): Loadable<{ events: CalendarEvent[]; results: DrawResult[] }> {
  const { data } = useAuth();
  return useLoad(data ? async () => {
    const [events, results] = await Promise.all([data.getCalendar(), data.getResults()]);
    return { events, results };
  } : null, [data]);
}

export function useAdmin() {
  const { data } = useAuth();
  return useLoad(data ? () => data.getAdminStatus() : null, [data]);
}
