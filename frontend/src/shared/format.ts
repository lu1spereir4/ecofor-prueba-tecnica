export function formatAmount(value: string): string {
  const [whole, fraction = ''] = value.split('.');
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${fraction.padEnd(2, '0')}`;
}
export function toCents(value: string): bigint {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
}
export function fromCents(value: bigint): string {
  return `${value / 100n}.${String(value % 100n).padStart(2, '0')}`;
}
export function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(value));
}
