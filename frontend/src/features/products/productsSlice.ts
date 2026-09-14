import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { getProducts, updateStock } from '../../services/productsApi';
import type { Product, ProductFilters } from './types';

interface ProductsState {
  items: Product[];
  loading: boolean;
  error: string | null;
  requestId: string | null;
  saving: Record<string, boolean>;
  stockErrors: Record<string, string | null>;
}
const initialState: ProductsState = {
  items: [], loading: false, error: null, requestId: null, saving: {}, stockErrors: {},
};

export const fetchProducts = createAsyncThunk(
  'products/fetchProducts',
  async (params: ProductFilters = {}, { signal }) => (await getProducts(params, signal)).data,
);

export const changeProductStock = createAsyncThunk(
  'products/changeStock',
  async ({ id, stock }: { id: string; stock: number }) => updateStock(id, stock),
);

const productsSlice = createSlice({
  name: 'products', initialState, reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchProducts.pending, (state, action) => {
        state.loading = true;
        state.error = null;
        state.requestId = action.meta.requestId;
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        if (state.requestId !== action.meta.requestId) return;
        state.loading = false;
        state.items = action.payload;
        state.requestId = null;
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        if (state.requestId !== action.meta.requestId) return;
        state.loading = false;
        state.requestId = null;
        state.error = action.meta.aborted ? null : action.error.message ?? 'Error cargando productos';
      })
      .addCase(changeProductStock.pending, (state, action) => {
        state.saving[action.meta.arg.id] = true;
        state.stockErrors[action.meta.arg.id] = null;
      })
      .addCase(changeProductStock.fulfilled, (state, action) => {
        state.saving[action.meta.arg.id] = false;
        const index = state.items.findIndex(product => product.id === action.payload.id);
        if (index !== -1) state.items[index] = action.payload;
      })
      .addCase(changeProductStock.rejected, (state, action) => {
        state.saving[action.meta.arg.id] = false;
        state.stockErrors[action.meta.arg.id] = action.error.message ?? 'Error actualizando stock';
      });
  },
});
export default productsSlice.reducer;
