import { formatAmount } from '../../shared/format';
import type { Coupon, CouponDraft, DiscountResult, OrderProduct } from './types';

export const MAX_COUPONS = 30;
export const couponTypes = [
  { value: 'percentage', label: 'Porcentaje' },
  { value: 'fixed_amount', label: 'Monto fijo' },
  { value: 'n_for_m', label: 'N por M' },
];

export function newCoupon(id: number): CouponDraft {
  return {
    id,
    code: '',
    type: 'percentage',
    stackable: true,
    value: '',
    sku: '',
    n: '3',
    m: '2',
    minAmount: '',
    allSkus: true,
    applicableSkus: [],
  };
}

const money = (value: string) => value.length <= 1000 && /^\d+(?:\.\d{1,2})?$/.test(value);
const integer = (value: string, minimum: number) =>
  /^\d+$/.test(value) && Number(value) >= minimum && Number(value) <= 2147483647;
function percentage(value: string) {
  if (value.length > 1000 || !/^\d+(?:\.\d+)?$/.test(value)) return false;
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole + fraction) <= 100n * 10n ** BigInt(fraction.length);
}

export function buildCoupons(drafts: CouponDraft[]) {
  const errors: Record<string, string> = {};
  if (drafts.length > MAX_COUPONS) errors.form = `Se permiten hasta ${MAX_COUPONS} cupones.`;
  const codes = new Set<string>();
  for (const draft of drafts) {
    const code = draft.code.trim();
    const field = (name: string, message: string) => {
      errors[`${draft.id}.${name}`] = message;
    };
    if (!code || code.length > 512) field('code', 'Ingresa un código de hasta 512 caracteres.');
    else if (codes.has(code)) field('code', 'El código debe ser único.');
    codes.add(code);
    if (draft.minAmount && !money(draft.minAmount))
      field('minAmount', 'Ingresa un monto no negativo con hasta dos decimales.');
    if (draft.type === 'percentage' && !percentage(draft.value))
      field('value', 'Ingresa un porcentaje entre 0 y 100.');
    if (draft.type === 'fixed_amount' && !money(draft.value))
      field('value', 'Ingresa un monto no negativo con hasta dos decimales.');
    if (draft.type === 'n_for_m') {
      if (!draft.sku) field('sku', 'Selecciona el producto de la promoción.');
      if (!integer(draft.n, 1)) field('n', 'N debe ser un entero positivo.');
      if (!integer(draft.m, 0) || Number(draft.m) > Number(draft.n))
        field('m', 'M debe ser un entero entre 0 y N.');
    }
  }
  if (Object.keys(errors).length) return { errors, coupons: null };
  const coupons: Coupon[] = drafts.map((draft) => {
    const conditions = {
      code: draft.code.trim(),
      stackable: draft.stackable,
      ...(draft.minAmount ? { min_amount: draft.minAmount } : {}),
      ...(!draft.allSkus ? { applicable_skus: [...draft.applicableSkus] } : {}),
    };
    return draft.type === 'n_for_m'
      ? { ...conditions, type: draft.type, sku: draft.sku, n: Number(draft.n), m: Number(draft.m) }
      : { ...conditions, type: draft.type, value: draft.value };
  });
  return { errors, coupons };
}

export function couponEditorView(
  draft: CouponDraft,
  position: number,
  errors: Record<string, string>,
) {
  return {
    ...draft,
    position,
    bundle: draft.type === 'n_for_m',
    valueLabel: draft.type === 'percentage' ? 'Porcentaje (%)' : 'Monto del descuento',
    errors: Object.fromEntries(
      Object.entries(errors)
        .filter(([key]) => key.startsWith(`${draft.id}.`))
        .map(([key, value]) => [key.split('.')[1], value]),
    ),
  };
}

export function discountResultView(result: DiscountResult, products: OrderProduct[]) {
  const names = new Map(products.map((product) => [product.sku, product.name]));
  return {
    subtotal: formatAmount(result.subtotal),
    discount: formatAmount(result.total_discount),
    total: formatAmount(result.total),
    coupons: result.applied_coupons.join(', ') || 'Ninguno',
    items: result.items.map((item, index) => ({
      key: index,
      name: names.get(item.sku) ?? item.sku,
      sku: item.sku,
      quantity: item.quantity,
      price: formatAmount(item.unit_price),
      amount: formatAmount(item.amount),
      discount: formatAmount(item.discount),
      finalAmount: formatAmount(item.final_amount),
      coupons: item.coupons.join(', ') || '—',
    })),
  };
}
export type CouponEditorView = ReturnType<typeof couponEditorView>;
export type DiscountResultView = ReturnType<typeof discountResultView>;
