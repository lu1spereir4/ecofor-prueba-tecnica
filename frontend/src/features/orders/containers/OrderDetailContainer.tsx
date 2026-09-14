import { OrderDetail } from '../components/OrderDetail';
import { useOrderDetail } from '../hooks/useOrderDetail';
import type { OrderDetail as OrderData, OrderStatus } from '../types';
import { statusOptions } from '../types';
import { DiscountsContainer } from '../../discounts/containers/DiscountsContainer';
export function OrderDetailContainer({
  id,
  initialOrder,
}: {
  id: number;
  initialOrder?: OrderData;
}) {
  const state = useOrderDetail(id, initialOrder);
  return (
    <>
      <OrderDetail
        order={state.order}
        loading={state.loading}
        error={state.error}
        notice={state.notice}
        status={state.status}
        statuses={statusOptions}
        saving={state.saving}
        saveDisabled={state.saveDisabled}
        onReload={state.reload}
        onStatusChange={(value) => state.setStatus(value as OrderStatus)}
        onSaveStatus={() => {
          void state.saveStatus();
        }}
        onShowDiscounts={() => {
          const section = document.getElementById('order-discounts');
          section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          section?.focus({ preventScroll: true });
        }}
      />
      {state.order && (
        <DiscountsContainer
          key={JSON.stringify(state.order.items)}
          orderId={id}
          products={state.order.items}
          disabled={state.loading || state.saving || !!state.error}
        />
      )}
    </>
  );
}
