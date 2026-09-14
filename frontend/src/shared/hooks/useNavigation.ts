import { useEffect, useState } from 'react';
export type Route =
  | { view: 'orders' | 'create' | 'inventory' | 'reports' | 'not-found' }
  | { view: 'detail'; id: number };

function readRoute(): Route {
  const path = window.location.hash.slice(1) || '/orders';
  if (path === '/orders') return { view: 'orders' };
  if (path === '/orders/new') return { view: 'create' };
  if (path === '/inventory') return { view: 'inventory' };
  if (path === '/reports/top-customers') return { view: 'reports' };
  const match = /^\/orders\/([1-9]\d*)$/.exec(path);
  if (match && Number(match[1]) <= 2147483647) return { view: 'detail', id: Number(match[1]) };
  return { view: 'not-found' };
}
export function useNavigation() {
  const [route, setRoute] = useState<Route>(readRoute);
  useEffect(() => {
    const changed = () => setRoute(readRoute());
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  useEffect(() => {
    document.title = `${route.view === 'detail' ? `Pedido ${route.id}` : route.view === 'create' ? 'Nuevo pedido' : route.view === 'inventory' ? 'Inventario' : route.view === 'reports' ? 'Top clientes' : 'Pedidos'} · ECOFOR`;
  }, [route]);
  return route;
}
