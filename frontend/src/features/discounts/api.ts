import { requestJson } from '../../shared/api/http';
import type { Coupon, DiscountResult } from './types';

export function previewDiscounts(orderId: number, coupons: Coupon[], signal: AbortSignal) {
  return requestJson<DiscountResult>(`/orders/${orderId}/apply-discounts`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ coupons }),
  });
}
