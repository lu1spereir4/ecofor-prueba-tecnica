export interface PaginationProps {
  label: string;
  previousDisabled: boolean;
  nextDisabled: boolean;
  onPrevious: () => void;
  onNext: () => void;
}
export function Pagination({
  label,
  previousDisabled,
  nextDisabled,
  onPrevious,
  onNext,
}: PaginationProps) {
  return (
    <nav aria-label={label} className="pagination">
      <button type="button" disabled={previousDisabled} onClick={onPrevious}>
        Anterior
      </button>
      <span>{label}</span>
      <button type="button" disabled={nextDisabled} onClick={onNext}>
        Siguiente
      </button>
    </nav>
  );
}
