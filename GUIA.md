# Guía personal: entender y defender el inventario ECOFOR

Esta guía describe el código que existe en el proyecto. Distingue lo implementado de las mejoras pendientes para que puedas explicarlo sin prometer funcionalidades que no tiene. Es material personal de estudio y está excluido de Git.

## 1. Tu presentación en un minuto

> “Construí una aplicación de inventario que carga datos desde un CSV a PostgreSQL y permite consultarlos y actualizar el stock desde una interfaz React. La ingesta está escrita en TypeScript, valida las filas y usa UPSERT para evitar duplicados por código. El backend es una API Express separada en rutas, controladores y repositorios, con validación de entradas y SQL parametrizado. En el frontend uso componentes funcionales, hooks y Redux Toolkit para manejar productos, solicitudes y errores. Los campos temporales de los formularios permanecen en estado local. PostgreSQL corre en Docker y el frontend se comunica con la API mediante HTTP.”

No hace falta recitar versiones de todas las librerías. Primero explica el problema, luego el recorrido de los datos y finalmente las decisiones técnicas.

## 2. Qué hace y qué no hace

La aplicación permite:

- Importar un CSV, reportar filas inválidas y guardar las válidas.
- Listar productos y buscar por parte del nombre o código.
- Filtrar por categoría exacta; combinar ese filtro con la búsqueda.
- Editar stock y reflejar el resultado sin recargar la página.
- Mostrar estados de carga, ausencia de resultados y errores.
- Persistir los cambios de stock en PostgreSQL.

No implementa autenticación, permisos, paginación, historial de movimientos, creación de productos desde la interfaz ni un despliegue de producción. No es un sistema completo de ventas o reservas.

## 3. Mapa de archivos: dónde mirar cuando te preguntan

### Datos y backend

- `data/ecofor_simulacion_inventario.csv`: datos de entrada.
- `backend/schema.sql`: definición reproducible de la tabla y restricciones.
- `backend/src/ingest.ts`: lectura, conversión, validación y UPSERT del CSV.
- `backend/src/db.ts`: configuración del pool de PostgreSQL mediante variables de entorno.
- `backend/src/server.ts`: verifica la conexión e inicia el servidor HTTP.
- `backend/src/app.ts`: crea Express, instala middleware y registra rutas y manejo de errores.
- `backend/src/routes/product.routes.ts`: define endpoints y reglas de validación.
- `backend/src/middleware/validate.ts`: responde 400 cuando hay errores de validación.
- `backend/src/controllers/product.controller.ts`: interpreta la solicitud y decide la respuesta HTTP.
- `backend/src/repositories/product.repository.ts`: ejecuta SQL para consultar y actualizar.
- `backend/src/test-db.ts`: consulta sencilla para comprobar conexión.
- `backend/src/test-api.ts`: prueba de integración con una base real y un producto temporal.

### Frontend

- `frontend/src/main.tsx`: monta React, StrictMode y el Provider de Redux.
- `frontend/src/App.tsx`: presenta la página de productos.
- `frontend/src/app/store.ts`: configura el estado global.
- `frontend/src/app/hooks.ts`: exporta dispatch y selector con tipos.
- `frontend/src/features/products/types.ts`: contratos TypeScript de productos y filtros.
- `frontend/src/features/products/productsSlice.ts`: thunks y cambios del estado de productos.
- `frontend/src/services/productsApi.ts`: construye solicitudes HTTP y procesa respuestas.
- `frontend/src/pages/ProductsPage.tsx`: tabla, filtros, edición y mensajes al usuario.
- `frontend/src/index.css`: importa Tailwind y estilos globales mínimos.
- `frontend/vite.config.ts`: plugins y proxy de desarrollo para `/api`.

## 4. Los tres recorridos que debes poder explicar

### A. Importar el CSV

