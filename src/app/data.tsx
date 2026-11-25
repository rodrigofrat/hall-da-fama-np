import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { CalendarEvent, DrawResult } from '../domain/calendar';
import { AccessError, type MeData, type RankingResult } from '../data/types';
import { useAuth } from './auth';
import { SupabaseData } from '../data/supabase';

type BrowsableCreator = { creator_id: string; handle: string };

interface Loadable<T> { data: T | null; error: string | null; loading: boolean; denied: boolean }

interface DataState {
  me: Loadable<MeData>;
  reload(): void;
  browsableCreators: BrowsableCreator[] | null;
  viewedCreatorId: string;
  viewCreator(id: string): void;
}

const Ctx = createContext<DataState | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { data } = useAuth();
  const [me, setMe] = useState<Loadable<MeData>>({ data: null, error: null, loading: true, denied: false });
  const [tick, setTick] = useState(0);
  const [browse, setBrowse] = useState<{ data: typeof data; creators: BrowsableCreator[] | null; error: string | null } | null>(null);
  const [selected, viewCreator] = useState('');
  const ready = !(data instanceof SupabaseData) || browse?.data === data;
  const browsableCreators = browse?.data === data ? browse.creators : null;
  const viewedCreatorId = browsableCreators?.find((creator) => creator.creator_id === selected)?.creator_id
    ?? browsableCreators?.[0]?.creator_id ?? '';

  useEffect(() => {
    if (!(data instanceof SupabaseData)) return;
    let alive = true;
    data.listBrowsableCreators().then(
      (creators) => alive && setBrowse({ data, creators, error: null }),
      (error: Error) => alive && setBrowse({ data, creators: null, error: error.message }),
    );
    return () => { alive = false; };
  }, [data]);

  useEffect(() => {
    if (!data || !ready) return;
    if (browse?.data === data && browse.error) {
      setMe({ data: null, error: browse.error, loading: false, denied: false });
      return;
    }
    let alive = true;
    setMe((s) => ({ ...s, loading: true, error: null }));
    const request = data instanceof SupabaseData ? data.getMe(viewedCreatorId || undefined) : data.getMe();
    request.then(
      (d) => alive && setMe({ data: d, error: null, loading: false, denied: false }),
      (e) => alive && setMe({ data: null, error: e instanceof Error ? e.message : 'Erro ao carregar.', loading: false, denied: e instanceof AccessError }),
    );
    return () => { alive = false; };
  }, [data, tick, ready, browse, viewedCreatorId]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return <Ctx.Provider value={{ me, reload, browsableCreators, viewedCreatorId, viewCreator }}>{children}</Ctx.Provider>;
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
