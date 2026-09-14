import { useCallback, useState } from 'react';
import { getOrders } from '../api';
import { listRow } from '../models';
import { useReadRequest } from '../../../shared/hooks/useReadRequest';

const emptyFilters = { customer: '', status: '', from: '', to: '' };
export function useOrdersList(enabled: boolean) {
  const [draft, setDraft] = useState(emptyFilters);
  const [query, setQuery] = useState({
    filters: emptyFilters,
    limit: 20,
    cursors: [undefined] as (string | undefined)[],
  });
  const [validation, setValidation] = useState('');
  const [revision, setRevision] = useState(0);
  const load = useCallback(
    (signal: AbortSignal) => {
      return getOrders(
        {
          customer: query.filters.customer || undefined,
          status: query.filters.status || undefined,
          from: query.filters.from ? `${query.filters.from}T00:00:00Z` : undefined,
          to: query.filters.to ? `${query.filters.to}T23:59:59.999999Z` : undefined,
          limit: query.limit,
          cursor: query.cursors.at(-1),
        },
        signal,
      );
    },
    [query],
  );
  const { data, loading, error } = useReadRequest(load, enabled, null, revision);
  function search() {
    if (draft.from && draft.to && draft.from > draft.to) {
      setValidation('La fecha final debe ser igual o posterior a la inicial.');
      return;
    }
    setValidation('');
    setQuery((current) => ({
      ...current,
      filters: { ...draft, customer: draft.customer.trim() },
      cursors: [undefined],
    }));
  }
  return {
    rows: !loading && !error ? (data?.data ?? []).map(listRow) : [],
    loading,
    error,
    validation,
    draft,
    limit: query.limit,
    setField: (field: keyof typeof emptyFilters, value: string) =>
      setDraft((current) => ({ ...current, [field]: value })),
    search,
    clear: () => {
      setDraft(emptyFilters);
      setValidation('');
      setQuery((current) => ({ ...current, filters: emptyFilters, cursors: [undefined] }));
    },
    setLimit: (limit: number) =>
      setQuery((current) => ({ ...current, limit, cursors: [undefined] })),
    retry: () => setRevision((current) => current + 1),
    pagination: {
      label: `Página ${query.cursors.length} de pedidos`,
      previousDisabled: loading || query.cursors.length === 1,
      nextDisabled: loading || !!error || !data?.nextCursor,
      onPrevious: () => {
        if (!loading && query.cursors.length > 1)
          setQuery((current) => ({ ...current, cursors: current.cursors.slice(0, -1) }));
      },
      onNext: () => {
        if (!loading && data?.nextCursor)
          setQuery((current) => ({ ...current, cursors: [...current.cursors, data.nextCursor!] }));
      },
    },
  };
}
