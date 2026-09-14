export interface Product {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string;
  precio: number;
  stock: number;
  proveedor: string | null;
  fecha_actualizacion: string;
}

export interface ProductsResponse {
  data: Product[];
  count: number;
}

export interface ProductFilters {
  search?: string;
  category?: string;
}
