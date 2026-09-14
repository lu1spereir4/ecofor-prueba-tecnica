# Cliente ECOFOR

React 19, TypeScript estricto, fetch nativo, estado local y CSS. La instalación completa está en el [README principal](../README.md).

## Organización

Cada feature separa tres capas:

- `components/`: datos y callbacks por props; sin HTTP ni lógica de negocio.
- `containers/`: conectan los componentes con los hooks.
- `hooks/`: estado, validación y llamadas a `api.ts`.

Se usa estado local porque filtros, selección y formularios pertenecen a cada vista. `shared/` contiene transporte HTTP, formato y lecturas cancelables; `models.ts` prepara los datos de presentación.

## Vistas y ejecución

`#/orders` muestra el listado; `#/orders/new` crea pedidos; `#/orders/:id` abre el detalle y el simulador de descuentos; `#/reports/top-customers` muestra el ranking con fecha de corte; `#/inventory` muestra los productos de ventas cargados desde `products.csv`, con búsqueda por nombre/SKU, paginación y edición de stock sobre `sales.products`. La navegación por hash permite recargar un detalle sin configurar reescrituras del servidor.

`reports/` consulta los 10 clientes con mayor monto. `discounts/` valida hasta 30 cupones, envía sus condiciones a la API y presenta la combinación elegida y el desglose por ítem. El cálculo pertenece al backend y no modifica el pedido; editar un cupón cancela la consulta anterior y descarta su resultado.

Con el backend activo en el puerto 3000, ejecutar desde la raíz:

```powershell
npm.cmd --prefix frontend run dev
```

Abrir http://127.0.0.1:5173. Vite redirige `/api` al backend. En producción, servir `dist/` y configurar ese proxy o definir `VITE_API_URL` al compilar.

```powershell
npm.cmd --prefix frontend test
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend run build
```
