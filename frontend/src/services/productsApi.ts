import type { Product, ProductFilters, ProductsResponse } from '../features/products/types';

const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '') + '/products';

async function readResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(result?.message || `Error del servidor: ${response.status}`);
  }
  return response.json();
}

export async function getProducts(params: ProductFilters = {}, signal?: AbortSignal): Promise<ProductsResponse> {
  const url = new URL(API_URL, window.location.origin);
  if (params.search?.trim()) url.searchParams.set('search', params.search.trim());
  if (params.category?.trim()) url.searchParams.set('category', params.category.trim());
  return readResponse<ProductsResponse>(await fetch(url, { signal }));
}

export async function updateStock(id: string, stock: number): Promise<Product> {
  const response = await fetch(`${API_URL}/${encodeURIComponent(id)}/stock`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stock }),
  });
  const result = await readResponse<{ data: Product }>(response);
  return result.data;
}