```text
npm.cmd run ingest
  → tsx ejecuta ingest.ts
  → lee el archivo y csv-parse interpreta las columnas
  → validateRow convierte y valida cada fila
  → separa productos válidos y reporta rechazos
  → obtiene una conexión del pool
  → BEGIN
  → INSERT ... ON CONFLICT (codigo) DO UPDATE por producto
  → COMMIT, o ROLLBACK si falla una operación SQL
  → libera la conexión y cierra el pool
```

El CSV contiene texto: `precio` y `stock` se convierten con `Number`. Se limpian espacios con `trim`, el proveedor vacío pasa a `null`, y se valida el formato y la existencia de la fecha.

La fecha se comprueba en dos pasos: una expresión regular exige `YYYY-MM-DD` y luego se construye una fecha UTC y se comparan sus componentes. La comparación detecta fechas que JavaScript normalizaría, como un día inexistente de febrero. UTC evita que el huso horario local cambie el resultado de esta validación.

`columns: true` toma los encabezados como nombres de propiedades; `skip_empty_lines` omite líneas vacías y `bom` admite la marca inicial que algunos archivos UTF-8 traen.

**Matiz importante:** se rechazan las filas inválidas y se importan las válidas. La transacción cubre el conjunto de filas válidas, no convierte el archivo completo en una validación de “todo o nada”.

### B. Abrir la página o buscar

```text
React monta ProductsPage
  → useEffect despacha fetchProducts({})
  → Redux recibe pending y activa loading
  → getProducts construye la URL y llama fetch
  → Vite redirige /api a Express durante desarrollo
  → ruta GET valida parámetros
  → controlador extrae search y category
  → repositorio construye condiciones SQL y consulta el pool
  → PostgreSQL devuelve filas
  → Express responde { data, count }
  → thunk devuelve response.data
  → fulfilled guarda items y desactiva loading
  → useAppSelector recibe el estado actualizado
  → React actualiza la tabla
```

Al buscar, el formulario evita su envío HTML normal con `preventDefault` y despacha el mismo thunk con filtros. No se consulta en cada tecla: el usuario pulsa Buscar o envía el formulario con Enter.

`search=taladro` se transforma en un patrón `%taladro%`. `ILIKE` busca sin distinguir mayúsculas y minúsculas; no garantiza ignorar tildes. Nombre y código se combinan con `OR`. La categoría usa igualdad exacta; si hay búsqueda y categoría se combinan con `AND`.

La lista se ordena por código. `count` es la cantidad devuelta en esa consulta; no representa un total independiente para paginación. El slice conserva los productos y la interfaz muestra `items.length`.

### C. Editar stock

```text
Editar stock
  → estado local guarda el ID y el valor del formulario
  → Guardar valida que sea un entero permitido
  → dispatch(changeProductStock({ id, stock }))
  → pending activa saving[id] y limpia el error de ese producto
  → cliente HTTP envía PATCH /api/products/:id/stock
  → Express interpreta JSON y valida ID y stock
  → controlador invoca al repositorio
  → UPDATE ... RETURNING devuelve el producto guardado
  → Express responde { data: producto }
  → fulfilled sustituye el producto en items
  → React muestra el nuevo stock y un mensaje de éxito
```

El stock nuevo se refleja después de que el servidor confirma el guardado: **no es una actualización optimista**. Si falla, se conserva el stock anterior y se muestra el error. El componente comprueba `changeProductStock.fulfilled.match(result)` antes de cerrar la edición.

Al recargar, Redux vuelve a empezar, pero el stock se recupera desde PostgreSQL. Redux no es la persistencia de esta aplicación.

## 5. PostgreSQL y SQL que debes dominar

### Claves, tipos y restricciones

`id` es la clave primaria técnica; `codigo` es la identificación del producto dentro del CSV y tiene una restricción UNIQUE. Una clave primaria identifica cada fila. UNIQUE impide códigos duplicados y permite usar ese campo como objetivo de `ON CONFLICT`.

