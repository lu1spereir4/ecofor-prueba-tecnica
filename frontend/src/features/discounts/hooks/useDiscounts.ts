import { useEffect, useRef, useState } from 'react';
import { errorNotice } from '../../../shared/api/http';
import type { ErrorNotice } from '../../../shared/api/http';
import { previewDiscounts } from '../api';
import {
  buildCoupons,
  couponEditorView,
  discountResultView,
  MAX_COUPONS,
  newCoupon,
} from '../models';
import type { CouponChange, CouponDraft, DiscountResult, OrderProduct } from '../types';

export function useDiscounts(orderId: number, products: OrderProduct[], disabled: boolean) {
  const [drafts, setDrafts] = useState<CouponDraft[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<ErrorNotice | null>(null);
  const [result, setResult] = useState<DiscountResult | null>(null);
  const [pending, setPending] = useState(false);
  const nextId = useRef(1);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const blocked = disabled || products.length > 100;

  function invalidate() {
    request.current?.abort();
    request.current = null;
    setPending(false);
    setResult(null);
    setError(null);
    setErrors({});
  }
  async function simulate() {
    if (blocked || request.current) return;
    const validated = buildCoupons(drafts);
    setErrors(validated.errors);
    setError(null);
    setResult(null);
    if (!validated.coupons) return;
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    try {
      const response = await previewDiscounts(orderId, validated.coupons, controller.signal);
      if (!controller.signal.aborted) setResult(response);
    } catch (reason) {
      if (!controller.signal.aborted) setError(errorNotice(reason));
    } finally {
      if (request.current === controller) {
        request.current = null;
        if (!controller.signal.aborted) setPending(false);
      }
    }
  }
  return {
    editors: drafts.map((draft, index) => couponEditorView(draft, index + 1, errors)),
    options: [
      ...new Map(
        products.map((product) => [
          product.sku,
          { value: product.sku, label: `${product.name} (${product.sku})` },
        ]),
      ).values(),
    ],
    count: `${drafts.length} / ${MAX_COUPONS} cupones`,
    limitReached: drafts.length >= MAX_COUPONS,
    blocked,
    limitMessage: products.length > 100 ? 'La simulación admite pedidos con hasta 100 ítems.' : '',
    pending,
    error,
    formError:
      errors.form ?? (Object.keys(errors).length ? 'Revisa los campos de los cupones.' : ''),
    result: result && !blocked ? discountResultView(result, products) : null,
    add: () => {
      if (blocked || drafts.length >= MAX_COUPONS) return;
      invalidate();
      const draft = newCoupon(nextId.current++);
      setDrafts((current) => [...current, draft]);
    },
    change: (id: number, changes: CouponChange) => {
      if (blocked) return;
      invalidate();
      setDrafts((current) =>
        current.map((draft) => (draft.id === id ? { ...draft, ...changes } : draft)),
      );
    },
    remove: (id: number) => {
      if (blocked) return;
      invalidate();
      setDrafts((current) => current.filter((draft) => draft.id !== id));
    },
    simulate,
  };
}
