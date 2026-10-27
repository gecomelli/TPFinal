# Elecciones

Aplicacion de votacion hecha con Node.js, Express, Handlebars y MongoDB.

## Configuracion

La aplicacion usa una unica base de datos MongoDB, `encuestasDB`, indicada por `MONGO_URI`:

- `encuestas`: titulo, descripcion, candidatos (incluidas foto, descripcion y votos), fecha/hora de inicio y finalizacion, estado y fechas de auditoria. Las imagenes cargadas desde el panel se guardan como datos binarios dentro del documento de encuesta.
- `usuarios`: DNI, nombre, apellido, fecha de creacion, origen externo (`isExternal`) y los identificadores de las encuestas en las que participo.

Desde esta carpeta, instalar las dependencias y configurae la URI de conexion y la clave privada de la API:

```env
MONGO_URI=mongodb://localhost:27017/encuestasDB
MONGO_URI="mongodb+srv://gecomelli_db_user:Ln97OhQR6rLzcA9F@encuestasdb.3n6pym5.mongodb.net"
PORT=3000
ADMIN_PASSWORD=Admin123 
EXTERNAL_API_KEY=AIzaSyA0g1k6r5J7x8y9z0a1b2c3d4e5f6g7h8i
API_CORS_ORIGINS=https://sitio-consumidor.example
```

Para desarrollo, puedes generar una clave con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. No uses una clave real de producción en la página Cliente.


```sh
npm install
npm start
```

## API para integraciones externas

La API versionada permite consultar las encuestas abiertas y registrar votos:

- `GET /api/v1/encuestas`: lista las encuestas abiertas dentro de su período de votación.
- `GET /api/v1/encuestas/:electionId`: consulta una encuesta activa y sus candidaturas.
- `POST /api/v1/encuestas/:electionId/votos`: registra un voto. Requiere el encabezado `X-API-Key`.

Configura una clave privada `EXTERNAL_API_KEY` en el `.env` del servidor y, si el sitio consumidor está en otro origen, autoriza su origen en `API_CORS_ORIGINS` (separando varios orígenes con comas). La clave no debe incluirse en el JavaScript ni en el HTML de un sitio público: el servidor del sitio consumidor debe llamar a este endpoint. CORS restringe qué páginas web pueden leer las respuestas desde un navegador, pero no sustituye la autenticación.

El cuerpo del voto debe incluir todos los datos del votante, incluso si ya está registrado. Si el DNI no existe, se crea el registro con `isExternal: true`; si ya existe, sus datos y el indicador se conservan. El DNI solo puede votar una vez por encuesta. Ejemplo:

```json
{
  "candidateId": "507f1f77bcf86cd799439011",
  "voter": {
    "dni": "12345678",
    "fullName": "Ana Perez",
    "sex": "F",
    "age": 30,
    "email": "ana@example.com",
    "educationLevel": "Secundario"
  }
}
```

La página de prueba está en `Cliente` y se sirve desde `http://localhost:3000/cliente/` al iniciar el servidor. Permite ingresar manualmente la clave para probar; no la almacena. Úsala solo con una clave de desarrollo, no con credenciales de producción. El endpoint valida los datos recibidos, pero la clave API autentica al sistema integrador, no verifica por sí sola la identidad del votante.

## Panel de administracion

Abre `http://localhost:3000/admin/` para crear, editar y borrar encuestas y candidaturas. La interfaz, sus recursos y las operaciones administrativas estan dentro de `Server`. Configura `ADMIN_PASSWORD` en el archivo `.env` del servidor antes de iniciar la aplicacion. El panel usa una cookie de sesion HttpOnly y requiere la clave para acceder a las operaciones de administracion.

Todas las encuestas en estado `open` cuyas fechas incluyan el momento actual aparecen en la portada y permiten votar. Las encuestas en estado `finalized` aparecen en estadisticas, pero no permiten votar. `scheduled` y `closed` no aparecen en las paginas publicas. Las candidaturas con votos no pueden quitarse al editar, y borrar una encuesta requiere confirmacion porque elimina sus resultados.

El comando informa el identificador de la eleccion. Una eleccion solo acepta votos cuando `status` es `open` y la fecha actual esta entre `startsAt` y `endsAt`. Los estados posibles son `scheduled`, `open`, `closed` y `finalized`.

Un documento de eleccion tiene este formato:

```json
{
  "title": "Eleccion del centro de estudiantes",
  "description": "Elegimos la nueva representacion estudiantil.",
  "startsAt": { "$date": "2026-10-12T12:00:00.000Z" },
  "endsAt": { "$date": "2026-10-19T22:00:00.000Z" },
  "status": "open",
  "candidates": [
    {
      "name": "Lista Verde",
      "description": "Una descripcion breve",
      "image": "/images/candidates/default.svg",
      "votes": 0
    }
  ]
}
```

Desde el panel de administracion puedes cargar imagenes JPEG, PNG, GIF o WebP de hasta 2 MB por candidatura; el total de imagenes cargadas en una encuesta no puede superar 8 MB. Tambien puedes seguir usando rutas de `public/images/candidates` o URLs HTTPS en el campo `image`. Cada encuesta, sus candidaturas, votos e imagenes se mantienen en un unico documento dentro de `encuestas`.

## Identificacion y voto

La pagina de votacion solicita primero el DNI. Si el DNI existe en `usuarios`, completa nombre y apellido y avisa si ya participo en esa encuesta. Si no existe, solicita nombre y apellido, crea el usuario y luego habilita continuar a la seleccion de candidato. Un mismo usuario solo puede participar una vez en cada encuesta.

El DNI se guarda en claro en `encuestasDB.usuarios`, de acuerdo con el modelo solicitado. Restringe el acceso a esa base de datos y no publiques sus datos.

## Datos preexistentes

La aplicacion no modifica ni borra las colecciones antiguas. Las elecciones, candidatos y votos previos almacenados en otras bases o colecciones no se copian automaticamente; deben cargarse en el nuevo formato. Los usuarios antiguos que solo tengan un hash de DNI no pueden convertirse al nuevo formato, porque el DNI original no se puede recuperar: vuelve a importarlos desde un padron autorizado.

## Pruebas

```sh
npm test
```
