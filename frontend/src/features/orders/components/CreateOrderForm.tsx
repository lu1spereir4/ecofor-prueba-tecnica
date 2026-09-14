import { CatalogPicker } from './CatalogPicker';
import type { CatalogPickerProps } from './CatalogPicker';
import type { DraftItemView } from '../models';
import type { ErrorNotice } from '../../../shared/api/http';
import { RequestError } from '../../../shared/components/RequestError';

interface Props {
  customers: CatalogPickerProps;
  products: CatalogPickerProps;
  selectedCustomer: string;
  items: DraftItemView[];
  totalLabel: string;
  errors: Record<string, string>;
  error: ErrorNotice | null;
  submitting: boolean;
  uncertain: boolean;
  onQuantityChange: (id: number, value: string) => void;
  onRemove: (id: number) => void;
  onSubmit: () => void;
}
export function CreateOrderForm(props: Props) {
  return (
    <section aria-labelledby="create-order-title">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Nuevo pedido</p>
          <h1 id="create-order-title">Crear pedido</h1>
          <p>Selecciona un cliente, agrega productos e indica sus cantidades.</p>
        </div>
        <a
          href="#/orders"
          aria-disabled={props.submitting}
          onClick={(event) => {
            if (props.submitting) event.preventDefault();
          }}
        >
          Volver al listado
        </a>
      </header>
      <div className="picker-grid">
        <CatalogPicker {...props.customers} />
        <CatalogPicker {...props.products} />
      </div>
      <form
        className="panel order-draft"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          props.onSubmit();
        }}
        aria-busy={props.submitting}
      >
        <h2>Composición del pedido</h2>
        <p className="selected-customer">
          <strong>Cliente:</strong> {props.selectedCustomer}
        </p>
        {props.errors.customer && (
          <p role="alert" className="field-error">
            {props.errors.customer}
          </p>
        )}
        {props.errors.items && (
          <p role="alert" className="field-error">
            {props.errors.items}
          </p>
        )}
        <div className="table-scroll">
          <table>
            <caption className="sr-only">Productos que se incluirán en el pedido</caption>
            <thead>
              <tr>
                {['Producto', 'Precio de referencia', 'Cantidad', 'Monto estimado', 'Acción'].map(
                  (label) => (
                    <th key={label} scope="col">
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {props.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.name}
                    <small>
                      {item.sku} · Stock consultado: {item.stock}
                    </small>
                  </td>
                  <td className="money">{item.priceLabel}</td>
                  <td>
                    <label className="quantity-label">
                      Cantidad de {item.name}
                      <input
                        type="number"
                        min="1"
                        max="2147483647"
                        step="1"
                        value={item.quantity}
                        disabled={props.submitting}
                        aria-invalid={!!props.errors[`quantity-${item.id}`]}
                        aria-describedby={
                          props.errors[`quantity-${item.id}`]
                            ? `quantity-error-${item.id}`
                            : undefined
                        }
                        onChange={(event) => props.onQuantityChange(item.id, event.target.value)}
                      />
                    </label>
                    {props.errors[`quantity-${item.id}`] && (
                      <p id={`quantity-error-${item.id}`} className="field-error">
                        {props.errors[`quantity-${item.id}`]}
                      </p>
                    )}
                  </td>
                  <td className="money">{item.amountLabel}</td>
                  <td>
                    <button
                      type="button"
                      disabled={props.submitting}
                      aria-label={`Quitar ${item.name}`}
                      onClick={() => props.onRemove(item.id)}
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!props.items.length && (
          <p className="empty-state">
            El pedido aún no tiene productos. Usa el buscador de productos para agregarlos.
          </p>
        )}
        <p className="order-total">
          Total estimado: <strong>{props.totalLabel}</strong>
        </p>
        <p className="help-text">
          El precio vigente y el stock se verifican al confirmar. El monto definitivo aparecerá en
          el detalle del pedido.
        </p>
        <RequestError error={props.error} />
        {props.submitting && <p role="status">Creando pedido…</p>}
        <div className="actions">
          <button
            className="button-primary"
            type="submit"
            disabled={props.submitting || props.uncertain}
          >
            {props.submitting ? 'Confirmando…' : 'Confirmar pedido'}
          </button>
          <a
            className="button"
            href="#/orders"
            aria-disabled={props.submitting}
            onClick={(event) => {
              if (props.submitting) event.preventDefault();
            }}
          >
            Volver al listado
          </a>
        </div>
      </form>
    </section>
  );
}
