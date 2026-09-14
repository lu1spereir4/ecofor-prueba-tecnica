import type { ErrorNotice } from '../api/http';
export function RequestError({
  error,
  onRetry,
}: {
  error: ErrorNotice | null;
  onRetry?: () => void;
}) {
  if (!error) return null;
  return (
    <div role="alert" className="notice notice-error">
      <p>
        {error.message}
        {error.code && <small className="error-code"> ({error.code})</small>}
      </p>
      {error.details.length > 0 && (
        <ul>
          {error.details.map((message, index) => (
            <li key={index}>{message}</li>
          ))}
        </ul>
      )}
      {onRetry && (
        <button type="button" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  );
}
