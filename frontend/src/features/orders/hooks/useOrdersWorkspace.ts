import { useCallback, useState } from 'react';
import type { OrderDetail } from '../types';
export function useOrdersWorkspace() {
  const [createdOrder, setCreatedOrder] = useState<OrderDetail>();
  const [listRevision, setListRevision] = useState(0);
  const onCreated = useCallback((order: OrderDetail) => {
    setCreatedOrder(order);
    setListRevision((value) => value + 1);
    window.location.hash = `/orders/${order.id}`;
  }, []);
  return { createdOrder, listRevision, onCreated };
}