La tabla usa `BIGSERIAL` para el ID. `pg` devuelve este entero grande como string por defecto; por eso el frontend declara `id: string`. Convertir enteros muy grandes a `number` puede perder precisión. El controlador actual sí convierte el ID a Number: para IDs fuera del rango seguro de JavaScript sería necesario corregir esa parte y conservar el string también en el backend.

Precio y stock son INTEGER. El precio se expresa en pesos enteros; no se usan decimales monetarios en este ejercicio. El máximo positivo de INTEGER es 2147483647, límite que se comprueba al editar stock.

Las restricciones NOT NULL, UNIQUE y CHECK protegen los datos incluso si alguien escribe fuera de la API. El proveedor admite `null`, que representa ausencia de valor.

`fecha_actualizacion` viene del CSV. `updated_at` es un timestamp técnico del último cambio y se actualiza en el UPSERT y al editar stock. No significan lo mismo. El PATCH no cambia `fecha_actualizacion`.

### SQL parametrizado

```sql
UPDATE products
SET stock = $1, updated_at = NOW()
WHERE id = $2
RETURNING id, codigo, nombre, categoria, precio, stock;
```

Los valores se envían separados del SQL. No se concatena el texto del usuario como código SQL. En el buscador se construyen fragmentos de consulta, pero esos fragmentos son fijos y los valores siguen usando placeholders.

> “Parametrizo los datos de entrada para evitar que se interpreten como SQL.”

Los caracteres `%` y `_` escritos por el usuario conservan significado de comodín en ILIKE. Eso no es inyección SQL; es una decisión de búsqueda que habría que ajustar si se exigiera coincidencia literal.

### UPSERT e idempotencia

`INSERT ... ON CONFLICT (codigo) DO UPDATE` inserta un producto nuevo o actualiza el existente. `EXCLUDED` representa los valores propuestos para la inserción.

Repetir la carga no duplica los códigos y deja los campos del producto con los valores del CSV. Pero no digas que no produce ningún cambio: modifica `updated_at` y puede reemplazar un stock que se haya editado manualmente. Tampoco elimina productos que hayan desaparecido del CSV.

### Transacciones y pool

`BEGIN` abre una transacción; `COMMIT` confirma sus operaciones; `ROLLBACK` revierte las operaciones de esa transacción si falla la carga.

El pool reutiliza conexiones. Para una consulta aislada se usa `pool.query`. Para una transacción se obtiene un cliente con `pool.connect` y se ejecutan todas sus consultas sobre esa misma conexión. Usar llamadas independientes a `pool.query` para BEGIN y las siguientes consultas podría enviarlas a conexiones diferentes.

`client.release()` devuelve la conexión al pool. `pool.end()` cierra el pool cuando termina un script. El servidor mantiene el pool disponible mientras atiende solicitudes.

## 6. Backend: HTTP, Express y separación de responsabilidades

**Node.js** ejecuta JavaScript fuera del navegador. **Express** organiza solicitudes, middleware y respuestas HTTP. **TypeScript** añade comprobaciones estáticas. **tsx** permite ejecutar los archivos TypeScript del backend; se ejecuta `tsc --noEmit` por separado para comprobar los tipos.

Una ruta asocia método, URL y handlers. Un middleware procesa una solicitud y puede responder o pasar el control con `next()`. El orden importa: `express.json()` se instala antes de las rutas para tener `req.body` disponible.

La separación actual es:

- Ruta: URL y validadores.
- Middleware de validación: convierte resultados inválidos en respuesta 400.
- Controlador: interpreta la solicitud y el resultado para responder por HTTP.
- Repositorio: conoce SQL y PostgreSQL.

No hay una capa de servicios independiente porque la lógica de negocio es pequeña. Si creciera, las reglas compartidas podrían vivir allí sin mezclar HTTP ni SQL.

`app.ts` se separa de `server.ts` para poder importar Express en las pruebas y escuchar en un puerto temporal sin arrancar el servidor normal.

