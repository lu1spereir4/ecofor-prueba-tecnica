import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateDiscounts } from './discount.service';
import type { Coupon } from './discount.service';
import type { DiscountOrder } from '../repositories/discount.repository';
import { cents, money } from '../utils/money';

const order: DiscountOrder = {
  id: 123,
  items: [
    { id: 1, product_id: 7, sku: 'ABC', quantity: 3, unit_price: '20.00' },
    { id: 2, product_id: 8, sku: 'XYZ', quantity: 2, unit_price: '60.00' },
  ],
};
const promotion: Coupon[] = [
  { code: 'PROMO10', type: 'percentage', value: 10, stackable: true },
  { code: '3X2-ABC', type: 'n_for_m', sku: 'ABC', n: 3, m: 2, stackable: true },
];

test('porcentaje y n por m se calculan independientemente sobre el original', () => {
  const result = calculateDiscounts(order, promotion);
  assert.equal(result.subtotal, '180.00');
  assert.equal(result.total_discount, '38.00');
  assert.equal(result.total, '142.00');
  assert.deepEqual(result.items[0], {
    product_id: 7,
    sku: 'ABC',
    quantity: 3,
    unit_price: '20.00',
    amount: '60.00',
    discount: '26.00',
    final_amount: '34.00',
    coupons: ['PROMO10', '3X2-ABC'],
  });
});

test('elige el exclusivo ganador y evalúa mínimos en el subtotal original', () => {
  const exclusive: Coupon = {
    code: 'SOLO50',
    type: 'fixed_amount',
    value: '50.00',
    stackable: false,
    min_amount: '180.00',
  };
  const result = calculateDiscounts(order, [...promotion, exclusive]);
  assert.deepEqual(result.applied_coupons, ['SOLO50']);
  assert.equal(result.total_discount, '50.00');
  const original = calculateDiscounts(order, [
    { code: 'A', type: 'percentage', value: 50, stackable: true },
    { code: 'B', type: 'percentage', value: 50, stackable: true, min_amount: 180 },
  ]);
  assert.equal(original.total_discount, '180.00');
  assert.equal(
    calculateDiscounts(order, [{ ...exclusive, min_amount: '180.01' }]).total_discount,
    '0.00',
  );
});

test('topes por ítem, SKUs elegibles y prorrateo fijo por restos mayores', () => {
  const result = calculateDiscounts(order, [
    { code: 'ABC100', type: 'percentage', value: 100, applicable_skus: ['ABC'], stackable: true },
    { code: 'FIJO90', type: 'fixed_amount', value: 90, stackable: true },
  ]);
  assert.equal(result.items[0]!.discount, '60.00');
  assert.equal(result.items[1]!.discount, '60.00');
  assert.equal(result.total_discount, '120.00');
  assert.equal(
    calculateDiscounts(order, [
      { code: 'NONE', type: 'percentage', value: 100, stackable: true, applicable_skus: [] },
    ]).total_discount,
    '0.00',
  );
  assert.equal(
    calculateDiscounts(order, [{ code: 'BIG', type: 'fixed_amount', value: 1000, stackable: true }])
      .total,
    '0.00',
  );
  const pennies = {
    id: 1,
    items: [1, 2, 3].map((id) => ({
      id,
      product_id: id,
      sku: String(id),
      quantity: 1,
      unit_price: '0.01',
    })),
  };
  const allocated = calculateDiscounts(pennies, [
    { code: 'HALF', type: 'percentage', value: 50, stackable: true },
  ]);
  assert.equal(allocated.total_discount, '0.02');
  assert.deepEqual(
    allocated.items.map((item) => item.discount),
    ['0.01', '0.01', '0.00'],
  );
});

test('n por m agrupa líneas del SKU y regala las unidades más baratas', () => {
  const split = {
    id: 1,
    items: [
      { id: 1, product_id: 7, sku: 'ABC', quantity: 2, unit_price: '20.00' },
      { id: 2, product_id: 7, sku: 'ABC', quantity: 1, unit_price: '10.00' },
    ],
  };
  const result = calculateDiscounts(split, [promotion[1]!]);
  assert.equal(result.total_discount, '10.00');
  assert.deepEqual(
    result.items.map((item) => item.discount),
    ['0.00', '10.00'],
  );
  assert.equal(
    calculateDiscounts(split, [{ ...promotion[1]!, applicable_skus: ['XYZ'] }]).total_discount,
    '0.00',
  );
});

test('sin cupones, sin ítems, valores exactos grandes y porcentajes fraccionarios', () => {
  assert.equal(calculateDiscounts({ id: 1, items: [] }, promotion).total, '0.00');
  assert.equal(calculateDiscounts(order, []).total, '180.00');
  const big = {
    id: 1,
    items: [
      { id: 1, product_id: 1, sku: 'A', quantity: 2147483647, unit_price: '9999999999999999.99' },
    ],
  };
  assert.equal(
    calculateDiscounts(big, [{ code: 'FREE', type: 'percentage', value: 100, stackable: true }])
      .total,
    '0.00',
  );
  const fractional = calculateDiscounts(order, [
    { code: 'FRACTION', type: 'percentage', value: '12.345', stackable: true },
  ]);
  assert.equal(fractional.total_discount, '22.22');
});

test('máximo global coincide con enumeración exhaustiva para conjuntos pequeños', () => {
  let seed = 42;
  const random = (max: number) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % max;
  };
  for (let run = 0; run < 100; run++) {
    const coupons: Coupon[] = Array.from({ length: 6 }, (_, index) => ({
      code: `C${index}`,
      type: random(2) ? 'percentage' : 'fixed_amount',
      value: random(101),
      stackable: random(3) !== 0,
      ...(random(2) ? { applicable_skus: ['ABC'] } : {}),
    }));
    const single = coupons.map((coupon) =>
      calculateDiscounts(order, [coupon]).items.map((item) => cents(item.discount)),
    );
    const amounts = order.items.map((item) => cents(item.unit_price) * BigInt(item.quantity));
    let best = 0n;
    for (let mask = 0; mask < 1 << coupons.length; mask++) {
      const chosen = coupons
        .map((coupon, index) => ({ coupon, index }))
        .filter((entry) => mask & (1 << entry.index));
      if (chosen.length > 1 && chosen.some((entry) => !entry.coupon.stackable)) continue;
      const total = amounts.reduce((amount, cap, index) => {
        const discount = chosen.reduce((value, entry) => value + single[entry.index]![index]!, 0n);
        return amount + (discount < cap ? discount : cap);
      }, 0n);
      if (total > best) best = total;
    }
    assert.equal(calculateDiscounts(order, coupons).total_discount, money(best));
  }
});
