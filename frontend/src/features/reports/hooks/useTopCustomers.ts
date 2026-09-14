import { useCallback, useState } from 'react';
import { getTopCustomers } from '../api';
import { formatAmount, formatDate } from '../../../shared/format';
import { useReadRequest } from '../../../shared/hooks/useReadRequest';

export function useTopCustomers(enabled: boolean) {
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState({ asOf: '' });
  const [revision, setRevision] = useState(0);
  const load = useCallback((signal: AbortSignal) => getTopCustomers(query.asOf, signal), [query]);
  const { data, loading, error } = useReadRequest(load, enabled, null, revision);
  const result = !loading && !error ? data : null;
  const start = result
    ? new Date(new Date(result.as_of).getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    : null;

  return {
    draft,
    setDraft,
    loading,
    error,
    period:
      result && start
        ? `Desde ${formatDate(start)} hasta ${formatDate(result.as_of)}, sin incluir el instante de corte.`
        : '',
    rows: (result?.data ?? []).map((customer, index) => ({
      id: customer.customer_id,
      rank: index + 1,
      name: customer.full_name,
      amount: formatAmount(customer.total_amount),
      orders: customer.order_count,
      average: formatAmount(customer.average_ticket),
    })),
    search: () => setQuery({ asOf: draft }),
    useToday: () => {
      setDraft('');
      setQuery({ asOf: '' });
    },
    retry: () => setRevision((current) => current + 1),
  };
}