### Contrato HTTP actual

- `GET /health`: devuelve `{ status: 'ok' }`.
- `GET /api/products`: devuelve `{ data: Product[], count: number }`.
- `GET /api/products?search=taladro&category=Seguridad`: aplica los filtros juntos.
- `PATCH /api/products/:id/stock`: recibe `{ stock: 12 }` y devuelve `{ data: Product }`.

GET consulta; PATCH modifica una parte del recurso. PUT suele representar reemplazo completo según el contrato de la API, por lo que PATCH expresa mejor esta operación.

Respuestas: 200 al completar, 400 por entradas inválidas, 404 si el producto del PATCH no existe y 500 para errores inesperados que llegan al middleware global. Una búsqueda vacía devuelve 200 y `data: []`; no es un error 404.

El middleware global registra el error y responde un mensaje genérico. Una mejora pendiente es distinguir errores como JSON mal formado, que actualmente pueden terminar como 500 en vez de 400.

### async/await y errores

Una Promise representa una operación cuyo resultado llega después. `await` permite esperar ese resultado dentro de una función async sin bloquear por sí mismo todo el proceso de Node. `try/catch` maneja los rechazos esperados dentro de ese bloque. `finally` sirve para liberar recursos tanto si funciona como si falla.

En los controladores, `next(error)` deriva el error al middleware global. En los scripts, `process.exitCode = 1` indica fallo al sistema sin terminar inmediatamente antes de la limpieza.

## 7. React: conceptos aplicados, no definiciones sueltas

Un componente funcional es una función que devuelve JSX. JSX describe la interfaz; React lo utiliza para actualizar el DOM cuando cambian props o estado. Un render no implica recargar toda la página.

`useState` guarda valores locales entre renders. Los inputs son controlados porque su `value` sale del estado y `onChange` actualiza ese estado. Aquí search, category, editingId, stockValue, validationError y notice pertenecen a la pantalla.

`useEffect` sincroniza el componente con una solicitud externa al montarse. La función de limpieza cancela el thunk con `request.abort()`. El signal llega hasta fetch. Cancelar una lectura evita trabajo o respuestas innecesarias; no debe interpretarse como revertir una escritura ya recibida por el servidor.

`StrictMode` ayuda a detectar problemas de desarrollo y puede ejecutar un ciclo adicional de preparación y limpieza de efectos. No significa que el servidor de producción vaya a ejecutar necesariamente dos veces cada solicitud. La limpieza del efecto evita tratar una cancelación de esa comprobación como un fallo para el usuario.

Cada fila usa `key={product.id}` para que React conserve su identidad al cambiar la lista. El índice del array sería una identificación inestable si cambian orden o filtros.

La UI usa etiquetas de campos, encabezados de tabla, `aria-live` para mensajes y `role="alert"` para errores. El contenedor de la tabla permite desplazamiento horizontal en pantallas estrechas. Es una base de accesibilidad, no una auditoría completa.

## 8. Redux Toolkit: cómo explicarlo con este código

### Store, actions y reducers

El store reúne el estado global. `configureStore` registra el reducer `products` y configura herramientas y middleware habituales. Una action describe un evento. `dispatch` envía una action o, mediante middleware, un thunk. Un reducer determina el siguiente estado a partir del anterior y la action.

`createSlice` agrupa estado inicial y lógica de actualización. Aquí `reducers` está vacío y `extraReducers` responde a las actions de los thunks. `extraReducers` no significa “reducers secundarios”: permite manejar actions definidas fuera de ese slice.

Dentro de estos reducers escribimos `state.loading = true`. Redux Toolkit usa Immer para producir una actualización inmutable a partir de un borrador. No autoriza a mutar cualquier objeto del store fuera de los reducers.

### Thunks y fases de la solicitud

