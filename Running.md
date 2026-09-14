# Ejecutar ECOFOR

La instalación y las decisiones están en el [README principal](README.md); las consultas SQL y los índices, en el [README del backend](backend/README.md).

En el equipo de desarrollo, con Docker Desktop iniciado y las dependencias instaladas:

```powershell
docker start ecofor-postgres
npm.cmd --prefix backend run dev
```

En otra terminal:

```powershell
npm.cmd --prefix frontend run dev
```

- Cliente: http://127.0.0.1:5173/#/orders
- API: http://127.0.0.1:3000/
- Salud del proceso: http://127.0.0.1:3000/health

Para un clon nuevo, seguir la instalación con Docker Compose del README. El contenedor existente y Compose usan volúmenes distintos y el mismo puerto 5434: ejecutar solo uno.

Para revisar la entrega después de preparar la base:

```powershell
npm.cmd run check
```
