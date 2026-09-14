export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'cancelled';
export const statusLabels: Record<OrderStatus, string> = {
  pending: 'Pendiente',
  paid: 'Pagado',
  shipped: 'Enviado',
  cancelled: 'Cancelado',
};
export const statusOptions = Object.entries(statusLabels).map(([value, label]) => ({
  value,
  label,
}));
export interface Customer {
  id: number;
  email: string;
  full_name: string;
  city: string;
}
export interface CatalogProduct {
  id: number;
  sku: string;
  name: string;
  price: string;
  stock: number;
}
export interface CatalogPage<T> {
  data: T[];
  nextCursor: string | null;
}
export interface Order {
  id: number;
  order_ref: string;
  customer_id: number | null;
  customer_email: string;
  customer_name: string | null;
  customer_linked: boolean;
  city: string | null;
  status: OrderStatus;
  created_at: string;
  channel: string;
  total: string;
  item_count?: number;
}
export interface OrderItem {
  id: number;
  source_row: string | null;
  product_id: number;
  sku: string;
  name: string;
  quantity: number;
  unit_price: string;
  amount: string;
  subtotal: string;
}
export interface OrderDetail extends Order {
  customer: Customer | null;
  items: OrderItem[];
}
export interface OrderFilters {
  customer?: string;
  status?: string;
  from?: string;
  to?: string;
  limit: number;
  cursor?: string;
}
export interface OrdersResponse {
  data: Order[];
  nextCursor: string | null;
  page_size: number;
  has_more: boolean;
}
export interface NewOrder {
  customer_id: number;
  items: { product_id: number; quantity: number }[];
}
export interface CatalogFilters {
  search?: string;
  after?: string;
  limit: number;
}
