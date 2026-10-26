import { useMemo, useState } from 'react';

export type Dir = 'asc' | 'desc';

export function useTable<T>(rows: T[], accessors: Record<string, (r: T) => string | number>, opts: { pageSize?: number; sort?: string; dir?: Dir } = {}) {
  const [sort, setSort] = useState(opts.sort ?? Object.keys(accessors)[0]);
  const [dir, setDir] = useState<Dir>(opts.dir ?? 'desc');
  const [page, setPage] = useState(1);
  const pageSize = opts.pageSize ?? 10;

  const sorted = useMemo(() => {
    const get = accessors[sort];
    if (!get) return rows;
    return [...rows].sort((a, b) => {
      const x = get(a), y = get(b);
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      return dir === 'asc' ? c : -c;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort, dir]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pages);
  const view = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  return {
    view, total: sorted.length, page: safePage, pages, setPage, sort, dir,
    toggle: (key: string) => {
      if (key === sort) setDir(dir === 'asc' ? 'desc' : 'asc');
      else { setSort(key); setDir('desc'); }
      setPage(1);
    },
  };
}