`createAsyncThunk` organiza una tarea asíncrona y genera actions `pending`, `fulfilled` y `rejected`. La llamada HTTP vive en el thunk/servicio, no dentro del reducer. La carga y los errores se actualizan al manejar esas actions.

`await dispatch(unThunk())` devuelve la action resultante; una solicitud rechazada no se comporta automáticamente como una Promise que lanza en ese punto. Este componente usa `.fulfilled.match(result)`; otra alternativa sería `.unwrap()` y un `try/catch`.

### Estado de productos

```text
products
  items        productos del resultado actual
  loading      consulta de productos en curso
  error        error de esa consulta
  requestId    identidad de la lectura más reciente
  saving       estado de guardado por ID
  stockErrors  error de guardado por ID
```

`requestId` resuelve un caso concreto: si una lectura vieja termina después de una nueva, se ignora su resultado para no sobrescribir la lista nueva. No es una solución general de concurrencia para la base de datos ni para todas las combinaciones de lecturas y escrituras.

`saving` y `stockErrors` usan `Record<string, ...>` para relacionar cada estado con un producto. La UI actual deshabilita otras acciones de guardado mientras una está pendiente.

`useAppSelector` lee del store y suscribe el componente a actualizaciones del valor seleccionado. `useAppDispatch` permite enviar thunks con tipos. `RootState` se obtiene con `ReturnType<typeof store.getState>` y `AppDispatch` con `typeof store.dispatch`, sin duplicar esos contratos manualmente.

El Provider hace que los componentes descendientes accedan al store. No pasa productos por HTTP ni guarda nada en la base: conecta React con Redux.

### Por qué Redux aquí

> “Lo uso para centralizar los productos y el ciclo de sus solicitudes, mientras mantengo los formularios temporales en estado local. Para una sola pantalla podría resolverlo con estado local; aquí Redux también permite mostrar y extender un flujo de estado explícito.”

No digas que React necesita Redux para usar fetch. Tampoco que Redux guarda automáticamente los datos al cerrar la pestaña. No se ha configurado persistencia local ni un sistema de caché avanzado. RTK Query sería una alternativa para reducir código de solicitudes, caché e invalidación; no está usado en esta implementación.

## 9. TypeScript que se ve en este proyecto

- `interface`: describe la forma de un objeto durante la comprobación de tipos.
- `string | null`: admite texto o ausencia explícita; distinto de propiedad opcional.
- `search?: string`: la propiedad puede omitirse.
- `Promise<Product>`: la operación resolverá a un producto según el contrato estático.
- `import type`: importa un tipo que no hace falta como valor al ejecutar JavaScript.
- `unknown`: exige comprobar o acotar un valor antes de usarlo libremente.
- `?.`: acceso opcional si el valor puede ser nulo o indefinido.
- `??`: valor alternativo solo ante null o undefined; `||` también sustituye valores como cadena vacía y cero.
- `as CsvRow[]`: afirmación de tipo; no transforma ni valida el contenido del CSV.
- `Number.isInteger`: validación real en ejecución, a diferencia de declarar `number`.

TypeScript no valida automáticamente el JSON de una API. `response.json()` y `readResponse<T>` se apoyan en un contrato asumido. En una aplicación más exigente añadiría validación de esquemas en los límites.

El backend conserva CommonJS y permite que TypeScript transforme import/export al desactivar `verbatimModuleSyntax`. El frontend usa módulos ESM y resolución para bundler. No deben copiarse configuraciones entre ambos sin revisar cómo se ejecuta cada uno.

## 10. Cliente HTTP, Vite, Tailwind y entorno

`productsApi.ts` encapsula URL, query params, método PATCH y JSON para que el slice y el componente no repitan esos detalles. `URL.searchParams` codifica los filtros y `encodeURIComponent` codifica el ID usado en la ruta.

fetch no rechaza automáticamente por respuestas 400 o 500; por eso se comprueba `response.ok` y se lanza un Error con el mensaje del servidor. Una caída de red sí puede rechazar fetch.

