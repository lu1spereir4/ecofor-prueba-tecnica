import { describe, expect, it } from 'vitest';
import { estimatedTotal, validQuantity } from '../features/orders/models';
import { formatAmount } from '../shared/format';

describe('Montos y cantidades del borrador', () => {
  it('mantiene centavos exactos por encima del rango entero seguro de Number', () => {
    const product = { id: 1, sku: 'BIG', name: 'Grande', price: '90071992547409.91', stock: 2 };
    expect(estimatedTotal([{ product, quantity: '2' }])).toBe('180.143.985.094.819,82');
    expect(formatAmount('0.20')).toBe('0,20');
    expect(estimatedTotal([{ product: { ...product, price: '0.10' }, quantity: '3' }])).toBe(
      '0,30',
    );
  });
  it('rechaza entradas vacías, exponenciales, decimales y fuera de rango', () => {
    for (const value of ['', '0', '-1', '1.1', '1e2', '2147483648', 'Infinity'])
      expect(validQuantity(value)).toBe(false);
    expect(validQuantity('2147483647')).toBe(true);
  });
});
