# Patrones de diseño

Solo se listan patrones que pueden señalarse en un archivo concreto. No se atribuyen patrones por parecido de nombres: donde el código se aparta de la definición habitual, se indica.

## Patrones presentes

### Repositorio

**Qué es:** un objeto que oculta cómo se guardan y recuperan los datos, de modo que el resto del código pida «la publicación con este identificador» y no escriba SQL.

**Dónde:** una clase por módulo, por ejemplo [feed.repository.ts](../../src/modules/feed/feed.repository.ts) y [auth.repository.ts](../../src/modules/auth/auth.repository.ts).

**Matiz:** es la versión concreta del patrón. No hay una interfaz de repositorio de la que el servicio dependa, así que el almacén no puede sustituirse sin cambiar el servicio. Además, algunos repositorios contienen decisiones de negocio ([matchmaking.repository.ts](../../src/modules/matchmaking/matchmaking.repository.ts)).

### Capa de servicio

**Qué es:** una capa que reúne las reglas de negocio de un caso de uso y coordina los repositorios.

**Dónde:** [auth.service.ts](../../src/modules/auth/auth.service.ts), [feed.service.ts](../../src/modules/feed/feed.service.ts), [carpooling.service.ts](../../src/modules/carpooling/carpooling.service.ts).

**Matiz:** en `users` y parte de `radar` el servicio solo reenvía la llamada al repositorio.

### Cadena de responsabilidad (middlewares)

**Qué es:** una solicitud atraviesa una serie de manejadores; cada uno la procesa, la pasa al siguiente o la corta.

**Dónde:** la cadena de Express en [app.ts](../../src/app.ts) y `requireAuth` delante de cada ruta protegida, por ejemplo en [radar.routes.ts](../../src/modules/radar/radar.routes.ts). Es un patrón que aporta el propio marco de trabajo.

### Manejador de errores centralizado con error tipado

**Qué es:** el código de negocio lanza un error con significado y un único punto lo convierte en respuesta.

**Dónde:** [AppError.ts](../../src/shared/errors/AppError.ts) lleva mensaje, estado HTTP y código; [error.middleware.ts](../../src/middlewares/error.middleware.ts) distingue `AppError`, errores de validación de Zod y cualquier otro error, que responde como 500 sin exponer detalles.

**Matiz:** varios controladores construyen respuestas de error por su cuenta en lugar de lanzar `AppError`, de modo que la centralización es parcial.

### Objeto único de módulo para conexiones

**Qué es:** una sola instancia compartida de un recurso costoso.

**Dónde:** `pool` en [database.ts](../../src/config/database.ts) y `redis` en [redis.ts](../../src/config/redis.ts).

**Matiz:** no es la forma clásica del patrón *Singleton* (clase con constructor privado). Es una instancia exportada por un módulo, que Node.js evalúa una sola vez. El efecto es el mismo: estado global compartido.

### Validación por esquema

**Qué es:** describir la forma válida de los datos de entrada de manera declarativa y validar contra esa descripción.

**Dónde:** esquemas Zod en [auth.validators.ts](../../src/modules/auth/auth.validators.ts) y dentro de [matchmaking.controller.ts](../../src/modules/matchmaking/matchmaking.controller.ts).

**Matiz:** `feed`, `radar` y `carpooling` validan con condiciones escritas a mano.

### Script de transacción

**Qué es:** un procedimiento que realiza un caso de uso completo, de principio a fin, dentro de una transacción.

**Dónde:** `confirmBookingTransaction` y `createRequestTransaction` en [carpooling.repository.ts](../../src/modules/carpooling/carpooling.repository.ts); `submitInteraction` en [matchmaking.repository.ts](../../src/modules/matchmaking/matchmaking.repository.ts).

### Bloqueo pesimista

**Qué es:** bloquear los datos antes de modificarlos para que otra operación simultánea espere.

