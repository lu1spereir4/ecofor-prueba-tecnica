import { requestJson } from '../../shared/api/http';
import type { CatalogProduct } from '../orders/types';
export { getCatalogProducts as getProducts } from '../orders/api';
export async function updateStock(id: number, stock: number) {
  return (
    await requestJson<{ data: CatalogProduct }>(`/catalog/products/${id}/stock`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock }),
    })
  ).data;
}
