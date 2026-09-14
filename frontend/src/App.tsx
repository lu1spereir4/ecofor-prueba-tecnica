import { OrdersContainer } from './features/orders/containers/OrdersContainer';
import { InventoryContainer } from './features/products/containers/InventoryContainer';
import { AppLayout } from './shared/components/AppLayout';
import { useApplication } from './shared/hooks/useApplication';
import { TopCustomersContainer } from './features/reports/containers/TopCustomersContainer';

export default function App() {
  const { route, busy, setBusy } = useApplication();
  return (
    <AppLayout
      activePage={
        route.view === 'inventory'
          ? 'inventory'
          : route.view === 'reports'
            ? 'reports'
            : route.view === 'not-found'
              ? null
              : 'orders'
      }
      busy={busy}
    >
      <OrdersContainer route={route} onBusyChange={setBusy} />
      <div hidden={route.view !== 'inventory'}>
        <InventoryContainer enabled={route.view === 'inventory'} />
      </div>
      <div hidden={route.view !== 'reports'}>
        <TopCustomersContainer enabled={route.view === 'reports'} />
      </div>
      {route.view === 'not-found' && (
        <section>
          <h1>Página no encontrada</h1>
          <p>La dirección no corresponde a una vista de la aplicación.</p>
          <a href="#/orders">Volver a pedidos</a>
        </section>
      )}
    </AppLayout>
  );
}
