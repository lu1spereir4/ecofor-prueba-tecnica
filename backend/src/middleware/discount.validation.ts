import { body } from 'express-validator';
import { decimalMoneyInput, decimalRatio } from '../utils/money';
import { orderId, onlyKeys, positiveInteger } from './order.validation';
import { validateRequest } from './validate';

function decimal(value: unknown): value is string | number {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0;
  return typeof value === 'string' && value.length <= 1000 && /^\d+(?:\.\d+)?$/.test(value);
}
function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 512;
}
function validateCoupon(value: unknown) {
  onlyKeys(value, [
    'code',
    'type',
    'stackable',
    'value',
    'sku',
    'n',
    'm',
    'min_amount',
    'applicable_skus',
  ]);
  const coupon = value as Record<string, unknown>;
  if (!text(coupon.code))
    throw new Error('code debe ser un texto no vacío de hasta 512 caracteres');
  if (typeof coupon.stackable !== 'boolean') throw new Error('stackable debe ser boolean');
  if (coupon.min_amount !== undefined) {
    if (!decimal(coupon.min_amount)) throw new Error('min_amount debe ser un monto no negativo');
    decimalMoneyInput(coupon.min_amount);
  }
  if (
    coupon.applicable_skus !== undefined &&
    (!Array.isArray(coupon.applicable_skus) || !coupon.applicable_skus.every(text))
  )
    throw new Error('applicable_skus debe ser un array de SKU no vacíos');
  if (coupon.type === 'percentage' || coupon.type === 'fixed_amount') {
    if (coupon.sku !== undefined || coupon.n !== undefined || coupon.m !== undefined)
      throw new Error('sku, n y m son campos exclusivos de n_for_m');
    if (!decimal(coupon.value)) throw new Error('value debe ser un decimal no negativo');
    if (coupon.type === 'percentage') {
      const ratio = decimalRatio(coupon.value);
      if (ratio.numerator > 100n * ratio.denominator)
        throw new Error('El porcentaje debe estar entre 0 y 100');
    } else decimalMoneyInput(coupon.value);
  } else if (coupon.type === 'n_for_m') {
    if (coupon.value !== undefined) throw new Error('n_for_m no admite value');
    if (
      !text(coupon.sku) ||
      !positiveInteger(coupon.n) ||
      typeof coupon.m !== 'number' ||
      !Number.isInteger(coupon.m) ||
      coupon.m < 0 ||
      coupon.m > Number(coupon.n)
    )
      throw new Error('n_for_m requiere sku, n entero positivo y m entero entre 0 y n');
  } else throw new Error('type debe ser percentage, fixed_amount o n_for_m');
  return true;
}

export const discountValidation = [
  orderId(),
  body()
    .custom((value) => onlyKeys(value, ['coupons']))
    .bail({ level: 'request' }),
  body('coupons')
    .isArray({ max: 30 })
    .withMessage('coupons debe ser un array con un máximo de 30 cupones')
    .bail({ level: 'request' }),
  body('coupons.*').custom(validateCoupon),
  body('coupons').custom((coupons: { code?: unknown }[]) => {
    const codes = coupons.map((coupon) => coupon?.code);
    if (new Set(codes).size !== codes.length)
      throw new Error('Los codes de cupones deben ser únicos');
    return true;
  }),
  validateRequest,
];
