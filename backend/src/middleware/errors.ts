import type { ErrorRequestHandler, RequestHandler } from 'express';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ code: 'ROUTE_NOT_FOUND', message: 'Ruta no encontrada' });
};

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({
      code: error.code,
      message: error.message,
      ...(error.details === undefined ? {} : { details: error.details }),
    });
    return;
  }
  const failure = error as { type?: string; code?: string };
  if (failure.type === 'entity.parse.failed') {
    res.status(400).json({ code: 'INVALID_JSON', message: 'JSON inválido' });
    return;
  }
  if (failure.type === 'entity.too.large') {
    res
      .status(413)
      .json({ code: 'PAYLOAD_TOO_LARGE', message: 'El cuerpo supera el máximo de 1 MB' });
    return;
  }
  if (failure.type === 'charset.unsupported' || failure.type === 'encoding.unsupported') {
    res.status(415).json({ code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Codificación no admitida' });
    return;
  }
  if (['55P03', '57014', '40P01', '40001'].includes(failure.code ?? '')) {
    res.setHeader('Retry-After', '1');
    res
      .status(503)
      .json({ code: 'DATABASE_BUSY', message: 'La operación no se completó; vuelve a intentarlo' });
    return;
  }
  console.error(error);
  res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Error interno del servidor' });
};

export const requireJson: RequestHandler = (req, _res, next) => {
  if (!req.is('application/json')) {
    next(
      new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Se requiere Content-Type: application/json'),
    );
    return;
  }
  next();
};
