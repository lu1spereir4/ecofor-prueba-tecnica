import type { ReactNode } from 'react';
export function AppLayout({
  children,
  activePage,
  busy,
}: {
  children: ReactNode;
  activePage: 'orders' | 'inventory' | 'reports' | null;
  busy: boolean;
}) {
  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        Saltar al contenido
      </a>
      <header className="app-header">
        <p className="brand">
          ECOFOR <span>Gestión de pedidos</span>
        </p>
        <nav aria-label="Navegación principal">
          <a
            href="#/orders"
            aria-current={activePage === 'orders' ? 'page' : undefined}
            aria-disabled={busy}
            onClick={(event) => {
              if (busy) event.preventDefault();
            }}
          >
            Pedidos
          </a>
          <a
            href="#/reports/top-customers"
            aria-current={activePage === 'reports' ? 'page' : undefined}
            aria-disabled={busy}
            onClick={(event) => {
              if (busy) event.preventDefault();
            }}
          >
            Top clientes
          </a>
          <a
            href="#/inventory"
            aria-current={activePage === 'inventory' ? 'page' : undefined}
            aria-disabled={busy}
            onClick={(event) => {
              if (busy) event.preventDefault();
            }}
          >
            Inventario
          </a>
        </nav>
      </header>
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
    </>
  );
}
