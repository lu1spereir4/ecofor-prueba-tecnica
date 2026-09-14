import type { OrderDetailView } from '../models';
import type { ErrorNotice } from '../../../shared/api/http';
import { RequestError } from '../../../shared/components/RequestError';

interface Props {
  order: OrderDetailView | null;
  loading: boolean;
  error: ErrorNotice | null;
  notice: string;
  status: string;
  statuses: { value: string; label: string }[];
  saving: boolean;
  saveDisabled: boolean;
  onReload: () => void;
  onStatusChange: (status: string) => void;
  onSaveStatus: () => void;
  onShowDiscounts: () => void;
}
export function OrderDetail(props: Props) {
  return (
    <section aria-labelledby="detail-title">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Detalle del pedido</p>
          <h1 id="detail-title">
            {props.order ? `Pedido #${props.order.id}` : 'Detalle del pedido'}
          </h1>
          {props.order && <p>{props.order.reference}</p>}
        </div>
        <a href="#/orders">Volver al listado</a>
      </header>
      {props.notice && (
        <p role="status" className="notice notice-success">
          {props.notice}
        </p>
      )}
      {props.loading && <p role="status">Cargando detalle…</p>}
      <RequestError error={props.error} onRetry={props.saving ? undefined : props.onReload} />
      {props.order && (
        <div className="panel order-detail">
          <div className="detail-summary">
            <section>
              <h2>Cliente</h2>
              <p>{props.order.customer}</p>
              <p>{props.order.email}</p>
              <p>{props.order.city}</p>
              {!props.order.customerLinked && (
                <p className="notice notice-warning">
                  El email original de este pedido no tiene una ficha de cliente asociada.
                </p>
              )}
            </section>
            <section>
              <h2>Pedido</h2>
              <dl>
                <dt>Estado</dt>
                <dd>
                  <span className={`status status-${props.order.statusTone}`}>
                    {props.order.statusLabel}
                  </span>
                </dd>
                <dt>Creado (UTC)</dt>
                <dd>{props.order.dateLabel}</dd>
                <dt>Canal</dt>
                <dd>{props.order.channel}</dd>
              </dl>
            </section>
          </div>
          <h2>Ítems</h2>
          <div className="table-scroll">
            <table>
              <caption className="sr-only">Ítems y montos del pedido</caption>
              <thead>
                <tr>
                  {['Producto', 'SKU', 'Cantidad', 'Precio unitario', 'Monto'].map((label) => (
                    <th scope="col" key={label}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {props.order.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.name}
                      <small>Producto #{item.productId}</small>
                    </td>
                    <td>{item.sku}</td>
                    <td>{item.quantity}</td>
                    <td className="money">{item.priceLabel}</td>
                    <td className="money">{item.amountLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!props.order.items.length && <p className="empty-state">Este pedido no tiene ítems.</p>}
          <p className="order-total">
            Monto total: <strong>{props.order.totalLabel}</strong>
          </p>
          <form
            className="actions"
            onSubmit={(event) => {
              event.preventDefault();
              props.onSaveStatus();
            }}
          >
            <label>
              Actualizar estado
              <select
                value={props.status}
                disabled={props.saving || props.loading}
                onChange={(event) => props.onStatusChange(event.target.value)}
              >
                {props.statuses.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={props.saveDisabled}>
              {props.saving ? 'Guardando…' : 'Guardar estado'}
            </button>
            <button type="button" disabled={props.loading || props.saving} onClick={props.onReload}>
              Recargar detalle
            </button>
            <button
              type="button"
              disabled={props.loading || props.saving}
              onClick={props.onShowDiscounts}
            >
              Simular descuentos
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
