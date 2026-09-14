# API ECOFOR

Consultar [README del backend](README.md) para contratos HTTP, consultas SQL, índices y migración de channel.

La instalación y el comando de pruebas están en el [README principal](../README.md). Para probar manualmente, importar la [colección Postman](postman/ECOFOR.postman_collection.json).

## Stock del catálogo de ventas

`PATCH /api/catalog/products/:id/stock` recibe `{ "stock": 12 }` y actualiza `sales.products`, la misma tabla utilizada por los pedidos. El stock debe ser un entero entre 0 y 2147483647. Devuelve `{ data: { id, sku, name, price, stock } }`, 400 para entradas inválidas y 404 si el producto no existe. El inventario del frontend lista estos productos mediante `GET /api/catalog/products` con `search`, `after` y `limit`.

Los endpoints `/api/products` permanecen disponibles para el inventario antiguo de `ecofor_simulacion_inventario.csv`.
