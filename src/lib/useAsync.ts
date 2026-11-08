import { useEffect, useState, type DependencyList } from 'react';
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList, initial: T) {
  const [data, setData] = useState<T>(initial); const [loading, setLoading] = useState(true); const [tick, setTick] = useState(0);
  useEffect(() => { let alive = true; setLoading(true); fn().then((d) => { if (alive) { setData(d); setLoading(false); } }).catch(() => alive && setLoading(false)); return () => { alive = false; }; }, [...deps, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, loading, reload: () => setTick((t) => t + 1) };
}
