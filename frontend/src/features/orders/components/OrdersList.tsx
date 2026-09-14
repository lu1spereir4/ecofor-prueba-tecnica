import type { OrderRowView } from '../models';
import type { ErrorNotice } from '../../../shared/api/http';
import { RequestError } from '../../../shared/components/RequestError';
import { Pagination } from '../../../shared/components/Pagination';
import type { PaginationProps } from '../../../shared/components/Pagination';

interface Props {
  rows: OrderRowView[];
  loading: boolean;
  error: ErrorNotice | null;
  validation: string;
  filters: { customer: string; status: string; from: string; to: string };
  limit: number;
  statuses: { value: string; label: string }[];
  pagination: PaginationProps;
  onFieldChange: (field: 'customer' | 'status' | 'from' | 'to', value: string) => void;
  onSearch: () => void;
  onClear: () => void;
  onRetry: () => void;
  onLimitChange: (value: number) => void;
}
export function OrdersList(props: Props) {
  return (
    <section aria-labelledby="orders-title">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Gestión de pedidos</p>
          <h1 id="orders-title">Pedidos</h1>
          <p>Busca por nombre del cliente y consulta los pedidos más recientes.</p>
        </div>
        <a className="button button-primary" href="#/orders/new">
          Crear pedido
        </a>
      </header>
      <form
        className="panel filters"
        onSubmit={(event) => {
          event.preventDefault();
          props.onSearch();
        }}
      >
        <label>
          Nombre del cliente
          <input
            value={props.filters.customer}
            maxLength={512}
            placeholder="Ej. María"
            onChange={(event) => props.onFieldChange('customer', event.target.value)}
          />
        </label>
        <label>
          Estado
          <select
            value={props.filters.status}
            onChange={(event) => props.onFieldChange('status', event.target.value)}
          >
            <option value="">Todos</option>
            {props.statuses.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Desde (UTC)
          <input
            type="date"
            value={props.filters.from}
            onChange={(event) => props.onFieldChange('from', event.target.value)}
          />
        </label>
        <label>
          Hasta (UTC)
          <input
            type="date"
            value={props.filters.to}
            onChange={(event) => props.onFieldChange('to', event.target.value)}
          />
        </label>
        <div className="actions">
          <button className="button-primary" type="submit">
            Buscar pedidos
          </button>
          <button type="button" onClick={props.onClear}>
            Limpiar
          </button>
        </div>
      </form>
      {props.validation && (
        <p role="alert" className="field-error">
          {props.validation}
        </p>
      )}
      <RequestError error={props.error} onRetry={props.onRetry} />
      <div className="list-toolbar">
        <p role="status">
          {props.loading ? 'Cargando pedidos…' : `${props.rows.length} pedidos en esta página`}
        </p>
        <label className="inline-label">
          Pedidos por página
          <select
            value={props.limit}
            onChange={(event) => props.onLimitChange(Number(event.target.value))}
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
      </div>
      <div className="table-scroll panel">
        <table aria-busy={props.loading}>
          <caption className="sr-only">Pedidos ordenados del más reciente al más antiguo</caption>
          <thead>
            <tr>
              {['Pedido', 'Cliente', 'Estado', 'Fecha (UTC)', 'Monto', 'Acción'].map((label) => (
                <th key={label} scope="col">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {props.rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>#{row.id}</strong>
                  <small>{row.reference}</small>
                </td>
                <td>
                  {row.customer}
                  <small>{row.email}</small>
                </td>
                <td>
                  <span className={`status status-${row.statusTone}`}>{row.statusLabel}</span>
                </td>
                <td>{row.dateLabel}</td>
                <td className="money">{row.totalLabel}</td>
                <td>
                  <a href={row.detailHref} aria-label={`Ver pedido ${row.id}`}>
                    Ver detalle
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!props.loading && !props.error && props.rows.length === 0 && (
          <p className="empty-state">No se encontraron pedidos con estos filtros.</p>
        )}
      </div>
      <Pagination {...props.pagination} />
    </section>
  );
}