Vite sirve y transforma el frontend en desarrollo; el build genera archivos estáticos en `dist`. El proxy `/api` redirige a `127.0.0.1:3000` durante desarrollo. No se incorpora como servidor proxy a los archivos estáticos de producción: allí habría que configurar el alojamiento o `VITE_API_URL` apropiadamente.

Tailwind genera CSS a partir de las clases usadas en los componentes mediante su plugin de Vite. Las clases describen estilos; no implementan búsqueda ni lógica de datos.

CORS es una regla del navegador sobre acceso a respuestas de otros orígenes. `cors()` está habilitado de forma amplia en Express. El proxy de desarrollo evita que la llamada a `/api` salga a otro origen desde la perspectiva del navegador. CORS no sustituye autenticación ni protege por sí solo la API de clientes externos al navegador.

Las variables DB_* se leen en el backend desde `.env`. Las variables VITE_* se incorporan al cliente y son visibles para el usuario: nunca deben contener claves privadas. El frontend solo necesita la URL de la API, no la contraseña de PostgreSQL.

## 11. Docker y el problema real que resolvimos

PostgreSQL 15 corre en `ecofor-postgres`. Dentro del contenedor escucha en 5432; desde Windows se accede por `127.0.0.1:5434`. El mapeo evita el conflicto con PostgreSQL instalado directamente en Windows.

Una imagen es la plantilla con el software. Un contenedor es una instancia de esa imagen. El volumen conserva los archivos de PostgreSQL aparte del contenedor; al cambiar el contenedor se reutilizó el volumen para conservar la base.

> “El error de autenticación aparecía al conectar al puerto ocupado por otra instancia. Verifiqué que el usuario y la base existían dentro del contenedor y cambié el puerto publicado, después actualicé el .env y probé la conexión.”

Un error 28P01 significa que esa instancia rechazó la autenticación; no demuestra por sí solo que la contraseña esté mal en todas las instancias. ECONNREFUSED indica que no se pudo conectar al destino. `Cannot find module 'pg'` es un problema de resolución de dependencias, previo a PostgreSQL.

Las variables POSTGRES_* de la imagen inicializan una base vacía. Cambiarlas al reutilizar un volumen con datos no equivale a cambiar automáticamente las credenciales ya almacenadas.

## 12. Cómo ejecutar y demostrar el proyecto

Desde la raíz, inicia el contenedor y el backend:

```powershell
docker start ecofor-postgres
cd backend
npm.cmd run test-db
npm.cmd run dev
```

En otra terminal, desde la raíz:

```powershell
cd frontend
npm.cmd run dev
```

Abre `http://127.0.0.1:5173`. `npm.cmd` evita el bloqueo de `npm.ps1` por la política de PowerShell; no cambia esa política.

Demostración de cinco minutos:

1. Presenta el objetivo del inventario y muestra que carga los productos.
2. Busca `taladro`; explica el viaje del filtro hasta ILIKE.
3. Limpia y filtra `Seguridad`; señala que la categoría es exacta.
4. Edita un stock, guarda y recarga para demostrar persistencia. Anota el stock original si quieres restaurarlo después.
5. Explica el rechazo de un stock negativo y la validación doble en cliente y servidor.
6. Abre el slice, el controlador y el repositorio para conectar pantalla y código.
7. Muestra pruebas y menciona una limitación concreta con una mejora razonable.

No vuelvas a ejecutar la ingesta durante la demo sin tener presente que sobrescribe el stock con los datos del CSV.

## 13. Pruebas: qué garantizan y qué falta

Desde la raíz:

```powershell
npm.cmd --prefix backend run typecheck
npm.cmd --prefix backend test
npm.cmd --prefix frontend run build
npm.cmd --prefix frontend run lint
```

