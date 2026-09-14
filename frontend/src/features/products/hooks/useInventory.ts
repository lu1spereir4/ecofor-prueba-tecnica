import { useCallback, useEffect, useRef, useState } from 'react';
import { getProducts, updateStock } from '../api';
import { errorNotice } from '../../../shared/api/http';
import { useReadRequest } from '../../../shared/hooks/useReadRequest';
import { formatAmount } from '../../../shared/format';
export function useInventory(enabled: boolean) {
  const [draft, setDraft] = useState({ search: '' });
  const [query, setQuery] = useState({
    search: '',
    cursors: [undefined] as (string | undefined)[],
  });
  const [editingId, setEditingId] = useState<number | null>(null);
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
  const load = useCallback(
    (signal: AbortSignal) =>
      getProducts({ search: query.search, after: query.cursors.at(-1), limit: 20 }, signal),
    [query],
  );
  const { data, loading, error, updateData } = useReadRequest(load, enabled);
  const items = data?.data ?? [];
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
          current
            ? {
                ...current,
                data: current.data.map((item) => (item.id === updated.id ? updated : item)),
              }
            : current,
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
            code: item.sku,
            name: item.name,
            priceLabel: formatAmount(item.price),
            stock: item.stock,
          }))
        : [],
    pagination: {
      label: `Página ${query.cursors.length} de inventario`,
      previousDisabled: loading || saving || query.cursors.length === 1,
      nextDisabled: loading || saving || !!error || !data?.nextCursor,
      onPrevious: () => {
        if (!loading && !saving && query.cursors.length > 1) {
          setEditingId(null);
          setQuery((current) => ({ ...current, cursors: current.cursors.slice(0, -1) }));
        }
      },
      onNext: () => {
        if (!loading && !saving && !error && data?.nextCursor) {
          setEditingId(null);
          setQuery((current) => ({ ...current, cursors: [...current.cursors, data.nextCursor!] }));
        }
      },
    },
    draft,
    loading,
    error,
    editingId,
    stock,
    stockError,
    saving,
    notice,
    save,
    setField: (field: 'search', value: string) =>
      setDraft((current) => ({ ...current, [field]: value })),
    search: () => {
      if (!saving) {
        setEditingId(null);
        setQuery({ search: draft.search.trim(), cursors: [undefined] });
      }
    },
    clear: () => {
      if (!saving) {
        setDraft({ search: '' });
        setQuery({ search: '', cursors: [undefined] });
        setEditingId(null);
      }
    },
    retry: () => setQuery((current) => ({ ...current })),
    edit: (id: number) => {
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
