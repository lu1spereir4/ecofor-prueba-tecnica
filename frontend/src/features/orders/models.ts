import { formatAmount, formatDate, fromCents, toCents } from '../../shared/format';
import { statusLabels } from './types';
import type { CatalogProduct, Customer, Order, OrderDetail } from './types';

export interface DraftItem {
  product: CatalogProduct;
  quantity: string;
}
export const validQuantity = (value: string) =>
  /^\d+$/.test(value) &&
  Number.isInteger(Number(value)) &&
  Number(value) > 0 &&
  Number(value) <= 2147483647;
export function validateOrderDraft(customer: Customer | null, items: DraftItem[]) {
  const errors: Record<string, string> = {};
  if (!customer) errors.customer = 'Selecciona un cliente.';
  if (!items.length) errors.items = 'Agrega al menos un producto.';
  for (const item of items)
    if (!validQuantity(item.quantity))
      errors[`quantity-${item.product.id}`] = 'Ingresa una cantidad entera entre 1 y 2147483647.';
  return errors;
}
export function listRow(order: Order) {
  return {
    id: order.id,
    reference: order.order_ref,
    customer: order.customer_name ?? 'Cliente sin ficha',
    email: order.customer_email,
    statusLabel: statusLabels[order.status],
    statusTone: order.status,
    dateLabel: formatDate(order.created_at),
    totalLabel: formatAmount(order.total),
    detailHref: `#/orders/${order.id}`,
  };
}
export function orderDetailView(order: OrderDetail) {
  return {
    ...listRow(order),
    channel: order.channel,
    city: order.city ?? 'Ciudad no disponible',
    customerLinked: order.customer_linked,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.product_id,
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
      priceLabel: formatAmount(item.unit_price),
      amountLabel: formatAmount(item.amount),
    })),
  };
}
export function draftItemViews(items: DraftItem[]) {
  return items.map(({ product, quantity }) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    stock: product.stock,
    quantity,
    priceLabel: formatAmount(product.price),
    amountLabel: validQuantity(quantity)
      ? formatAmount(fromCents(toCents(product.price) * BigInt(quantity)))
      : '—',
  }));
}
export function estimatedTotal(items: DraftItem[]) {
  if (items.some((item) => !validQuantity(item.quantity))) return '—';
  return formatAmount(
    fromCents(
      items.reduce(
        (total, item) => total + toCents(item.product.price) * BigInt(item.quantity),
        0n,
      ),
    ),
  );
}
export type OrderRowView = ReturnType<typeof listRow>;
export type OrderDetailView = ReturnType<typeof orderDetailView>;
export type DraftItemView = ReturnType<typeof draftItemViews>[number];
