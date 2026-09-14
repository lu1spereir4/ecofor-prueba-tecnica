-- Baseline compatible con el inventario previamente instalado.
CREATE TABLE IF NOT EXISTS public.products (
  id BIGSERIAL PRIMARY KEY,
  codigo VARCHAR(50) NOT NULL UNIQUE,
  nombre TEXT NOT NULL CHECK (btrim(nombre) <> ''),
  categoria TEXT NOT NULL CHECK (btrim(categoria) <> ''),
  precio INTEGER NOT NULL CHECK (precio >= 0),
  stock INTEGER NOT NULL CHECK (stock >= 0),
  proveedor TEXT,
  fecha_actualizacion DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
