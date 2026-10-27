# AGENTS.md

Este archivo contiene el contexto relevante del proyecto y debe leerse antes de modificar la app.

## Contexto real del repositorio

El proyecto es una aplicación web de catálogo de TV shows / series con:

- Node.js + Express en `server/`
- Adaptadores de acceso a datos para MongoDB/Mongoose, MySQL y PostgreSQL
- Handlebars para páginas HTML
- JWT para autenticación
- API REST protegida
- Cliente estático simple en `client/`

La guía canónica y actualizada está en la raíz del proyecto en [AGENTS.md](AGENTS.md). Este archivo sirve como referencia local del backend dentro del servidor.

## Estructura importante

- `server/app.js`: configuración principal de Express y vistas.
- `server/routes/index.js`: rutas de la app web.
- `server/routes/users.js`: login y registro.
- `server/controllers/`: lógica de negocio.
- `server/models/`: esquemas Mongoose usados por el adaptador MongoDB.
- `server/database/`: interfaz genérica, selección de motor y adaptadores concretos.
- `server/middleware/authMiddleware.js`: validación JWT.
- `server/views/`: templates Handlebars.
- `client/`: cliente estático que consume la API.

## Flujos a mantener

- El acceso a rutas protegidas requiere token válido.
- Las rutas web y la API deben responder de forma consistente con errores HTTP.
- El login genera una cookie `authToken` y usa JWT.
- MongoDB es el motor predeterminado (`DATABASE_CLIENT=mongodb`); MySQL y PostgreSQL se seleccionan mediante `DATABASE_CLIENT`.
- Los adaptadores SQL crean las tablas al iniciar si no existen. Cambiar de motor no migra los datos existentes.

## Reglas prácticas

- Mantener modelos, rutas y controladores sincronizados.
- Usar `async/await` y manejo de errores con `try/catch`.
- No sacar secretos al repositorio.
- No romper la compatibilidad con Handlebars ni omitir la interfaz común de base de datos.
- Al cambiar campos de `TvShow` o `User`, revisar todos los usos asociados.
- Si se modifica la API, revisar también los endpoints web que dependen de la misma lógica.

## Nota

El archivo principal del proyecto es [AGENTS.md](AGENTS.md). Leerlo primero es la referencia básica antes de realizar cambios.