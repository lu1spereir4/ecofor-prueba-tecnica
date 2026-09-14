# Inventario ECOFOR

Aplicación de práctica con PostgreSQL 15, Express, TypeScript, React 19, Redux Toolkit y Tailwind. Permite consultar productos, buscar por nombre o código, filtrar por categoría exacta y actualizar stock sin recargar la página.

## Ejecutar en este equipo

Docker Desktop debe estar iniciado. Desde la raíz:

```powershell
docker start ecofor-postgres
cd backend
npm.cmd install
npm.cmd run test-db
npm.cmd run dev
```

En otra terminal, desde la raíz:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Abre http://127.0.0.1:5173. API: http://localhost:3000/health y http://localhost:3000/api/products.

PostgreSQL de Docker está publicado en `127.0.0.1:5434`, para evitar el conflicto con PostgreSQL instalado en Windows. El backend usa `backend/.env`. Vite redirige `/api` al backend en el puerto 3000; para otro servidor se puede configurar `VITE_API_URL` usando `frontend/.env.example`. Si cambia un `.env`, reinicia su servidor.

Usamos `npm.cmd` y `npx.cmd` porque PowerShell puede bloquear los archivos `.ps1`.

## Preparar una base nueva (otro equipo)

Solo si no existe el contenedor:

```powershell
docker run -d --name ecofor-postgres --restart unless-stopped -p 127.0.0.1:5434:5432 -e POSTGRES_USER=ecofor -e POSTGRES_PASSWORD=ecofor123 -e POSTGRES_DB=ecofor_db -v ecofor-data:/var/lib/postgresql/data postgres:15
Copy-Item backend/.env.example backend/.env
```

Espera a que PostgreSQL esté listo. Desde la raíz, crea la tabla y carga el CSV:

```powershell
Get-Content backend/schema.sql -Raw | docker exec -i ecofor-postgres psql -v ON_ERROR_STOP=1 -U ecofor -d ecofor_db
cd backend
npm.cmd install
npm.cmd run ingest
```

La ingesta valida las filas e informa los rechazos. Usa UPSERT por código: ejecutarla de nuevo actualiza los productos existentes, incluido su stock, con los valores del CSV. Las credenciales del ejemplo son para esta práctica local.

## Verificación

```powershell
npm.cmd --prefix backend run typecheck
npm.cmd --prefix backend test
npm.cmd --prefix frontend run build
npm.cmd --prefix frontend run lint
```

La prueba de API requiere la base y tabla disponibles. Crea un producto temporal, comprueba filtros, actualización y validación, y lo elimina al terminar. No cambia los productos del CSV.

En la interfaz: buscar `taladro`, limpiar, filtrar `Seguridad`, editar stock, guardar y recargar para comprobar persistencia. Los errores de consulta y guardado aparecen en pantalla. Un campo de stock vacío, negativo o decimal no es válido.

## Organización y explicación del flujo

- `backend/src/ingest.ts`: CSV, validación y UPSERT en PostgreSQL.
- `backend/src/routes`, `controllers`, `repositories`: validación HTTP, respuestas y consultas SQL parametrizadas.
- `frontend/src/services/productsApi.ts`: solicitudes GET/PATCH y errores HTTP.
- `frontend/src/features/products`: tipos, thunks y estado de productos, carga, errores y guardado.
- `frontend/src/app`: store y hooks tipados; `main.tsx` conecta el Provider.
- `frontend/src/pages/ProductsPage.tsx`: componentes funcionales, filtros y edición de stock.

Al montar la pantalla, `useEffect` despacha `fetchProducts`. El thunk llama al cliente HTTP; Express consulta PostgreSQL y Redux guarda los productos. `useAppSelector` hace que React refleje el nuevo estado. Al guardar stock, el PATCH devuelve el producto actualizado y el slice lo reemplaza sin recargar la página.

Los campos de búsqueda y edición son estado local con `useState`; los productos y sus solicitudes viven en Redux. `createSlice` usa Immer para producir actualizaciones inmutables a partir de la sintaxis de asignación. Las solicitudes antiguas no reemplazan los resultados de una búsqueda más reciente.

## Git

El repositorio ya está inicializado. `.gitignore` excluye dependencias, builds y `.env`. Para preparar tu entrega, revisa `git status` y los archivos nuevos en el editor; después puedes agregar los archivos y crear tu commit. No se ha publicado ni creado un commit automáticamente.
