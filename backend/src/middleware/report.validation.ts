import { query } from 'express-validator';
import { isoDate, onlyKeys } from './order.validation';
import { validateRequest } from './validate';
export const topCustomersValidation = [
  query().custom((value) => onlyKeys(value, ['as_of'])),
  isoDate('as_of'),
  validateRequest,
];
