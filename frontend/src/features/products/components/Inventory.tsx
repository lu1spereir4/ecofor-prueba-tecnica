import type { ErrorNotice } from '../../../shared/api/http';
import { RequestError } from '../../../shared/components/RequestError';
interface Props {
  rows: {
    id: string;
    code: string;
    name: string;
    category: string;
    priceLabel: string;
    stock: number;
  }[];
  search: string;
  category: string;
  loading: boolean;
  error: ErrorNotice | null;
  notice: string;
  editingId: string | null;
  stockValue: string;
  stockError: string;
  saving: boolean;
  onFieldChange: (field: 'search' | 'category', value: string) => void;
  onSearch: () => void;
  onClear: () => void;
  onRetry: () => void;
  onEdit: (id: string) => void;
  onStockChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}
export function Inventory(props: Props) {
  return (
    <section aria-labelledby="inventory-title">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Inventario original</p>
          <h1 id="inventory-title">Inventario ECOFOR</h1>
          <p>Consulta productos y actualiza sus existencias.</p>
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
          Nombre o código
          <input
            value={props.search}
            disabled={props.saving}
            onChange={(event) => props.onFieldChange('search', event.target.value)}
          />
        </label>
        <label>
          Categoría
          <input
            value={props.category}
            disabled={props.saving}
            onChange={(event) => props.onFieldChange('category', event.target.value)}
          />
        </label>
        <div className="actions">
          <button type="submit" disabled={props.saving} className="button-primary">
            Buscar productos
          </button>
          <button type="button" disabled={props.saving} onClick={props.onClear}>
            Limpiar
          </button>
        </div>
      </form>
      <RequestError error={props.error} onRetry={props.onRetry} />
      {props.notice && (
        <p role="status" className="notice notice-success">
          {props.notice}
        </p>
      )}
      <p role="status">
        {props.loading ? 'Cargando productos…' : `${props.rows.length} productos encontrados`}
      </p>
      <div className="table-scroll panel">
        <table aria-busy={props.loading}>
          <caption className="sr-only">Productos del inventario y edición de stock</caption>
          <thead>
            <tr>
              {['Código', 'Producto', 'Categoría', 'Precio', 'Stock', 'Acción'].map((label) => (
                <th key={label} scope="col">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {props.rows.map((row) => (
              <tr key={row.id}>
                <td>{row.code}</td>
                <td>{row.name}</td>
                <td>{row.category}</td>
                <td className="money">{row.priceLabel}</td>
                <td>{row.stock}</td>
                <td>
                  {props.editingId === row.id ? (
                    <form
                      className="stock-form"
                      noValidate
                      onSubmit={(event) => {
                        event.preventDefault();
                        props.onSave();
                      }}
                    >
                      <label>
                        Nuevo stock de {row.code}
                        <input
                          type="number"
                          min="0"
                          max="2147483647"
                          step="1"
                          value={props.stockValue}
                          disabled={props.saving}
                          aria-invalid={!!props.stockError}
                          onChange={(event) => props.onStockChange(event.target.value)}
                        />
                      </label>
                      <button disabled={props.saving} type="submit">
                        {props.saving ? 'Guardando…' : 'Guardar'}
                      </button>
                      <button disabled={props.saving} type="button" onClick={props.onCancel}>
                        Cancelar
                      </button>
                      {props.stockError && (
                        <p role="alert" className="field-error">
                          {props.stockError}
                        </p>
                      )}
                    </form>
                  ) : (
                    <button
                      disabled={props.saving}
                      type="button"
                      onClick={() => props.onEdit(row.id)}
                    >
                      Editar stock
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!props.loading && !props.error && !props.rows.length && (
          <p className="empty-state">No se encontraron productos.</p>
        )}
      </div>
    </section>
  );
}
