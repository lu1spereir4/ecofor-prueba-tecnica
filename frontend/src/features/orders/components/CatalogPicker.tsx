import type { ErrorNotice } from '../../../shared/api/http';
import { RequestError } from '../../../shared/components/RequestError';
import { Pagination } from '../../../shared/components/Pagination';
import type { PaginationProps } from '../../../shared/components/Pagination';

export interface CatalogPickerProps {
  title: string;
  searchLabel: string;
  searchValue: string;
  actionLabel: string;
  options: {
    id: number;
    label: string;
    description: string;
    selected: boolean;
    disabled: boolean;
  }[];
  loading: boolean;
  disabled: boolean;
  error: ErrorNotice | null;
  pagination: PaginationProps;
  onSearchChange: (value: string) => void;
  onSearch: () => void;
  onSelect: (id: number) => void;
  onRetry: () => void;
}
export function CatalogPicker(props: CatalogPickerProps) {
  return (
    <section className="panel picker" aria-label={props.title}>
      <h2>{props.title}</h2>
      <form
        className="search-bar"
        onSubmit={(event) => {
          event.preventDefault();
          props.onSearch();
        }}
      >
        <label>
          {props.searchLabel}
          <input
            type="search"
            maxLength={512}
            value={props.searchValue}
            disabled={props.disabled}
            onChange={(event) => props.onSearchChange(event.target.value)}
          />
        </label>
        <button type="submit" disabled={props.disabled}>
          Buscar
        </button>
      </form>
      <RequestError error={props.error} onRetry={props.disabled ? undefined : props.onRetry} />
      {props.loading && <p role="status">Cargando {props.title.toLowerCase()}…</p>}
      <ul className="picker-results" aria-busy={props.loading}>
        {props.options.map((option) => (
          <li key={option.id} className={option.selected ? 'is-selected' : ''}>
            <div>
              <strong>{option.label}</strong>
              <small>{option.description}</small>
            </div>
            <button
              type="button"
              disabled={option.disabled}
              aria-pressed={option.selected}
              aria-label={`${props.actionLabel} ${option.label}`}
              onClick={() => props.onSelect(option.id)}
            >
              {option.selected ? 'Seleccionado' : props.actionLabel}
            </button>
          </li>
        ))}
      </ul>
      {!props.loading && !props.error && props.options.length === 0 && (
        <p className="empty-state">No hay resultados para esta búsqueda.</p>
      )}
      <Pagination {...props.pagination} />
    </section>
  );
}
