import { useCreateOrder } from '../hooks/useCreateOrder';
import { CreateOrderForm } from '../components/CreateOrderForm';
import type { OrderDetail } from '../types';

export function CreateOrderContainer({
  onCreated,
  onBusyChange,
}: {
  onCreated: (order: OrderDetail) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const state = useCreateOrder(onCreated, onBusyChange);
  return (
    <CreateOrderForm
      selectedCustomer={state.selectedCustomer}
      items={state.items}
      totalLabel={state.totalLabel}
      errors={state.errors}
      error={state.error}
      submitting={state.submitting}
      uncertain={state.uncertain}
      onQuantityChange={state.setQuantity}
      onRemove={state.removeItem}
      onSubmit={() => {
        void state.submit();
      }}
      customers={{
        title: 'Clientes',
        searchLabel: 'Buscar cliente por nombre o email',
        searchValue: state.customers.draft,
        actionLabel: 'Seleccionar',
        options: state.customers.options,
        loading: state.customers.loading,
        disabled: state.submitting,
        error: state.customers.error,
        pagination: state.customers.pagination,
        onSearchChange: state.customers.setDraft,
        onSearch: state.customers.search,
        onSelect: state.selectCustomer,
        onRetry: state.customers.retry,
      }}
      products={{
        title: 'Productos',
        searchLabel: 'Buscar producto por nombre o SKU',
        searchValue: state.products.draft,
        actionLabel: 'Agregar',
        options: state.products.options,
        loading: state.products.loading,
        disabled: state.submitting,
        error: state.products.error,
        pagination: state.products.pagination,
        onSearchChange: state.products.setDraft,
        onSearch: state.products.search,
        onSelect: state.addProduct,
        onRetry: state.products.retry,
      }}
    />
  );
}
