import { requestJson } from '../../shared/api/http';
import type { Product, ProductFilters, ProductsResponse } from './types';
export async function getProducts(filters: ProductFilters, signal?: AbortSignal) {
  return (await requestJson<ProductsResponse>('/products', { signal }, { ...filters })).data;
}
export async function updateStock(id: string, stock: number) {
  return (
    await requestJson<{ data: Product }>(`/products/${encodeURIComponent(id)}/stock`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock }),
    })
  ).data;
}
