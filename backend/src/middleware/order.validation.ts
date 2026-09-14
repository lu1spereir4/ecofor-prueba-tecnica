import { body, param, query } from 'express-validator';
import { statuses } from '../repositories/order.repository';
import { normalizeDate } from '../utils/dates';
import { decodeCursor } from '../utils/order-cursor';
import { validateRequest } from './validate';

export function onlyKeys(value: unknown, keys: string[]): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Se requiere un objeto JSON');
  if (Object.keys(value).some((key) => !keys.includes(key)))
    throw new Error(`Campos admitidos: ${keys.join(', ')}`);
  return true;
}
export const positiveInteger = (value: unknown): boolean =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 2147483647;
export const orderId = () =>
  param('id')
    .isString()
    .bail()
    .matches(/^[1-9]\d*$/)
    .bail()
    .isInt({ min: 1, max: 2147483647 });
export const pageLimit = () =>
  query('limit').optional().isString().bail().isInt({ min: 1, max: 100 });
export const isoDate = (field: string) =>
  query(field)
    .optional()
    .isString()
    .bail()
    .isISO8601({ strict: true, strictSeparator: true })
    .bail()
    .custom((value) => {
      normalizeDate(value);
      return true;
    });

export const createOrderValidation = [
  body()
    .custom((value) => onlyKeys(value, ['customer_id', 'items']))
    .bail({ level: 'request' }),
  body('customer_id')
    .custom(positiveInteger)
    .withMessage('customer_id debe ser un entero positivo'),
  body('items')
    .isArray({ min: 1 })
    .withMessage('items debe ser un array no vacío')
    .bail({ level: 'request' }),
  body('items.*').custom((value) => onlyKeys(value, ['product_id', 'quantity'])),
  body('items.*.product_id')
    .custom(positiveInteger)
    .withMessage('product_id debe ser un entero positivo'),
  body('items.*.quantity')
    .custom(positiveInteger)
    .withMessage('quantity debe ser un entero positivo'),
  body('items').custom((items: unknown[]) => {
    const totals = new Map<number, number>();
    for (const item of items) {
      const row = item as { product_id?: number; quantity?: number } | null;
      if (row && positiveInteger(row.product_id) && positiveInteger(row.quantity)) {
        const total = (totals.get(row.product_id!) ?? 0) + row.quantity!;
        if (total > 2147483647)
          throw new Error('La cantidad acumulada de un producto supera el rango de stock');
        totals.set(row.product_id!, total);
      }
    }
    return true;
  }),
  validateRequest,
];
export const listOrdersValidation = [
  query().custom((value) =>
    onlyKeys(value, [
      'limit',
      'status',
      'customer',
      'customer_email',
      'order_ref',
      'from',
      'to',
      'cursor',
    ]),
  ),
  pageLimit(),
  query('status').optional().isString().bail().isIn(statuses),
  query('customer').optional().isString().bail().trim().isLength({ min: 1, max: 512 }),
  query('customer_email').optional().isString().bail().isLength({ min: 1, max: 512 }),
  query('order_ref').optional().isString().bail().isLength({ min: 1, max: 512 }),
  isoDate('from'),
  isoDate('to'),
  query('to')
    .optional()
    .custom((value, { req }) => {
      if (
        typeof value === 'string' &&
        typeof req.query?.from === 'string' &&
        normalizeDate(value) < normalizeDate(req.query.from)
      )
        throw new Error('to debe ser igual o posterior a from');
      return true;
    }),
  query('cursor')
    .optional()
    .isString()
    .bail()
    .custom((value) => {
      decodeCursor(value);
      return true;
    }),
  validateRequest,
];
export const detailOrderValidation = [orderId(), validateRequest];
export const statusOrderValidation = [
  orderId(),
  body('status').isString().bail().isIn(statuses),
  body('expected_status').isString().bail().isIn(statuses),
  validateRequest,
];
export const catalogValidation = [
  query().custom((value) => onlyKeys(value, ['limit', 'after', 'search'])),
  pageLimit(),
  query('after').optional().isString().bail().isLength({ min: 1, max: 512 }),
  query('search').optional().isString().bail().trim().isLength({ max: 512 }),
  validateRequest,
];
