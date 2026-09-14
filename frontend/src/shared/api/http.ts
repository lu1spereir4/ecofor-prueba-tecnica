export interface ErrorNotice {
  message: string;
  code?: string;
  details: string[];
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: string[];
  constructor(status: number, code: string, message: string, details: string[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function errorDetails(body: Record<string, unknown>): string[] {
  const messages: string[] = [];
  if (Array.isArray(body.errors))
    for (const error of body.errors) {
      if (error && typeof error === 'object' && typeof error.msg === 'string') {
        messages.push(
          `${typeof error.path === 'string' && error.path ? `${error.path}: ` : ''}${error.msg}`,
        );
      }
    }
  const details = body.details as { products?: unknown[]; product_ids?: unknown[] } | undefined;
  if (Array.isArray(details?.products))
    for (const product of details.products) {
      const item = product as { product_id: number; available: number; requested: number };
      messages.push(
        `Producto ${item.product_id}: ${item.available} disponibles, ${item.requested} solicitados.`,
      );
    }
  if (Array.isArray(details?.product_ids))
    messages.push(`Productos: ${details.product_ids.join(', ')}.`);
  return messages;
}

export async function requestJson<T>(
  path: string,
  options: RequestInit = {},
  query: Record<string, string | number | undefined> = {},
): Promise<T> {
  const base = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
  const url = new URL(base + path, window.location.origin);
  for (const [key, value] of Object.entries(query))
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  let response: Response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError(0, 'NETWORK_ERROR', 'No se pudo conectar con la API.');
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ApiError(
      response.status,
      'INVALID_RESPONSE',
      'La API devolvió una respuesta que no es JSON.',
    );
  }
  if (!response.ok) {
    const failure = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    throw new ApiError(
      response.status,
      typeof failure.code === 'string' ? failure.code : 'HTTP_ERROR',
      typeof failure.message === 'string' ? failure.message : `Error HTTP ${response.status}.`,
      errorDetails(failure),
    );
  }
  return body as T;
}

export function errorNotice(error: unknown): ErrorNotice {
  if (error instanceof ApiError)
    return { message: error.message, code: error.code, details: error.details };
  return {
    message: error instanceof Error ? error.message : 'Ocurrió un error inesperado.',
    details: [],
  };
}
