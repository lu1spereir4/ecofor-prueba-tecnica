import type { DiscountOrder } from '../repositories/discount.repository';
import { cents, decimalMoneyInput, decimalRatio, money, roundedDivide } from '../utils/money';

interface BaseCoupon {
  code: string;
  stackable: boolean;
  min_amount?: number | string;
  applicable_skus?: string[];
}
export type Coupon = BaseCoupon &
  (
    | { type: 'percentage'; value: number | string }
    | { type: 'fixed_amount'; value: number | string }
    | { type: 'n_for_m'; sku: string; n: number; m: number }
  );
interface CalculatedCoupon {
  coupon: Coupon;
  discounts: bigint[];
}
const minimum = (left: bigint, right: bigint) => (left < right ? left : right);
const sum = (values: bigint[]) => values.reduce((total, value) => total + value, 0n);

// Reparto proporcional en centavos, restos mayores y desempate por orden de ítem.
function allocate(total: bigint, amounts: bigint[]): bigint[] {
  const eligibleAmount = sum(amounts);
  if (!eligibleAmount || !total) return amounts.map(() => 0n);
  total = minimum(total, eligibleAmount);
  const shares = amounts.map((amount) => (total * amount) / eligibleAmount);
  let remaining = total - sum(shares);
  const remainders = amounts
    .map((amount, index) => ({ index, remainder: (total * amount) % eligibleAmount }))
    .sort((a, b) =>
      a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1,
    );
  for (const entry of remainders) {
    if (remaining === 0n) break;
    shares[entry.index] = shares[entry.index]! + 1n;
    remaining--;
  }
  return shares;
}

export function calculateDiscounts(order: DiscountOrder, coupons: Coupon[]) {
  const prices = order.items.map((item) => cents(item.unit_price));
  const amounts = order.items.map((item, index) => prices[index]! * BigInt(item.quantity));
  const subtotal = sum(amounts);
  const calculated: CalculatedCoupon[] = coupons
    .map((coupon) => {
      const empty = () => ({ coupon, discounts: amounts.map(() => 0n) });
      if (coupon.min_amount !== undefined && subtotal < decimalMoneyInput(coupon.min_amount))
        return empty();
      const skus = coupon.applicable_skus === undefined ? null : new Set(coupon.applicable_skus);
      const eligible = order.items.map(
        (item) =>
          (!skus || skus.has(item.sku)) && (coupon.type !== 'n_for_m' || item.sku === coupon.sku),
      );
      const eligibleAmounts = amounts.map((amount, index) => (eligible[index] ? amount : 0n));
      const originalEligible = sum(eligibleAmounts);
      if (coupon.type === 'percentage') {
        const value = decimalRatio(coupon.value);
        const total = roundedDivide(originalEligible * value.numerator, 100n * value.denominator);
        return { coupon, discounts: allocate(total, eligibleAmounts) };
      }
      if (coupon.type === 'fixed_amount')
        return { coupon, discounts: allocate(decimalMoneyInput(coupon.value), eligibleAmounts) };
      // Se cuentan unidades entre líneas, sin expandir cantidades en arrays.
      const quantity = order.items.reduce(
        (count, item, index) => count + (eligible[index] ? BigInt(item.quantity) : 0n),
        0n,
      );
      let freeUnits = (quantity / BigInt(coupon.n)) * BigInt(coupon.n - coupon.m);
      const discounts = amounts.map(() => 0n);
      const lines = order.items
        .map((item, index) => ({ item, index, price: prices[index]! }))
        .filter((line) => eligible[line.index])
        .sort((a, b) => (a.price === b.price ? a.item.id - b.item.id : a.price < b.price ? -1 : 1));
      // Con precios históricos distintos, las unidades gratuitas son las más baratas.
      for (const line of lines) {
        const units = minimum(freeUnits, BigInt(line.item.quantity));
        discounts[line.index] = units * line.price;
        freeUnits -= units;
        if (!freeUnits) break;
      }
      return { coupon, discounts };
    })
    .filter((entry) => sum(entry.discounts) > 0n);

  const evaluate = (selection: CalculatedCoupon[]) => {
    const discounts = amounts.map((amount, index) =>
      minimum(
        amount,
        selection.reduce((total, entry) => total + entry.discounts[index]!, 0n),
      ),
    );
    return { selection, discounts, total: sum(discounts) };
  };
  // Monotonicidad: agregar un acumulable nunca reduce min(monto, suma).
  let best = evaluate(calculated.filter((entry) => entry.coupon.stackable));
  for (const candidate of calculated.filter((entry) => !entry.coupon.stackable)) {
    const exclusive = evaluate([candidate]);
    if (exclusive.total > best.total) best = exclusive;
  }
  return {
    order_id: order.id,
    subtotal: money(subtotal),
    applied_coupons: best.selection.map((entry) => entry.coupon.code),
    total_discount: money(best.total),
    total: money(subtotal - best.total),
    items: order.items.map((item, index) => ({
      product_id: item.product_id,
      sku: item.sku,
      quantity: item.quantity,
      unit_price: money(prices[index]!),
      amount: money(amounts[index]!),
      discount: money(best.discounts[index]!),
      final_amount: money(amounts[index]! - best.discounts[index]!),
      coupons: best.selection
        .filter((entry) => entry.discounts[index]! > 0n)
        .map((entry) => entry.coupon.code),
    })),
  };
}
