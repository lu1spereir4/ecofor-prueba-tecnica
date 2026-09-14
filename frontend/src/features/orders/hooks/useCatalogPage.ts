import { useCallback, useState } from 'react';
import type { CatalogFilters, CatalogPage } from '../types';
import { useReadRequest } from '../../../shared/hooks/useReadRequest';

export function useCatalogPage<T>(
  load: (filters: CatalogFilters, signal?: AbortSignal) => Promise<CatalogPage<T>>,
  label: string,
  disabled: boolean,
) {
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState({
    search: '',
    cursors: [undefined] as (string | undefined)[],
  });
  const [revision, setRevision] = useState(0);
  const fetchPage = useCallback(
    (signal: AbortSignal) =>
      load({ search: query.search, after: query.cursors.at(-1), limit: 20 }, signal),
    [load, query],
  );
  const { data, loading, error } = useReadRequest(fetchPage, !disabled, null, revision);
  return {
    data: !loading && !error ? (data?.data ?? []) : [],
    draft,
    setDraft,
    loading,
    error,
    disabled,
    search: () => setQuery({ search: draft.trim(), cursors: [undefined] }),
    retry: () => setRevision((value) => value + 1),
    pagination: {
      label: `Página ${query.cursors.length} de ${label}`,
      previousDisabled: loading || disabled || query.cursors.length === 1,
      nextDisabled: loading || disabled || !!error || !data?.nextCursor,
      onPrevious: () => {
        if (!loading && !disabled && query.cursors.length > 1)
          setQuery((current) => ({ ...current, cursors: current.cursors.slice(0, -1) }));
      },
      onNext: () => {
        if (!loading && !disabled && data?.nextCursor)
          setQuery((current) => ({ ...current, cursors: [...current.cursors, data.nextCursor!] }));
      },
    },
  };
}
