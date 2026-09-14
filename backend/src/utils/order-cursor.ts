import { normalizeDate } from './dates';
export interface OrderCursor {
  created_at: string;
  id: number;
}
export function decodeCursor(value: string): OrderCursor {
  if (value.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Cursor inválido');
  const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  if (!parsed || typeof parsed !== 'object') throw new Error('Cursor inválido');
  const { created_at, id } = parsed as Record<string, unknown>;
  if (
    typeof created_at !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(created_at) ||
    normalizeDate(created_at) !== created_at ||
    typeof id !== 'number' ||
    !Number.isInteger(id) ||
    id < 1 ||
    id > 2147483647
  )
    throw new Error('Cursor inválido');
  return { created_at, id };
}
