import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import type { OrderDetail } from '../features/orders/types';

const customer = { id: 11, email: 'ana@example.cl', full_name: 'Ana Silva', city: 'Talca' };
const secondCustomer = {
  id: 12,
  email: 'bea@example.cl',
  full_name: 'Beatriz Soto',
  city: 'Santiago',
};
const products = [
  { id: 7, sku: 'ABC', name: 'Producto ABC', price: '20.10', stock: 8 },
  { id: 8, sku: 'XYZ', name: 'Producto XYZ', price: '0.20', stock: 50 },
  { id: 9, sku: 'EMPTY', name: 'Producto agotado', price: '5.00', stock: 0 },
];
const order: OrderDetail = {
  id: 123,
  order_ref: 'WEB-123',
  customer_id: customer.id,
  customer_email: customer.email,
  customer_name: customer.full_name,
  customer_linked: true,
  city: customer.city,
  customer,
  status: 'pending',
  created_at: '2026-09-14T12:00:00.123456Z',
  channel: 'web',
  total: '60.50',
  items: [
    {
      id: 201,
      source_row: null,
      product_id: 7,
      sku: 'ABC',
      name: 'Producto ABC',
      quantity: 3,
      unit_price: '20.10',
      amount: '60.30',
      subtotal: '60.30',
    },
    {
      id: 202,
      source_row: null,
      product_id: 8,
      sku: 'XYZ',
      name: 'Producto XYZ',
      quantity: 1,
      unit_price: '0.20',
      amount: '0.20',
      subtotal: '0.20',
    },
  ],
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const page = (data = [order], nextCursor: string | null = null) => ({
  data,
  nextCursor,
  page_size: 20,
  has_more: !!nextCursor,
});
const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
let respond: (url: URL, init: RequestInit) => Promise<Response>;
const requests = (method = 'GET', path = '/api/orders') =>
  fetchMock.mock.calls.filter(
    ([input, init]) =>
      new URL(String(input)).pathname === path && (init?.method ?? 'GET') === method,
  );
const latestUrl = (path = '/api/orders') => new URL(String(requests('GET', path).at(-1)![0]));
function mount(route = '#/orders') {
  window.history.replaceState(null, '', `/${route}`);
  return render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
async function selectDraft() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Seleccionar Ana Silva' }));
  await user.click(await screen.findByRole('button', { name: 'Agregar Producto ABC' }));
  return user;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(() => {
  fetchMock.mockReset();
  respond = async (url, init) => {
    if (url.pathname === '/api/customers') return json({ data: [customer], nextCursor: null });
    if (url.pathname === '/api/catalog/products') return json({ data: products, nextCursor: null });
    if (url.pathname === '/api/orders' && init.method === 'POST') return json({ data: order }, 201);
    if (url.pathname === '/api/orders') return json(page());
    if (url.pathname === '/api/orders/123') return json({ data: order });
    throw new Error(`Unexpected request: ${init.method ?? 'GET'} ${url}`);
  };
  fetchMock.mockImplementation((input, init = {}) => respond(new URL(String(input)), init));
  vi.stubGlobal('fetch', fetchMock);
});

describe('Listado y navegación', () => {
  it('filtra en el servidor, pagina con cursor, conserva filtros al volver y reinicia el cursor al cambiar límite', async () => {
    const standard = respond;
    respond = async (url, init) =>
      url.pathname === '/api/orders'
        ? json(
            page(
              [{ ...order, id: url.searchParams.has('cursor') ? 124 : 123 }],
              url.searchParams.has('cursor') ? null : 'microseconds+id==',
            ),
          )
        : standard(url, init);
    mount();
    const user = userEvent.setup();
    await screen.findByRole('link', { name: 'Ver pedido 123' });
    expect(latestUrl().searchParams.get('limit')).toBe('20');
    await user.type(screen.getByLabelText('Nombre del cliente'), ' Ana ');
    await user.selectOptions(screen.getByLabelText('Estado'), 'paid');
    fireEvent.change(screen.getByLabelText('Desde (UTC)'), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByLabelText('Hasta (UTC)'), { target: { value: '2026-09-14' } });
    await user.click(screen.getByRole('button', { name: 'Buscar pedidos' }));
    expect(Object.fromEntries(latestUrl().searchParams)).toEqual({
      limit: '20',
      customer: 'Ana',
      status: 'paid',
      from: '2026-09-01T00:00:00Z',
      to: '2026-09-14T23:59:59.999999Z',
    });
    await user.click(await screen.findByRole('link', { name: 'Ver pedido 123' }));
    await screen.findByRole('heading', { name: 'Pedido #123' });
    expect(requests('GET', '/api/orders/123').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('link', { name: 'Volver al listado' }));
    await screen.findByRole('link', { name: 'Ver pedido 123' });
    expect(screen.getByLabelText('Nombre del cliente')).toHaveValue(' Ana ');
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    await screen.findByRole('link', { name: 'Ver pedido 124' });
    expect(latestUrl().searchParams.get('cursor')).toBe('microseconds+id==');
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Anterior' }));
    await screen.findByRole('link', { name: 'Ver pedido 123' });
    expect(latestUrl().searchParams.has('cursor')).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    await screen.findByRole('link', { name: 'Ver pedido 124' });
    await user.selectOptions(screen.getByLabelText('Pedidos por página'), '100');
    await screen.findByRole('link', { name: 'Ver pedido 123' });
    expect(latestUrl().searchParams.get('limit')).toBe('100');
    expect(latestUrl().searchParams.has('cursor')).toBe(false);
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
  });

  it('ignora respuestas tardías y cancela lecturas anteriores incluso con StrictMode', async () => {
    const late = deferred<Response>();
    respond = async (url) =>
      url.searchParams.get('customer') === 'Ana'
        ? json(page([{ ...order, customer_name: 'Resultado vigente' }]))
        : late.promise;
    mount();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Nombre del cliente'), 'Ana');
    await user.click(screen.getByRole('button', { name: 'Buscar pedidos' }));
    await screen.findByText('Resultado vigente');
    expect(requests()[0][1]?.signal?.aborted).toBe(true);
    await act(async () => {
      late.resolve(json(page([{ ...order, customer_name: 'Resultado obsoleto' }])));
    });
    expect(screen.queryByText('Resultado obsoleto')).not.toBeInTheDocument();
    expect(screen.getByText('Resultado vigente')).toBeInTheDocument();
  });

  it('muestra errores HTTP, permite reintentar y distingue resultados vacíos', async () => {
    respond = async () =>
      json({ code: 'DB_UNAVAILABLE', message: 'Base de datos no disponible' }, 503);
    mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('Base de datos no disponible');
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
    respond = async () => json(page([]));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByText('No se encontraron pedidos con estos filtros.');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('rechaza fechas invertidas antes de solicitar la API', async () => {
    mount();
    await screen.findByRole('link', { name: 'Ver pedido 123' });
    const before = requests().length;
    fireEvent.change(screen.getByLabelText('Desde (UTC)'), { target: { value: '2026-09-14' } });
    fireEvent.change(screen.getByLabelText('Hasta (UTC)'), { target: { value: '2026-09-01' } });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Buscar pedidos' }));
    expect(screen.getByRole('alert')).toHaveTextContent('La fecha final');
    expect(requests()).toHaveLength(before);
  });
});

describe('Creación', () => {
  it('pagina y busca catálogos en el servidor, y conserva el cliente seleccionado', async () => {
    const standard = respond;
    respond = async (url, init) => {
      if (url.pathname === '/api/customers')
        return json({
          data: url.searchParams.has('after') ? [secondCustomer] : [customer],
          nextCursor: url.searchParams.has('after') ? null : customer.email,
        });
      if (url.pathname === '/api/catalog/products')
        return json({ data: products, nextCursor: url.searchParams.has('after') ? null : 'XYZ' });
      return standard(url, init);
    };
    mount('#/orders/new');
    const user = userEvent.setup();
    const customers = within(screen.getByRole('region', { name: 'Clientes' }));
    const catalog = within(screen.getByRole('region', { name: 'Productos' }));
    await customers.findByRole('button', { name: 'Seleccionar Ana Silva' });
    await user.click(customers.getByRole('button', { name: 'Siguiente' }));
    await user.click(await customers.findByRole('button', { name: 'Seleccionar Beatriz Soto' }));
    expect(latestUrl('/api/customers').searchParams.get('after')).toBe(customer.email);
    await user.type(customers.getByRole('searchbox'), 'Ana');
    await user.click(customers.getByRole('button', { name: 'Buscar' }));
    await customers.findByRole('button', { name: 'Seleccionar Ana Silva' });
    expect(latestUrl('/api/customers').searchParams.get('search')).toBe('Ana');
    expect(latestUrl('/api/customers').searchParams.has('after')).toBe(false);
    expect(screen.getByText('Beatriz Soto · bea@example.cl')).toBeInTheDocument();
    await user.click(catalog.getByRole('button', { name: 'Siguiente' }));
    await catalog.findByRole('button', { name: 'Agregar Producto ABC' });
    expect(latestUrl('/api/catalog/products').searchParams.get('after')).toBe('XYZ');
    await user.type(catalog.getByRole('searchbox'), 'ABC');
    await user.click(catalog.getByRole('button', { name: 'Buscar' }));
    await catalog.findByRole('button', { name: 'Agregar Producto ABC' });
    expect(latestUrl('/api/catalog/products').searchParams.get('search')).toBe('ABC');
    expect(latestUrl('/api/catalog/products').searchParams.has('after')).toBe(false);
  });

  it('compone N ítems, envía IDs y cantidades una sola vez y muestra el detalle creado', async () => {
    const pending = deferred<Response>();
    const standard = respond;
    respond = (url, init) => (init.method === 'POST' ? pending.promise : standard(url, init));
    mount('#/orders/new');
    const user = await selectDraft();
    expect(screen.getByRole('button', { name: 'Agregar Producto agotado' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Agregar Producto XYZ' }));
    await user.click(screen.getByRole('button', { name: 'Quitar Producto XYZ' }));
    expect(screen.queryByLabelText('Cantidad de Producto XYZ')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Agregar Producto XYZ' }));
    const quantity = screen.getByLabelText('Cantidad de Producto ABC');
    await user.clear(quantity);
    await user.type(quantity, '3');
    expect(screen.getByText('60,50')).toBeInTheDocument();
    await user.dblClick(screen.getByRole('button', { name: 'Confirmar pedido' }));
    expect(requests('POST')).toHaveLength(1);
    expect(JSON.parse(String(requests('POST')[0][1]?.body))).toEqual({
      customer_id: 11,
      items: [
        { product_id: 7, quantity: 3 },
        { product_id: 8, quantity: 1 },
      ],
    });
    expect(screen.getByRole('button', { name: 'Confirmando…' })).toBeDisabled();
    await act(async () => {
      pending.resolve(json({ data: order }, 201));
    });
    await screen.findByRole('heading', { name: 'Pedido #123' });
    expect(window.location.hash).toBe('#/orders/123');
    expect(screen.getByText('Pedido creado correctamente.')).toBeInTheDocument();
    expect(screen.getByText('Talca')).toBeInTheDocument();
    expect(screen.getByText('60,50')).toBeInTheDocument();
    await waitFor(() => expect(requests('GET', '/api/orders/123').length).toBeGreaterThan(0));
  });

  it('valida cliente, ítems y cantidades sin emitir POST', async () => {
    mount('#/orders/new');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
    expect(screen.getByText('Selecciona un cliente.')).toBeInTheDocument();
    expect(screen.getByText('Agrega al menos un producto.')).toBeInTheDocument();
    await selectDraft();
    const quantity = screen.getByLabelText('Cantidad de Producto ABC');
    for (const value of ['0', '1.5', '2147483648']) {
      fireEvent.change(quantity, { target: { value } });
      await user.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
      expect(quantity).toHaveAttribute('aria-invalid', 'true');
    }
    expect(requests('POST')).toHaveLength(0);
  });

  it.each([400, 404, 409])(
    'presenta el error %i de la API y conserva la composición para corregirla',
    async (status) => {
      const standard = respond;
      respond = async (url, init) =>
        init.method === 'POST'
          ? json(
              {
                code: 'ORDER_REJECTED',
                message: 'Pedido rechazado por la API',
                details: { products: [{ product_id: 7, available: 0, requested: 1 }] },
              },
              status,
            )
          : standard(url, init);
      mount('#/orders/new');
      const user = await selectDraft();
      await user.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Pedido rechazado por la API');
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Producto 7: 0 disponibles, 1 solicitados.',
      );
      expect(screen.getByLabelText('Cantidad de Producto ABC')).toHaveValue(1);
      expect(screen.getByText('Ana Silva · ana@example.cl')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Confirmar pedido' })).toBeEnabled();
      expect(requests('POST')).toHaveLength(1);
    },
  );

  it('no repite automáticamente un POST cuando se pierde la respuesta', async () => {
    const standard = respond;
    respond = async (url, init) => {
      if (init.method === 'POST') throw new TypeError('Network disconnected');
      return standard(url, init);
    };
    mount('#/orders/new');
    const user = await selectDraft();
    await user.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Revisa el listado');
    expect(screen.getByRole('button', { name: 'Confirmar pedido' })).toBeDisabled();
    expect(requests('POST')).toHaveLength(1);
  });

  it('conserva el comprobante creado aunque falle la lectura posterior del detalle', async () => {
    const standard = respond;
    respond = async (url, init) =>
      url.pathname === '/api/orders/123'
        ? json({ message: 'Lectura temporalmente no disponible' }, 503)
        : standard(url, init);
    mount('#/orders/new');
    const user = await selectDraft();
    await user.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
    await screen.findByRole('heading', { name: 'Pedido #123' });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Lectura temporalmente no disponible',
    );
    expect(screen.getByText('Pedido creado correctamente.')).toBeInTheDocument();
    expect(screen.getByText('60,50')).toBeInTheDocument();
  });
});

describe('Detalle e inventario', () => {
  it('abre por ID, muestra precios históricos y conserva líneas del mismo SKU', async () => {
    respond = async () =>
      json({
        data: {
          ...order,
          total: '80.40',
          items: [order.items[0], { ...order.items[0], id: 203, quantity: 1, amount: '20.10' }],
        },
      });
    mount('#/orders/123');
    await screen.findByRole('heading', { name: 'Pedido #123' });
    const table = screen.getByRole('table', { name: 'Ítems y montos del pedido' });
    expect(within(table).getAllByText('Producto ABC')).toHaveLength(2);
    expect(screen.getByText('80,40')).toBeInTheDocument();
    expect(screen.getByText('ana@example.cl')).toBeInTheDocument();
    expect(requests('GET', '/api/orders')).toHaveLength(0);
  });

  it('muestra pedido inexistente y permite regresar al listado', async () => {
    respond = async () => json({ code: 'ORDER_NOT_FOUND', message: 'Pedido no encontrado' }, 404);
    mount('#/orders/999');
    expect(await screen.findByRole('alert')).toHaveTextContent('Pedido no encontrado');
    expect(screen.getByRole('link', { name: 'Volver al listado' })).toHaveAttribute(
      'href',
      '#/orders',
    );
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('muestra el catálogo de ventas y edita su stock', async () => {
    const product = { id: 7, sku: 'INV01', name: 'Madera', price: '1000.25', stock: 5 };
    respond = async (_url, init) =>
      init.method === 'PATCH'
        ? json({ data: { ...product, stock: 9 } })
        : json({ data: [product], nextCursor: null });
    mount('#/inventory');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Editar stock' }));
    expect(requests('GET', '/api/catalog/products').length).toBeGreaterThan(0);
    expect(requests('GET', '/api/products')).toHaveLength(0);
    expect(screen.getByRole('cell', { name: '1.000,25' })).toBeInTheDocument();
    const stock = screen.getByLabelText('Nuevo stock de INV01');
    await user.clear(stock);
    await user.type(stock, '9');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await screen.findByText('Stock actualizado correctamente.');
    expect(screen.getByRole('cell', { name: '9' })).toBeInTheDocument();
    expect(
      JSON.parse(String(requests('PATCH', '/api/catalog/products/7/stock')[0][1]?.body)),
    ).toEqual({
      stock: 9,
    });
  });
  it('pagina el inventario y reinicia el cursor al buscar', async () => {
    respond = async (url) => {
      if (url.pathname !== '/api/catalog/products') return json({ data: [] });
      return json({
        data: url.searchParams.has('after') ? [products[1]] : [products[0]],
        nextCursor: url.searchParams.has('after') ? null : 'ABC',
      });
    };
    mount('#/inventory');
    const user = userEvent.setup();
    await screen.findByRole('cell', { name: 'Producto ABC' });
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    await screen.findByRole('cell', { name: 'Producto XYZ' });
    expect(latestUrl('/api/catalog/products').searchParams.get('after')).toBe('ABC');
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
    await user.type(screen.getByLabelText('Nombre o código'), 'ABC');
    await user.click(screen.getByRole('button', { name: 'Buscar productos' }));
    await screen.findByRole('cell', { name: 'Producto ABC' });
    expect(latestUrl('/api/catalog/products').searchParams.get('search')).toBe('ABC');
    expect(latestUrl('/api/catalog/products').searchParams.has('after')).toBe(false);
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
  });
});
