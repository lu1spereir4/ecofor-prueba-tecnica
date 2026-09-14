import { OrdersList } from '../components/OrdersList';
import { useOrdersList } from '../hooks/useOrdersList';
import { statusOptions } from '../types';
export function OrdersListContainer({ enabled }: { enabled: boolean }) {
  const state = useOrdersList(enabled);
  return (
    <OrdersList
      rows={state.rows}
      loading={state.loading}
      error={state.error}
      validation={state.validation}
      filters={state.draft}
      limit={state.limit}
      statuses={statusOptions}
      pagination={state.pagination}
      onFieldChange={state.setField}
      onSearch={state.search}
      onClear={state.clear}
      onRetry={state.retry}
      onLimitChange={state.setLimit}
    />
  );
}
