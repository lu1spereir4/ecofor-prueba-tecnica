import { requestJson } from '../../shared/api/http';
import type { TopCustomersResponse } from './types';

export function getTopCustomers(asOf: string, signal: AbortSignal) {
  return requestJson<TopCustomersResponse>(
    '/reports/top-customers',
    { signal },
    { as_of: asOf || undefined },
  );
}
