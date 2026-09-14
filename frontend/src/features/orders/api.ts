import { requestJson } from '../../shared/api/http';
import type {
  CatalogFilters,
  CatalogPage,
  CatalogProduct,
  Customer,
  NewOrder,
  OrderDetail,
  OrderFilters,
  OrdersResponse,
  OrderStatus,
} from './types';

export const getOrders = (filters: OrderFilters, signal?: AbortSignal) =>
  requestJson<OrdersResponse>('/orders', { signal }, { ...filters });
export async function getOrder(id: number, signal?: AbortSignal) {
  return (await requestJson<{ data: OrderDetail }>(`/orders/${id}`, { signal })).data;
}
export async function createOrder(payload: NewOrder) {
  return (
    await requestJson<{ data: OrderDetail }>('/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  ).data;
}
export const getCustomers = (filters: CatalogFilters, signal?: AbortSignal) =>
  requestJson<CatalogPage<Customer>>('/customers', { signal }, { ...filters });
export const getCatalogProducts = (filters: CatalogFilters, signal?: AbortSignal) =>
  requestJson<CatalogPage<CatalogProduct>>('/catalog/products', { signal }, { ...filters });
export async function updateOrderStatus(
  id: number,
  status: OrderStatus,
  expectedStatus: OrderStatus,
) {
  return requestJson(`/orders/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, expected_status: expectedStatus }),
  });
}
