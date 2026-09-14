import { StrictMode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import type { OrderDetail } from '../features/orders/types';
import type { DiscountResult } from '../features/discounts/types';

const customer = { id: 11, email: 'ana@example.cl', full_name: 'Ana Silva', city: 'Talca' };
const order: OrderDetail = {
  id: 123,
  order_ref: 'WEB-123',
  customer_id: 11,
  customer_email: customer.email,
  customer_name: customer.full_name,
  customer_linked: true,
  city: customer.city,
  customer,
  status: 'pending',
  created_at: '2026-09-14T12:00:00.000000Z',
  channel: 'web',
  total: '180.00',
  items: [
    {
      id: 1,
      source_row: null,
      product_id: 7,
      sku: 'ABC',
      name: 'Producto ABC',
      quantity: 3,
      unit_price: '20.00',
      amount: '60.00',
      subtotal: '60.00',
    },
    {
      id: 2,
      source_row: null,
      product_id: 8,
      sku: 'XYZ',
      name: 'Producto XYZ',
      quantity: 2,
      unit_price: '60.00',
      amount: '120.00',
      subtotal: '120.00',
    },
  ],
};
const report = {
  as_of: '2026-09-14T00:00:00.000000Z',
  data: [
    {
      customer_id: 11,
      full_name: 'Ana Silva',
      total_amount: '1234.50',
      order_count: 5,
      average_ticket: '246.90',
    },
  ],
};
const discount: DiscountResult = {
  order_id: 123,
  subtotal: '180.00',
  applied_coupons: ['PROMO10', '3X2'],
  total_discount: '38.00',
  total: '142.00',
  items: [
    {
      product_id: 7,
      sku: 'ABC',
      quantity: 3,
      unit_price: '20.00',
      amount: '60.00',
      discount: '26.00',
      final_amount: '34.00',
      coupons: ['PROMO10', '3X2'],
    },
    {
      product_id: 8,
      sku: 'XYZ',
      quantity: 2,
      unit_price: '60.00',
      amount: '120.00',
      discount: '12.00',
      final_amount: '108.00',
      coupons: ['PROMO10'],
    },
  ],
};
const reportPath = '/api/reports/top-customers';
const discountPath = '/api/orders/123/apply-discounts';
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
let respond: (url: URL, init: RequestInit) => Promise<Response>;
const calls = (path: string) =>
  fetchMock.mock.calls.filter(([input]) => new URL(String(input)).pathname === path);
const latestUrl = (path: string) => new URL(String(calls(path).at(-1)![0]));
function mount(route: string) {
  window.history.replaceState(null, '', `/#/${route}`);
  return render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function addPercentage() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Agregar cupón' }));
  const editor = within(screen.getByRole('group', { name: 'Cupón 1' }));
  await user.type(editor.getByLabelText('Código'), 'PROMO10');
  await user.type(editor.getByLabelText('Porcentaje (%)'), '10');
  return { user, editor };
}
beforeEach(() => {
  fetchMock.mockReset();
  respond = async (url) => {
    if (url.pathname === reportPath) return json(report);
    if (url.pathname === discountPath) return json(discount);
    if (url.pathname === '/api/orders/123') return json({ data: order });
    if (url.pathname === '/api/orders')
      return json({ data: [order], nextCursor: null, page_size: 20, has_more: false });
    throw new Error(`Unexpected request: ${url}`);
  };
  fetchMock.mockImplementation((input, init = {}) => respond(new URL(String(input)), init));
  vi.stubGlobal('fetch', fetchMock);
});

describe('Top clientes', () => {
  it('abre el ranking desde el menú, filtra por corte y vuelve a la fecha actual', async () => {
    mount('orders');
    const user = userEvent.setup();
    await user.click(screen.getByRole('link', { name: 'Top clientes' }));
    const table = await screen.findByRole('table', {
      name: 'Ranking de clientes por monto acumulado',
    });
    expect(await within(table).findByText('Ana Silva')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Top clientes' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(latestUrl(reportPath).searchParams.has('as_of')).toBe(false);
    expect(within(table).getByText('1.234,50')).toBeInTheDocument();
    expect(within(table).getByText('246,90')).toBeInTheDocument();
    expect(within(table).getByText('5')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Fecha de corte (UTC)'), {
      target: { value: '2026-09-01' },
    });
    await user.click(screen.getByRole('button', { name: 'Consultar top clientes' }));
    expect(latestUrl(reportPath).searchParams.get('as_of')).toBe('2026-09-01');
    await user.click(screen.getByRole('button', { name: 'Usar fecha actual' }));
    expect(screen.getByLabelText('Fecha de corte (UTC)')).toHaveValue('');
    expect(latestUrl(reportPath).searchParams.has('as_of')).toBe(false);
  });

  it('cancela el corte anterior y no muestra respuestas obsoletas', async () => {
    const old = deferred<Response>();
    const standard = respond;
    respond = async (url, init) =>
      url.pathname === reportPath
        ? url.searchParams.has('as_of')
          ? json({ ...report, data: [{ ...report.data[0], full_name: 'Beatriz Soto' }] })
          : old.promise
        : standard(url, init);
    mount('reports/top-customers');
    expect(screen.getByText('Consultando top clientes…')).toBeInTheDocument();
    const oldSignal = calls(reportPath).at(-1)![1]!.signal!;
    fireEvent.change(screen.getByLabelText('Fecha de corte (UTC)'), {
      target: { value: '2026-09-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar top clientes' }));
    expect(await screen.findByText('Beatriz Soto')).toBeInTheDocument();
    expect(oldSignal.aborted).toBe(true);
    await act(async () => {
      old.resolve(json(report));
    });
    expect(screen.queryByText('Ana Silva')).not.toBeInTheDocument();
  });

  it('muestra el error de la API y permite reintentar un período sin ventas', async () => {
    respond = async () =>
      json({ code: 'DATABASE_UNAVAILABLE', message: 'Base de datos no disponible' }, 503);
    mount('reports/top-customers');
    expect(await screen.findByRole('alert')).toHaveTextContent('Base de datos no disponible');
    respond = async () => json({ ...report, data: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(
      await screen.findByText('No hay clientes con pedidos en este período.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('Simulador de descuentos en el detalle', () => {
  it('envía los tres tipos y sus condiciones, y muestra la combinación y el desglose del servidor', async () => {
    mount('orders/123');
    const { user } = await addPercentage();
    await user.click(screen.getByRole('button', { name: 'Agregar cupón' }));
    const fixed = within(screen.getByRole('group', { name: 'Cupón 2' }));
    await user.type(fixed.getByLabelText('Código'), 'FIJO');
    await user.selectOptions(fixed.getByLabelText('Tipo'), 'fixed_amount');
    await user.type(fixed.getByLabelText('Monto del descuento'), '25.50');
    await user.type(fixed.getByLabelText('Monto mínimo del pedido (opcional)'), '100.00');
    await user.click(fixed.getByLabelText('Acumulable con otros cupones'));
    await user.click(fixed.getByLabelText('Sin restricción adicional de productos'));
    await user.selectOptions(fixed.getByLabelText('Productos elegibles'), 'ABC');
    await user.click(screen.getByRole('button', { name: 'Agregar cupón' }));
    const bundle = within(screen.getByRole('group', { name: 'Cupón 3' }));
    await user.type(bundle.getByLabelText('Código'), '3X2');
    await user.selectOptions(bundle.getByLabelText('Tipo'), 'n_for_m');
    await user.selectOptions(bundle.getByLabelText('Producto de la promoción'), 'ABC');
    await user.click(screen.getByRole('button', { name: 'Calcular mejor descuento' }));
    expect(calls(discountPath)).toHaveLength(1);
    const options = calls(discountPath)[0][1]!;
    expect(options.method).toBe('POST');
    expect(JSON.parse(String(options.body))).toEqual({
      coupons: [
        { code: 'PROMO10', type: 'percentage', value: '10', stackable: true },
        {
          code: 'FIJO',
          type: 'fixed_amount',
          value: '25.50',
          stackable: false,
          min_amount: '100.00',
          applicable_skus: ['ABC'],
        },
        { code: '3X2', type: 'n_for_m', sku: 'ABC', n: 3, m: 2, stackable: true },
      ],
    });
    const result = within(
      await screen.findByRole('region', { name: 'Resultado de la simulación' }),
    );
    expect(result.getByRole('status')).toHaveTextContent('PROMO10, 3X2');
    expect(result.getByText('38,00')).toBeInTheDocument();
    expect(result.getByText('142,00')).toBeInTheDocument();
    const table = within(result.getByRole('table', { name: 'Descuentos por ítem' }));
    expect(table.getByText('26,00')).toBeInTheDocument();
    expect(table.getByText('34,00')).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Pedido #123' })).getByText('180,00'),
    ).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false);
  });

  it('impide enviar campos inválidos y permite quitar el cupón', async () => {
    mount('orders/123');
    const { user, editor } = await addPercentage();
    await user.clear(editor.getByLabelText('Porcentaje (%)'));
    await user.type(editor.getByLabelText('Porcentaje (%)'), '101');
    await user.click(screen.getByRole('button', { name: 'Calcular mejor descuento' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Revisa los campos');
    expect(editor.getByText('Ingresa un porcentaje entre 0 y 100.')).toBeInTheDocument();
    expect(calls(discountPath)).toHaveLength(0);
    await user.click(editor.getByRole('button', { name: 'Quitar cupón 1' }));
    expect(screen.getByText('0 / 30 cupones')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('conserva los cupones tras un error de API y permite corregir y reintentar', async () => {
    const standard = respond;
    respond = async (url, init) =>
      url.pathname === discountPath
        ? json(
            {
              code: 'VALIDATION_ERROR',
              message: 'Cupón inválido',
              errors: [{ path: 'coupons[0].value', msg: 'Valor rechazado' }],
            },
            400,
          )
        : standard(url, init);
    mount('orders/123');
    const { user, editor } = await addPercentage();
    await user.click(screen.getByRole('button', { name: 'Calcular mejor descuento' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Valor rechazado');
    expect(editor.getByLabelText('Código')).toHaveValue('PROMO10');
    respond = standard;
    await user.click(screen.getByRole('button', { name: 'Calcular mejor descuento' }));
    expect(
      await screen.findByRole('region', { name: 'Resultado de la simulación' }),
    ).toBeInTheDocument();
    expect(calls(discountPath)).toHaveLength(2);
  });

  it('evita envíos duplicados y descarta el resultado si se edita durante la consulta', async () => {
    const old = deferred<Response>();
    const standard = respond;
    respond = async (url, init) =>
      url.pathname === discountPath ? old.promise : standard(url, init);
    mount('orders/123');
    const { user, editor } = await addPercentage();
    await user.dblClick(screen.getByRole('button', { name: 'Calcular mejor descuento' }));
    expect(calls(discountPath)).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Calculando descuentos…' })).toBeDisabled();
    const signal = calls(discountPath)[0][1]!.signal!;
    await user.type(editor.getByLabelText('Código'), 'NUEVO');
    expect(signal.aborted).toBe(true);
    await act(async () => {
      old.resolve(json(discount));
    });
    expect(
      screen.queryByRole('region', { name: 'Resultado de la simulación' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Calcular mejor descuento' })).toBeEnabled();
  });

  it('limita el editor a 30 cupones y vuelve a habilitar agregar al quitar uno', async () => {
    mount('orders/123');
    const add = await screen.findByRole('button', { name: 'Agregar cupón' });
    for (let count = 0; count < 30; count++) fireEvent.click(add);
    expect(screen.getAllByRole('group', { name: /Cupón \d+/ })).toHaveLength(30);
    expect(add).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar cupón 1' }));
    expect(add).toBeEnabled();
    expect(screen.getAllByRole('group', { name: /Cupón \d+/ })).toHaveLength(29);
  });

  it('bloquea la simulación si el pedido supera los 100 ítems, sin truncarlos', async () => {
    const standard = respond;
    respond = async (url, init) =>
      url.pathname === '/api/orders/123'
        ? json({
            data: {
              ...order,
              items: Array.from({ length: 101 }, (_, id) => ({ ...order.items[0], id })),
            },
          })
        : standard(url, init);
    mount('orders/123');
    expect(
      await screen.findByText('La simulación admite pedidos con hasta 100 ítems.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Calcular mejor descuento' })).toBeDisabled();
    expect(
      within(screen.getByRole('table', { name: 'Ítems y montos del pedido' })).getAllByRole('row'),
    ).toHaveLength(102);
    expect(calls(discountPath)).toHaveLength(0);
  });

  it('enfoca el simulador desde el detalle y cancela la consulta al salir de la vista', async () => {
    const pending = deferred<Response>();
    const standard = respond;
    respond = async (url, init) =>
      url.pathname === discountPath ? pending.promise : standard(url, init);
    const scrollIntoView = vi.fn();
    mount('orders/123');
    const section = await screen.findByRole('region', { name: 'Descuentos del pedido' });
    section.scrollIntoView = scrollIntoView;
    fireEvent.click(screen.getByRole('button', { name: 'Simular descuentos' }));
    expect(scrollIntoView).toHaveBeenCalled();
    expect(section).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Calcular mejor descuento' }));
    expect(JSON.parse(String(calls(discountPath)[0][1]!.body))).toEqual({ coupons: [] });
    const signal = calls(discountPath)[0][1]!.signal!;
    fireEvent.click(screen.getByRole('link', { name: 'Top clientes' }));
    await waitFor(() => expect(signal.aborted).toBe(true));
    await act(async () => {
      pending.resolve(json(discount));
    });
    expect(
      screen.queryByRole('region', { name: 'Resultado de la simulación' }),
    ).not.toBeInTheDocument();
  });
});
