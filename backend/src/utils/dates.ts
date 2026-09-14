// ISO 8601 con zona explícita, o fecha sola interpretada a medianoche UTC.
export function normalizeDate(value: string): string {
  const source = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value;
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/.exec(
    source,
  );
  if (!match)
    throw new Error('Usa una fecha ISO 8601 o timestamp con zona horaria y hasta seis decimales');
  const fraction = (match[2] ?? '').padEnd(6, '0');
  const date = new Date(`${match[1]}.${fraction.slice(0, 3)}${match[3]}`);
  if (!Number.isFinite(date.getTime())) throw new Error('Fecha inválida');
  const utc = date.toISOString();
  if (utc.length !== 24) throw new Error('Fecha fuera de rango');
  return utc.slice(0, 23) + fraction.slice(3) + 'Z';
}
