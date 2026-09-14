// Tipos del contrato que las pruebas HTTP verifican mediante sus aserciones.
// Mantener el JSON como unknown hasta este límite evita heredar any de lib.dom.
export async function readJson<T>(response: Response): Promise<T> {
  const payload: unknown = await response.json();
  return payload as T;
}

export interface Page<T> {
  data: T[];
  nextCursor: string | null;
}

export interface ErrorResponse {
  code: string;
  message: string;
}