**Dónde:** `SELECT ... FOR UPDATE` sobre la ruta y la solicitud en `confirmBookingTransaction` ([carpooling.repository.ts](../../src/modules/carpooling/carpooling.repository.ts)); también en el disparador de descargas ([003_credits_and_wiki.sql](../../src/database/migrations/sql/003_credits_and_wiki.sql)).

**Matiz:** la solicitud de asiento (`createRequestTransaction`) no bloquea la ruta; su protección contra duplicados es el índice único.

### Operación atómica en el almacén (script Lua)

**Qué es:** enviar al almacén varias operaciones para que las ejecute como una sola, sin que otra operación se intercale.

**Dónde:** el script de votación en [radar.repository.ts](../../src/modules/radar/radar.repository.ts): comprueba si el usuario ya votó, registra el voto, cuenta y, si alcanza el umbral, actualiza el estado y borra los contadores.

### Quórum o consenso por umbral

**Qué es:** aceptar un dato solo cuando un número mínimo de fuentes independientes coincide.

**Dónde:** el radar exige 3 votos de usuarios distintos ([radar.repository.ts](../../src/modules/radar/radar.repository.ts)); el disparador de moderación exige 3 reportes por el mismo motivo ([004_moderation_and_carpooling.sql](../../src/database/migrations/sql/004_moderation_and_carpooling.sql)). El segundo no está en uso porque no hay API de moderación.

### Migraciones versionadas con registro

**Qué es:** cambios de esquema numerados, aplicados en orden y anotados en una tabla para no repetirlos.

**Dónde:** [migrator.ts](../../src/database/migrations/migrator.ts) con la tabla `schema_migrations`, una transacción por migración, una validación de la estructura resultante antes de registrarla y bloqueo consultivo para impedir dos ejecuciones simultáneas.

**Matiz:** se guarda la suma de verificación SHA-256 de cada archivo, pero no se compara después; una migración ya aplicada se omite aunque su archivo haya cambiado.

### Interceptor (frontend)

**Qué es:** código que se ejecuta antes o después de cada solicitud HTTP sin que quien la hace lo sepa.

**Dónde:** [api.ts](../../app/lib/api.ts) añade el token a cada solicitud y, ante un 401, cierra la sesión.

### Guarda de ruta (frontend)

**Qué es:** un componente que envuelve las pantallas y decide si pueden mostrarse.

**Dónde:** [RouteGuard.tsx](../../components/ui/RouteGuard.tsx) muestra el aviso de términos mientras no se acepten.

**Matiz:** es una guarda de experiencia de usuario, no de seguridad: se basa en `localStorage`.

## Patrones que no están

Para evitar atribuciones incorrectas:

| Patrón | Por qué no está |
|---|---|
| Inyección de dependencias | Las dependencias se crean con `new` dentro de cada clase |
| Puertos y adaptadores | No hay interfaces de comportamiento |
| Fábrica, estrategia, observador, decorador | No se encontró ninguna implementación identificable |
| Eventos o publicación y suscripción | No hay ningún mecanismo de mensajería |
| DTO como clases propias | Los datos viajan como objetos literales e interfaces de TypeScript |
| CQRS, *event sourcing*, saga | No aplican al código actual |
| Caché | Redis no se usa como caché |

## Patrones propuestos

> **Estado: Propuesto.**

| Patrón | Para qué | Etapa |
|---|---|---|
| Puertos y adaptadores con inyección por constructor | Aislar el negocio de la infraestructura | Al extraer cada servicio |
| Strangler Fig | Reemplazo gradual del monolito | 3 en adelante |
| Puerta de enlace de API | Entrada única y reversible | 3 |
| Estrategia por configuración para los puntos del radar | Añadir puntos sin modificar el algoritmo | 4 |
| *Outbox* transaccional | Publicar eventos sin perderlos si falla el envío | 7 |
| Consumidor idempotente | Tolerar eventos repetidos | 7 |

[← Índice](../README.md)
