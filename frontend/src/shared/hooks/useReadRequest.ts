import { useEffect, useMemo, useState } from 'react';
import { errorNotice } from '../api/http';
import type { ErrorNotice } from '../api/http';

// Each request has an identity: changing its inputs immediately hides stale results.
// Abort saves network work; the explicit guard also protects against late responses.
export function useReadRequest<T>(
  load: (signal: AbortSignal) => Promise<T>,
  enabled = true,
  initialData: T | null = null,
  revision = 0,
) {
  const request = useMemo(() => ({ load, enabled, revision }), [load, enabled, revision]);
  const [response, setResponse] = useState<{
    request: typeof request | null;
    data: T | null;
    error: ErrorNotice | null;
  }>({ request: null, data: initialData, error: null });
  useEffect(() => {
    if (!request.enabled) return;
    const controller = new AbortController();
    request
      .load(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResponse({ request, data, error: null });
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setResponse((previous) => ({ request, data: previous.data, error: errorNotice(reason) }));
      });
    return () => controller.abort();
  }, [request]);
  return {
    data: response.data,
    loading: enabled && response.request !== request,
    error: response.request === request ? response.error : null,
    updateData: (update: (current: T | null) => T | null) =>
      setResponse((previous) => ({ ...previous, data: update(previous.data) })),
  };
}
