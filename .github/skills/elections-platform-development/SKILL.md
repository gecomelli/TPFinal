---
name: elections-platform-development
description: "Desarrolla y mantiene esta plataforma de elecciones y encuestas con criterio de ingeniería senior. Usar al modificar votos, votantes, estadísticas, administración, MongoDB o la API REST/CORS para sitios externos; también al planificar registro de votantes y encuestas creadas por usuarios."
argument-hint: "Describe el cambio de la plataforma de encuestas que necesitás"
---

# Desarrollo de la plataforma de elecciones y encuestas

Actúa como un programador senior responsable de mantener la aplicación existente y evolucionarla de forma segura, coherente y verificable. Implementa el cambio solicitado; no te limites a proponerlo. Conserva los flujos actuales, evita cambios ajenos al pedido y valida el resultado.

## Alcance y contexto confirmado

Este workspace contiene una aplicación de elecciones y encuestas. La implementación actual está en `Server/` y el cliente de prueba de integraciones en `Cliente/`.

- **Tecnologías actuales:** Node.js, Express, Handlebars, MongoDB y Mongoose. Las vistas renderizadas por el servidor y los recursos estáticos se sirven desde Express.
- **Persistencia:** los modelos `Election` y `Voter` seleccionan la base `encuestasDB`. La colección `encuestas` almacena elecciones, candidaturas y contadores de votos; `usuarios` almacena votantes y su historial de participación.
- **Elecciones:** tienen título, descripción, candidaturas, período y estados `scheduled`, `open`, `closed` y `finalized`. La votación valida que la elección esté abierta y dentro de las fechas.
- **Votantes:** actualmente `usuarios` almacena DNI y datos personales/demográficos. `electionsParticipated` impide que un mismo votante vuelva a votar en una elección.
- **Voto actual:** la aplicación incrementa `candidates[].votes` en el documento de la elección. No existe actualmente un registro individual de cada voto ni estadísticas demográficas derivadas de votos persistidos.
- **Web:** las rutas de `Server/routes/index.js` sirven las páginas, el flujo de identificación y selección de candidatura y las estadísticas generales. `Server/routes/admin.js` implementa la administración de elecciones/candidaturas y autenticación administrativa mediante cookie.
- **API externa existente:** `Server/routes/api.js` expone `GET /api/v1/encuestas`, `GET /api/v1/encuestas/:electionId` y `POST /api/v1/encuestas/:electionId/votos`. La API permite consultar elecciones activas y registrar votos; el POST usa `X-API-Key` y CORS configurable por `API_CORS_ORIGINS`. `Cliente/` es un cliente estático de prueba; no debe contener secretos de producción.
- **Pruebas:** los tests están bajo `Server/test/` y el comando configurado es `npm test` desde `Server/`.

Confirma estos datos en los archivos actuales antes de cada cambio: la implementación es la fuente de verdad; `Server/README.md` documenta el uso, pero puede quedar desactualizado. `Server/agents.md` contiene contexto de otra aplicación y no debe usarse como descripción de la plataforma sin verificarlo. No leas ni expongas valores de `Server/.env`; trata credenciales, padrones y `Server/data/` como datos sensibles/locales.

## Forma de trabajar

1. Revisa primero las rutas, modelos, vistas, utilidades y tests relacionados con el pedido. Identifica los flujos web y API que comparten esa lógica.
2. Distingue claramente entre comportamiento existente, cambio pedido y capacidades futuras. No presentes como implementado un registro individual de votos, una API de estadísticas o cuentas de votantes si todavía no existen.
3. Antes de editar, define las invariantes del flujo (por ejemplo, elegibilidad, período de votación, una participación por elección, privacidad y disponibilidad de la API externa).
4. Sigue los patrones locales de CommonJS, Express, Mongoose, Handlebars, validación y manejo de errores. Mantén modelos, rutas, vistas, cliente de prueba y documentación sincronizados cuando el cambio los afecte.
5. Valida en el servidor aunque también haya validación en el navegador. Usa consultas acotadas, índices adecuados y actualizaciones atómicas. No confíes en datos, roles, IDs ni permisos enviados por el cliente.
6. Agrega o actualiza tests para los casos válidos, inválidos, límites, autorización, conflictos y regresiones. Ejecuta las pruebas focalizadas y, cuando corresponda, `npm test`.
7. Actualiza `Server/README.md` cuando cambien contratos, configuración, seguridad o flujos visibles. Informa los archivos modificados, decisiones relevantes y validaciones ejecutadas.

## API obligatoria para nuevas funciones

Toda nueva capacidad de negocio debe diseñarse e implementarse contemplando su contrato de API para integrarse con páginas o sistemas externos; no la des por terminada si solo funciona en una vista o en `Cliente/`. Implementa el endpoint correspondiente en la misma entrega, salvo que una restricción de seguridad o una decisión de producto justificada lo impida. En ese caso, explica la limitación y acuerda qué queda pendiente antes de cerrar el cambio.

Para cada endpoint nuevo o modificado:

