import { useCallback, useEffect, useRef, useState } from 'react';
import { getOrder, updateOrderStatus } from '../api';
import { errorNotice } from '../../../shared/api/http';
import type { ErrorNotice } from '../../../shared/api/http';
import type { OrderDetail, OrderStatus } from '../types';
import { orderDetailView } from '../models';
import { useReadRequest } from '../../../shared/hooks/useReadRequest';

export function useOrderDetail(id: number, initialOrder?: OrderDetail) {
  const [mutationError, setMutationError] = useState<ErrorNotice | null>(null);
  const [revision, setRevision] = useState(0);
  const [status, setStatus] = useState<OrderStatus>(initialOrder?.status ?? 'pending');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(initialOrder ? 'Pedido creado correctamente.' : '');
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const load = useCallback(
    async (signal: AbortSignal) => {
      const result = await getOrder(id, signal);
      if (!signal.aborted) setStatus(result.status);
      return result;
    },
    [id],
  );
  const {
    data: order,
    loading,
    error: readError,
    updateData,
  } = useReadRequest(load, true, initialOrder ?? null, revision);
  async function saveStatus() {
    if (!order || inFlight.current || loading) return;
    inFlight.current = true;
    setSaving(true);
    setMutationError(null);
    setNotice('');
    try {
      await updateOrderStatus(id, status, order.status);
      if (mounted.current) {
        updateData(() => ({ ...order, status }));
        setNotice('Estado actualizado correctamente.');
      }
    } catch (reason) {
      if (mounted.current) setMutationError(errorNotice(reason));
    } finally {
      inFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  }
  return {
    order: order ? orderDetailView(order) : null,
    loading,
    error: mutationError ?? readError,
    notice,
    status,
    setStatus,
    saving,
    saveDisabled: saving || loading || !order || status === order.status,
    saveStatus,
    reload: () => {
      if (!saving) {
        setMutationError(null);
        setRevision((value) => value + 1);
      }
    },
  };
}
