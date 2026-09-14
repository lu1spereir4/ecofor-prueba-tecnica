import { useEffect, useRef, useState } from 'react';
import { ApiError, errorNotice } from '../../../shared/api/http';
import type { ErrorNotice } from '../../../shared/api/http';
import { formatAmount } from '../../../shared/format';
import { createOrder, getCatalogProducts, getCustomers } from '../api';
import { draftItemViews, estimatedTotal, validateOrderDraft } from '../models';
import type { DraftItem } from '../models';
import type { Customer, OrderDetail } from '../types';
import { useCatalogPage } from './useCatalogPage';

export function useCreateOrder(
  onCreated: (order: OrderDetail) => void,
  onBusyChange: (busy: boolean) => void,
) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<ErrorNotice | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const customers = useCatalogPage(getCustomers, 'clientes', submitting);
  const products = useCatalogPage(getCatalogProducts, 'productos', submitting);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      onBusyChange(false);
    };
  }, [onBusyChange]);
  async function submit() {
    if (inFlight.current || uncertain) return;
    const validation = validateOrderDraft(customer, items);
    setErrors(validation);
    setError(null);
    if (Object.keys(validation).length || !customer) return;
    inFlight.current = true;
    setSubmitting(true);
    onBusyChange(true);
    try {
      const order = await createOrder({
        customer_id: customer.id,
        items: items.map((item) => ({
          product_id: item.product.id,
          quantity: Number(item.quantity),
        })),
      });
      if (mounted.current) onCreated(order);
    } catch (reason) {
      if (!mounted.current) return;
      if (
        reason instanceof ApiError &&
        (reason.status === 0 || (reason.code === 'INVALID_RESPONSE' && reason.status < 300))
      ) {
        setUncertain(true);
        setError({
          message:
            'No pudimos confirmar la respuesta. Revisa el listado antes de repetir la creación para evitar un pedido duplicado.',
          code: reason.code,
          details: [],
        });
      } else setError(errorNotice(reason));
    } finally {
      inFlight.current = false;
      if (mounted.current) {
        setSubmitting(false);
        onBusyChange(false);
      }
    }
  }
  return {
    customers: {
      ...customers,
      options:
        !customers.loading && !customers.error
          ? customers.data.map((row) => ({
              id: row.id,
              label: row.full_name,
              description: `${row.email} · ${row.city}`,
              selected: row.id === customer?.id,
              disabled: submitting,
            }))
          : [],
    },
    products: {
      ...products,
      options:
        !products.loading && !products.error
          ? products.data.map((row) => ({
              id: row.id,
              label: row.name,
              description: `${row.sku} · ${formatAmount(row.price)} · Stock: ${row.stock}`,
              selected: false,
              disabled: submitting || row.stock === 0,
            }))
          : [],
    },
    selectedCustomer: customer
      ? `${customer.full_name} · ${customer.email}`
      : 'Ningún cliente seleccionado',
    selectCustomer: (id: number) => {
      if (!submitting) {
        setCustomer(customers.data.find((row) => row.id === id) ?? null);
        setErrors((current) => ({ ...current, customer: '' }));
      }
    },
    addProduct: (id: number) => {
      if (submitting) return;
      const product = products.data.find((row) => row.id === id);
      if (!product || product.stock < 1) return;
      setItems((current) => {
        const existing = current.find((item) => item.product.id === id);
        if (existing)
          return current.map((item) =>
            item.product.id === id
              ? {
                  product,
                  quantity: String(Math.min((Number(item.quantity) || 0) + 1, 2147483647)),
                }
              : item,
          );
        return [...current, { product, quantity: '1' }];
      });
      setErrors((current) => ({ ...current, items: '', [`quantity-${id}`]: '' }));
    },
    setQuantity: (id: number, quantity: string) => {
      if (!submitting) {
        setItems((current) =>
          current.map((item) => (item.product.id === id ? { ...item, quantity } : item)),
        );
        setErrors((current) => ({ ...current, [`quantity-${id}`]: '' }));
      }
    },
    removeItem: (id: number) => {
      if (!submitting) setItems((current) => current.filter((item) => item.product.id !== id));
    },
    items: draftItemViews(items),
    totalLabel: estimatedTotal(items),
    errors,
    error,
    submitting,
    uncertain,
    submit,
  };
}