- Reutiliza el prefijo versionado `/api/v1` y los patrones de `Server/routes/api.js`, salvo que exista una razón explícita para cambiar el contrato.
- Define método, ruta, esquema de entrada/salida, códigos HTTP, errores, permisos y ejemplos en `Server/README.md`.
- Valida tipos, longitudes, enumeraciones e identificadores en el servidor; limita cuerpos y resultados. No expongas DNI, credenciales, datos internos ni campos de Mongoose por serializar documentos completos.
- Aplica autenticación y autorización acordes al caso. La clave actual identifica al sistema integrador, no verifica por sí sola la identidad de la persona votante.
- Mantén `API_CORS_ORIGINS` como lista explícita de orígenes permitidos. CORS no reemplaza autenticación ni autorización.
- Nunca incrustes `EXTERNAL_API_KEY`, secretos, credenciales de administrador o tokens privilegiados en HTML o JavaScript público. Las páginas externas deben llamar a la API desde un backend seguro cuando necesiten secretos.
- Revisa compatibilidad hacia atrás y versiona cambios incompatibles. Añade pruebas de contrato y autorización para cada superficie nueva.
- Si una funcionalidad aún no está lista para uso externo, explica el motivo y define el endpoint o contrato pendiente; no simules disponibilidad.

## Requisito futuro: votos persistidos sin DNI

Cuando se implemente la base de votos para estadísticas demográficas, la selección individual **no debe guardar ni poder resolverse a partir del DNI**. Diseña la separación desde el modelo de datos, no solo ocultando campos en una respuesta:

- Mantén el control de elegibilidad/participación separado del registro de la opción elegida. El control de participación puede conservar la relación necesaria entre identidad verificada y elección, pero nunca el candidato seleccionado.
- Guarda cada voto en un registro o estructura de papeleta separada de `usuarios`, con referencias a la elección y candidatura y únicamente los atributos demográficos estrictamente necesarios para las estadísticas.
- No incluyas en el voto DNI, nombre, apellido, email, `voterId`/`userId`, un hash estable del DNI, ni otro identificador que permita volver a enlazarlo con la persona. Evita que logs, eventos, respuestas de API o trazas creen ese vínculo.
- Si se requiere estadística por edad, sexo o educación, utiliza una instantánea minimizada/categorizada de esos atributos en el voto, no los datos de contacto ni un enlace al documento del votante. Confirma los campos necesarios; no agregues datos demográficos por conveniencia.
- No afirmes anonimato absoluto si las colecciones, timestamps, registros operativos o tamaños de grupo permiten correlacionar identidad y elección. Minimiza esos metadatos, restringe accesos y considera umbrales de publicación para evitar identificar personas en grupos pequeños.
- Evita almacenar una relación directa entre papeleta y registro de votante incluso si se la llama seudónimo. Una clave estable o reversible sigue siendo un enlace.
- Garantiza un solo voto por persona y elección con una operación atómica o una restricción de unicidad adecuada, sin asociar esa protección con el candidato. Diseña consistencia/recuperación entre el registro de participación y el voto: usa transacciones solo cuando la topología de MongoDB las soporte y contempla los fallos parciales y reintentos de forma explícita.
- Actualiza las estadísticas para derivarlas de los votos persistidos y define denominadores, categorías y tratamiento de votos nulos/ausentes. No mezcles datos de elecciones distintas ni expongas papeletas individuales en endpoints públicos.
- Protege acceso, retención, exportación y borrado de datos. Documenta qué se almacena y para qué, y confirma requisitos regulatorios aplicables antes de afirmar cumplimiento legal.

Mientras no se implemente este cambio, la fuente de los resultados sigue siendo `candidates[].votes`; no agregues referencias a papeletas que no existen.

## Evolución futura: cuentas y encuestas propias

Cuando se solicite permitir que votantes se registren y creen sus propias encuestas, trata el registro de cuenta y el padrón/identidad de votación como conceptos diferentes. No reutilices automáticamente DNI como nombre de usuario ni como clave pública.

- Define autenticación segura, verificación de cuenta, recuperación de acceso, sesiones/tokens y límites contra abuso antes de publicar encuestas.
- Modela la autoría de una encuesta explícitamente y verifica en el servidor que cada acción de lectura/modificación/borrado esté autorizada para su propietario o rol. No uses un `ownerId` enviado por el cliente como prueba de propiedad.
- Conserva estados y fechas de publicación/votación; separa borradores, revisión, publicación, cierre y resultados según los requisitos acordados. No permitas que crear una encuesta otorgue automáticamente permisos de administración global.
- Define quién puede votar, cómo se controla la participación única, qué datos se recogen y qué estadísticas se publican. El propietario no debe obtener una relación identidad-opción.
- Diseña cuotas, límites, moderación y auditoría proporcionales al alcance acordado; aplica índices y paginación para listados públicos.
- Expón mediante la API los endpoints que correspondan a registro, creación y gestión de encuestas, con autenticación y permisos de propietario. Documenta el contrato para clientes externos sin divulgar tokens.
- Mantén separadas las responsabilidades: administración global actual, futuras cuentas de usuario/propietario y votantes. Migra datos de manera explícita y compatible; no cambies el esquema o la semántica de la API por anticipado sin una necesidad implementada.

## Seguridad y calidad

- Usa configuración externa para secretos y conexiones; no registres DNI, email, tokens, claves API ni cuerpos completos de votos.
- Restringe CORS a orígenes requeridos. Comprueba autenticación, permisos, estado/fechas de elección y pertenencia de candidatura en el servidor.
- Responde con errores claros y códigos HTTP correctos; no devuelvas éxito ante fallos de base de datos ni captures errores de forma silenciosa.
- No uses el DNI en URLs, logs o telemetría. Devuelve solo los datos mínimos para completar cada flujo.
- Considera concurrencia, votos repetidos, cierre de elección durante una solicitud, errores de base de datos y reintentos externos.
- No cambies tecnologías, contratos o requisitos de privacidad sin justificarlo y, si falta una decisión de producto que altere el modelo, pide confirmación antes de asumirla.
