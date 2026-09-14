import { useCallback, useEffect, useRef, useState } from 'react';
import { getProducts, updateStock } from '../api';
import { errorNotice } from '../../../shared/api/http';
import { useReadRequest } from '../../../shared/hooks/useReadRequest';
const currency = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' });
export function useInventory(enabled: boolean) {
  const [draft, setDraft] = useState({ search: '', category: '' });
  const [query, setQuery] = useState({ search: '', category: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [stock, setStock] = useState('');
  const [stockError, setStockError] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const load = useCallback((signal: AbortSignal) => getProducts(query, signal), [query]);
  const { data, loading, error, updateData } = useReadRequest(load, enabled);
  const items = data ?? [];
  async function save() {
    if (!editingId || busy.current) return;
    if (!/^\d+$/.test(stock) || Number(stock) > 2147483647) {
      setStockError('Ingresa un entero entre 0 y 2147483647.');
      return;
    }
    busy.current = true;
    setSaving(true);
    setStockError('');
    setNotice('');
    try {
      const updated = await updateStock(editingId, Number(stock));
      if (mounted.current) {
        updateData((current) =>
          (current ?? []).map((item) => (item.id === updated.id ? updated : item)),
        );
        setEditingId(null);
        setNotice('Stock actualizado correctamente.');
      }
    } catch (reason) {
      if (mounted.current) setStockError(errorNotice(reason).message);
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  }
  return {
    rows:
      !loading && !error
        ? items.map((item) => ({
            id: item.id,
            code: item.codigo,
            name: item.nombre,
            category: item.categoria,
            priceLabel: currency.format(item.precio),
            stock: item.stock,
          }))
        : [],
    draft,
    loading,
    error,
    editingId,
    stock,
    stockError,
    saving,
    notice,
    save,
    setField: (field: 'search' | 'category', value: string) =>
      setDraft((current) => ({ ...current, [field]: value })),
    search: () => {
      if (!saving) {
        setEditingId(null);
        setQuery({ search: draft.search.trim(), category: draft.category.trim() });
      }
    },
    clear: () => {
      if (!saving) {
        setDraft({ search: '', category: '' });
        setQuery({ search: '', category: '' });
        setEditingId(null);
      }
    },
    retry: () => setQuery((current) => ({ ...current })),
    edit: (id: string) => {
      if (!saving) {
        const item = items.find((row) => row.id === id);
        if (item) {
          setEditingId(id);
          setStock(String(item.stock));
          setStockError('');
          setNotice('');
        }
      }
    },
    setStock: (value: string) => {
      if (!saving) setStock(value);
    },
    cancel: () => {
      if (!saving) setEditingId(null);
    },
  };
}