`typecheck` comprueba tipos sin emitir archivos. `build` comprueba el frontend y produce el bundle. `lint` busca problemas detectables por análisis estático. Ninguno demuestra por sí solo que todos los comportamientos de la interfaz funcionen.

La prueba de integración inicia Express en un puerto disponible, crea un producto temporal, consulta health, combina filtros, comprueba resultados vacíos, cambia el stock y lo consulta directamente en PostgreSQL. También prueba entradas inválidas. Cierra el servidor y elimina el producto temporal en finally.

Esta prueba utiliza la base configurada: convendría una base exclusiva de pruebas al automatizar CI. No hay todavía pruebas de navegador, pruebas unitarias de la ingesta ni cobertura exhaustiva de errores o concurrencia. La revisión automática anterior verificó compilación, lint, API y proxy; no hubo un navegador conectado para verificar clics visualmente.

## 14. Preguntas de entrevista y respuestas defendibles

### ¿Por qué no hacer todo en un archivo?

“Separé transporte HTTP, acceso a datos y presentación para ubicar los cambios y probar cada parte con menos dependencias. Intenté mantener pocas capas porque el dominio todavía es pequeño.”

### ¿Por qué validar en frontend y backend?

“El frontend ayuda al usuario, pero puede omitirse. El servidor valida la solicitud real y la base impone restricciones finales.”

### ¿Por qué usar SQL directo y no un ORM?

“Las consultas son pequeñas y explícitas. Puedo controlar filtros, parámetros y RETURNING sin agregar otra abstracción. Un ORM sería una opción si el modelo y las migraciones crecieran.”

### ¿Qué sucede si falla un producto durante la importación?

“Si falla la validación, esa fila se reporta y se excluye. Si falla SQL durante la transacción de los productos válidos, se hace rollback de las escrituras de esa transacción.”

### ¿Qué sucede si dos usuarios cambian el mismo stock?

“Ahora se envía un valor absoluto y la última escritura efectiva prevalece. Para evitar sobrescrituras necesitaría control de versión o una condición de actualización. Para movimientos de inventario modelaría entradas y salidas, con actualizaciones atómicas y las reglas transaccionales correspondientes.”

### ¿Redux y PostgreSQL se pueden desincronizar?

“Sí. Redux contiene una copia de los resultados consultados. El PATCH de esta pantalla actualiza esa copia con la respuesta del servidor, pero no hay suscripciones a cambios de otros usuarios. Podría incorporar refetch, invalidación de caché o notificaciones según el caso.”

### ¿Por qué el stock no cambia antes de recibir la respuesta?

“Elegí esperar confirmación para evitar mostrar un guardado que el servidor rechace. Una actualización optimista requeriría revertir o reconciliar los cambios si falla.”

### ¿Es seguro contra inyección SQL?

“Las consultas actuales separan SQL y valores mediante parámetros. Eso aborda la inyección en estas consultas; no significa que la aplicación tenga resueltos autenticación, permisos y todos los problemas de seguridad.”

### ¿Qué harías con un millón de productos?

“Añadiría paginación y mediría consultas con EXPLAIN ANALYZE. Evaluaría índices para categoría y una estrategia apropiada para búsquedas parciales; un índice B-tree simple no resuelve por sí solo ILIKE con comodín inicial. Para la ingesta evitaría leer todo en memoria y evaluaría streaming, lotes o COPY hacia una tabla intermedia.”

### ¿Qué pasa si se cae la base después del arranque?

“El arranque verifica SELECT 1, pero no garantiza disponibilidad futura. Las consultas posteriores pueden fallar y responder error. El health actual solo dice que Express responde; añadiría readiness que consulte las dependencias si el entorno lo requiere.”

### ¿Qué mejorarías primero?

“Primero cerraría casos de validación y pruebas de los límites de datos; luego añadiría pruebas de interfaz y configuración reproducible de desarrollo. Para uso real priorizaría autenticación, autorización y control de concurrencia según el riesgo del inventario.”

### ¿Qué parte hiciste con ayuda?

