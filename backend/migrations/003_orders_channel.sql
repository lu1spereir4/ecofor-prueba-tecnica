-- Ejecutar dentro de una transacción corta (npm run migrate).
-- NOWAIT evita encolar un ACCESS EXCLUSIVE detrás de consultas largas.
SET LOCAL lock_timeout = '100ms';
SET LOCAL statement_timeout = '3s';
LOCK TABLE sales.orders IN ACCESS EXCLUSIVE MODE NOWAIT;
-- PostgreSQL 15+: default constante en catálogo, sin UPDATE ni reescritura.
ALTER TABLE sales.orders ADD COLUMN channel TEXT NOT NULL DEFAULT 'web';
