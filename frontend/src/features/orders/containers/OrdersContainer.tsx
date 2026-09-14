import type { Route } from '../../../shared/hooks/useNavigation';
import { useOrdersWorkspace } from '../hooks/useOrdersWorkspace';
import { OrdersListContainer } from './OrdersListContainer';
import { CreateOrderContainer } from './CreateOrderContainer';
import { OrderDetailContainer } from './OrderDetailContainer';
export function OrdersContainer({
  route,
  onBusyChange,
}: {
  route: Route;
  onBusyChange: (busy: boolean) => void;
}) {
  const workspace = useOrdersWorkspace();
  return (
    <>
      <div hidden={route.view !== 'orders'}>
        <OrdersListContainer key={workspace.listRevision} enabled={route.view === 'orders'} />
      </div>
      {route.view === 'create' && (
        <CreateOrderContainer onCreated={workspace.onCreated} onBusyChange={onBusyChange} />
      )}
      {route.view === 'detail' && (
        <OrderDetailContainer
          key={route.id}
          id={route.id}
          initialOrder={
            workspace.createdOrder?.id === route.id ? workspace.createdOrder : undefined
          }
        />
      )}
    </>
  );
}
