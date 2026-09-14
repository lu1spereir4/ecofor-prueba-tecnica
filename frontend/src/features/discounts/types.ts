export type CouponType = 'percentage' | 'fixed_amount' | 'n_for_m';

interface CouponConditions {
  code: string;
  stackable: boolean;
  min_amount?: string;
  applicable_skus?: string[];
}
export type Coupon = CouponConditions &
  (
    | { type: 'percentage' | 'fixed_amount'; value: string }
    | { type: 'n_for_m'; sku: string; n: number; m: number }
  );

export interface CouponDraft {
  id: number;
  code: string;
  type: CouponType;
  stackable: boolean;
  value: string;
  sku: string;
  n: string;
  m: string;
  minAmount: string;
  allSkus: boolean;
  applicableSkus: string[];
}
export type CouponChange = Partial<Omit<CouponDraft, 'id'>>;
export interface OrderProduct {
  sku: string;
  name: string;
}
export interface DiscountResult {
  order_id: number;
  subtotal: string;
  applied_coupons: string[];
  total_discount: string;
  total: string;
  items: {
    product_id: number;
    sku: string;
    quantity: number;
    unit_price: string;
    amount: string;
    discount: string;
    final_amount: string;
    coupons: string[];
  }[];
}
