import type { ErrorNotice } from '../../../shared/api/http';
import { RequestError } from '../../../shared/components/RequestError';

interface Props {
  rows: {
    id: number;
    rank: number;
    name: string;
    amount: string;
    orders: number;
    average: string;
  }[];
  date: string;
  period: string;
  loading: boolean;
  error: ErrorNotice | null;
  onDateChange: (value: string) => void;
  onSearch: () => void;
  onToday: () => void;
  onRetry: () => void;
}

export function TopCustomers(props: Props) {
  return (
    <section aria-labelledby="top-customers-title">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Reportes</p>
          <h1 id="top-customers-title">Top clientes</h1>
          <p>
            Los 10 clientes con mayor monto en los 30 días anteriores al corte, excluyendo pedidos
            cancelados.
          </p>
        </div>
      </header>
      <form
        className="panel filters"
        onSubmit={(event) => {
          event.preventDefault();
          props.onSearch();
        }}
      >
        <label>
          Fecha de corte (UTC)
          <input
            type="date"
            value={props.date}
            onChange={(event) => props.onDateChange(event.target.value)}
            aria-describedby="report-date-help"
          />
        </label>
        <div className="actions">
          <button className="button-primary" type="submit">
            Consultar top clientes
          </button>
          <button type="button" onClick={props.onToday}>
            Usar fecha actual
          </button>
        </div>
        <p id="report-date-help" className="help-text">
          El corte es a las 00:00 UTC. Vacío utiliza la fecha actual.
        </p>
      </form>
      <RequestError error={props.error} onRetry={props.onRetry} />
      {props.loading && <p role="status">Consultando top clientes…</p>}
      {props.period && <p className="help-text report-period">{props.period}</p>}
      <div className="table-scroll panel">
        <table aria-busy={props.loading}>
          <caption className="sr-only">Ranking de clientes por monto acumulado</caption>
          <thead>
            <tr>
              <th scope="col">Posición</th>
              <th scope="col">Cliente</th>
              <th scope="col" className="money">
                Monto total
              </th>
              <th scope="col">Pedidos</th>
              <th scope="col" className="money">
                Ticket promedio
              </th>
            </tr>
          </thead>
          <tbody>
            {props.rows.map((row) => (
              <tr key={row.id}>
                <td>{row.rank}</td>
                <td>
                  {row.name}
                  <small>Cliente #{row.id}</small>
                </td>
                <td className="money">{row.amount}</td>
                <td>{row.orders}</td>
                <td className="money">{row.average}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!props.loading && !props.error && !props.rows.length && (
          <p className="empty-state">No hay clientes con pedidos en este período.</p>
        )}
      </div>
    </section>
  );
}