Responde con honestidad según tu proceso real. Una respuesta posible: “Usé asistencia para construir y revisar partes de la implementación. Para asegurarme de comprenderla seguí el recorrido de una solicitud, revisé las consultas y ejecuté pruebas. Puedo explicar las decisiones y también sus límites.” No atribuyas trabajo que no hiciste ni memorices una respuesta que no puedas demostrar.

## 15. Limitaciones concretas que conviene conocer

Estas son observaciones sobre el código actual, no cambios ya implementados:

- La ingesta usa `Number('')`, que produce cero. Debería rechazar explícitamente celdas numéricas vacías antes de convertirlas.
- La ingesta comprueba enteros no negativos, pero no el máximo de INTEGER; un valor demasiado grande puede provocar error SQL y rollback del lote válido.
- `as CsvRow[]` no valida los encabezados ni la estructura en ejecución. Faltan comprobaciones explícitas del esquema de entrada.
- La lectura síncrona y el parseo completo del CSV son aceptables para la muestra, pero consumen memoria y bloquean durante ese trabajo. No escalan igual que una ingesta por streaming.
- La lectura del CSV y `pool.connect()` ocurren antes del try de la transacción. Se podría unificar el manejo de errores y cierre de recursos de todo el script con un try/finally exterior.
- No hay paginación ni un límite de resultados en GET.
- El controlador convierte IDs BIGINT a Number; habría que mantenerlos como string para todo el rango de BIGINT.
- Las fechas DATE pueden serializarse como timestamps mediante el driver. Conviene fijar un contrato `YYYY-MM-DD` si se van a mostrar como fechas de calendario.
- Un error de validación contiene detalles en `errors`, pero el cliente HTTP muestra principalmente el mensaje general del servidor.
- La lectura antigua se controla con requestId, pero no hay resolución de conflictos entre varios clientes ni historial de quién cambió el stock.
- No hay manejo explícito de señales para cerrar ordenadamente el servidor y el pool.
- El frontend no necesita los assets de demostración de Vite que quedaron en el proyecto; se pueden limpiar si se prepara una entrega más pulida.

La forma de defender una limitación es explicar su impacto y una mejora proporcional. No hace falta convertir una práctica pequeña en una arquitectura distribuida.

## 16. Git y variables de entorno

`.gitignore` evita que Git proponga archivos no rastreados para agregarlos. No cifra archivos ni elimina secretos que ya estuvieran en commits. Si un archivo ya está rastreado, añadir una regla no lo deja de rastrear automáticamente.

Esta guía y los `.env` reales se mantienen locales. Los `.env.example` quedan permitidos para documentar nombres de variables y valores de desarrollo sin publicar configuración privada.

Puedes verificarlo desde la raíz:

```powershell
git check-ignore GUIA_ENTREVISTA.md backend/.env
git status --short
```

## 17. Repaso final antes de entrar

Debes poder explicar, sin leer:

1. Qué problema resuelve la aplicación.
2. Cómo una fila CSV termina en PostgreSQL.
3. Qué garantiza UNIQUE y cómo lo utiliza el UPSERT.
4. Por qué una transacción necesita una misma conexión.
5. Cómo viaja una búsqueda desde React hasta SQL y de vuelta.
6. Qué hacen Provider, store, dispatch, selector, slice y thunk.
7. Por qué los inputs son locales y los productos viven en Redux.
8. Por qué TypeScript no reemplaza la validación en ejecución.
9. Cómo se confirma y persiste un cambio de stock.
10. Qué verifican las pruebas, qué limitaciones existen y qué mejorarías primero.

Si te atascas, sigue un caso concreto: “El usuario pulsa Guardar; este handler despacha este thunk; este cliente llama a esta ruta; este controlador ejecuta este repositorio; la base devuelve el producto y Redux actualiza la tabla”. Poder mostrar ese recorrido vale más que enumerar herramientas.
