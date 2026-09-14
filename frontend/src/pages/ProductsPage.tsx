import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { fetchProducts, changeProductStock } from '../features/products/productsSlice';

const currency = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' });

export default function ProductsPage() {
  const dispatch = useAppDispatch();
  const { items, loading, error, saving, stockErrors } = useAppSelector(state => state.products);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [stockValue, setStockValue] = useState('');
  const [validationError, setValidationError] = useState('');
  const [notice, setNotice] = useState('');
  const isSaving = Object.values(saving).some(Boolean);

  useEffect(() => {
    const request = dispatch(fetchProducts({}));
    return () => request.abort();
  }, [dispatch]);

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    setEditingId(null);
    setNotice('');
    void dispatch(fetchProducts({ search, category }));
  }

  async function handleStockChange(event: FormEvent, id: string) {
    event.preventDefault();
    const stock = Number(stockValue);
    if (!stockValue.trim() || !Number.isInteger(stock) || stock < 0 || stock > 2147483647) {
      setValidationError('Ingresa un entero entre 0 y 2147483647.');
      return;
    }
    setValidationError('');
    setNotice('');
    const result = await dispatch(changeProductStock({ id, stock }));
    if (changeProductStock.fulfilled.match(result)) {
      setEditingId(null);
      setNotice('Stock actualizado correctamente.');
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 border-b border-slate-200 pb-6">
          <p className="mb-2 text-sm font-semibold tracking-widest text-emerald-700">ECOFOR · GESTIÓN DE PRODUCTOS</p>
          <h1 className="text-3xl font-bold">Inventario ECOFOR</h1>
          <p className="mt-2 text-slate-600">Consulta productos y actualiza sus existencias.</p>
        </header>
        <form onSubmit={handleSearch} className="mb-6 flex flex-wrap items-end gap-3 rounded-xl bg-white p-5 shadow-sm">
          <label className="flex min-w-52 flex-1 flex-col gap-1 text-sm font-medium">
            Nombre o código
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Ej. taladro o PRD-001" className="rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <label className="flex min-w-48 flex-col gap-1 text-sm font-medium">
            Categoría
            <input value={category} onChange={event => setCategory(event.target.value)} placeholder="Ej. Seguridad" className="rounded-lg border border-slate-300 px-3 py-2" />
          </label>
          <button disabled={loading || isSaving} className="rounded-lg bg-emerald-700 px-5 py-2 text-white">Buscar</button>
          <button type="button" disabled={loading || isSaving} onClick={() => {
            setSearch(''); setCategory(''); setEditingId(null); setNotice(''); void dispatch(fetchProducts({}));
          }} className="rounded-lg border border-slate-300 px-5 py-2">Limpiar</button>
        </form>
        <div aria-live="polite" className="mb-4">
          {loading && <p>Cargando productos...</p>}
          {notice && <p className="text-emerald-700">{notice}</p>}
          {!loading && !error && <p className="text-sm text-slate-600">{items.length} productos encontrados</p>}
        </div>
        {error && <div role="alert" className="mb-4 rounded-lg bg-red-50 p-4 text-red-700">{error}. Comprueba que la API esté disponible y vuelve a buscar.</div>}
        {!loading && !error && items.length === 0 && <p className="rounded-xl bg-white p-8 text-center">No se encontraron productos.</p>}
        {items.length > 0 && !loading && !error && (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <caption className="sr-only">Productos del inventario y edición de stock</caption>
              <thead className="bg-slate-50 text-slate-600"><tr>
                {['Código', 'Producto', 'Categoría', 'Precio', 'Stock', 'Acción'].map(title => <th scope="col" key={title} className="whitespace-nowrap p-4 text-left">{title}</th>)}
              </tr></thead>
              <tbody>{items.map(product => (
                <tr key={product.id} className="border-t border-slate-100">
                  <td className="whitespace-nowrap p-4 font-mono text-xs">{product.codigo}</td>
                  <td className="p-4 font-medium">{product.nombre}</td>
                  <td className="p-4 text-slate-600">{product.categoria}</td>
                  <td className="whitespace-nowrap p-4 tabular-nums">{currency.format(product.precio)}</td>
                  <td className="p-4 tabular-nums">{product.stock}</td>
                  <td className="p-4">
                    {editingId === product.id ? (
                      <form onSubmit={event => void handleStockChange(event, product.id)} className="flex min-w-64 flex-wrap gap-2">
                        <label className="text-xs">Nuevo stock de {product.codigo}
                          <input autoFocus type="number" min="0" max="2147483647" step="1" required value={stockValue} disabled={saving[product.id]} onChange={event => setStockValue(event.target.value)} className="mt-1 block w-28 rounded border border-slate-300 p-2 text-sm" />
                        </label>
                        <button disabled={saving[product.id]} className="self-end rounded bg-emerald-700 px-3 py-2 text-white">{saving[product.id] ? 'Guardando...' : 'Guardar'}</button>
                        <button type="button" disabled={saving[product.id]} onClick={() => setEditingId(null)} className="self-end rounded border px-3 py-2">Cancelar</button>
                        {(validationError || stockErrors[product.id]) && <p role="alert" className="w-full text-red-700">{validationError || stockErrors[product.id]}</p>}
                      </form>
                    ) : (
                      <button disabled={isSaving} onClick={() => { setEditingId(product.id); setStockValue(String(product.stock)); setValidationError(''); setNotice(''); }} className="whitespace-nowrap rounded-lg border border-slate-300 px-3 py-2 hover:bg-slate-50">Editar stock</button>
                    )}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
