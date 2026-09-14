import { describe, expect, it } from 'vitest';
import { buildCoupons, newCoupon } from '../features/discounts/models';

describe('Validación del formulario de cupones', () => {
  it('rechaza porcentajes fuera del rango sin perder precisión decimal', () => {
    for (const value of ['-1', '100.00000000000000001', 'abc', '']) {
      const result = buildCoupons([{ ...newCoupon(1), code: 'PROMO', value }]);
      expect(result.coupons).toBeNull();
      expect(result.errors['1.value']).toBeDefined();
    }
    for (const value of ['0', '100.00', '99.99999999999999999']) {
      expect(buildCoupons([{ ...newCoupon(1), code: 'PROMO', value }]).coupons).not.toBeNull();
    }
  });

  it('valida montos, códigos únicos y las unidades de N por M', () => {
    const result = buildCoupons([
      { ...newCoupon(1), code: 'PROMO', type: 'fixed_amount', value: '1.234', minAmount: '-1' },
      { ...newCoupon(2), code: ' PROMO ', type: 'n_for_m', n: '2', m: '3' },
    ]);
    expect(result.coupons).toBeNull();
    expect(Object.keys(result.errors).sort()).toEqual([
      '1.minAmount',
      '1.value',
      '2.code',
      '2.m',
      '2.sku',
    ]);
    expect(
      buildCoupons([
        { ...newCoupon(3), code: 'GRATIS', type: 'n_for_m', sku: 'ABC', n: '1', m: '0' },
      ]).coupons,
    ).toEqual([{ code: 'GRATIS', type: 'n_for_m', stackable: true, sku: 'ABC', n: 1, m: 0 }]);
  });

  it('acepta 30 cupones, rechaza 31 sin truncar y admite la simulación sin cupones', () => {
    const drafts = Array.from({ length: 31 }, (_, id) => ({
      ...newCoupon(id),
      code: `C${id}`,
      value: '1',
    }));
    expect(buildCoupons(drafts.slice(0, 30)).coupons).toHaveLength(30);
    expect(buildCoupons(drafts)).toEqual({
      coupons: null,
      errors: { form: 'Se permiten hasta 30 cupones.' },
    });
    expect(buildCoupons([])).toEqual({ coupons: [], errors: {} });
  });
});
