# ADR-005 · Propiedad gradual de los datos por dominio

| Campo | Valor |
|---|---|
| Estado | **Propuesto**, en discusión |
| Tipo | Decisión futura |
| Fecha de documentación | 2026-10-12 |
| Aprobación | Sin aprobación documentada |

## Contexto

Separar el código en servicios no basta si todos siguen leyendo las mismas tablas: el acoplamiento se mantiene, solo que oculto en la base de datos. Hoy:

- Todos los módulos con PostgreSQL comparten una base y una credencial ([database.ts](../../apps/api/src/config/database.ts)).
- La tabla `users` la escriben dos módulos y la leen tres más con `JOIN`.
- Hay claves foráneas entre dominios y dos disparadores que modifican tablas de otro dominio.

El detalle está en [Datos y propiedad por dominio](../02-arquitectura-de-software/06-datos-y-propiedad-por-dominio.md).

Separar físicamente las bases desde el principio rompería transacciones y restricciones que hoy protegen la integridad, y exigiría más recursos de plataforma.

## Decisión propuesta

Establecer la propiedad de los datos **de forma gradual, en cuatro niveles**, y subir de nivel solo cuando el anterior esté validado:

| Nivel | Qué significa | Cómo se hace cumplir |
|---|---|---|
| 0. Compartido | Estado actual: cualquiera lee y escribe cualquier tabla | Nada |
| 1. Propiedad declarada | Cada tabla tiene un dueño documentado; solo el dueño escribe | Revisión de código |
| 2. Propiedad con permisos | Cada servicio usa un usuario de base de datos limitado a sus tablas, dentro de la misma instancia | Permisos de PostgreSQL |
| 3. Sin dependencias cruzadas | Se eliminan los `JOIN` y las claves foráneas entre dominios; los datos ajenos se obtienen por contrato o por copia | Esquema y pruebas |
| 4. Separación física | Bases o instancias distintas | Infraestructura |

Reglas:

- El nivel 4 **no es un objetivo obligatorio**. Se alcanza solo si hay un motivo demostrado.
- Los datos que deben cambiar juntos en una transacción pertenecen al mismo dueño.
- Los disparadores que cruzan dominios se sustituyen por lógica en el servicio dueño.

## Alternativas

| Alternativa | Ventaja | Por qué no se propone |
|---|---|---|
| Una base por servicio desde el primer día | Aislamiento completo e inmediato | Rompe de golpe transacciones y claves foráneas; más recursos y más operación |
| Base compartida de forma permanente | Sin trabajo adicional | Los servicios seguirían acoplados por los datos; la separación sería solo aparente |
| Esquemas de PostgreSQL por servicio sin restringir permisos | Orden visual | No impide el acceso cruzado |
| Replicar todos los datos entre servicios mediante eventos | Autonomía total de lectura | Complejidad y consistencia eventual injustificadas para este tamaño |

## Justificación

- Permite obtener la mayor parte del beneficio, que son los límites claros, en los niveles 1 a 3 sin costo de infraestructura.
- Cada nivel es reversible con poco esfuerzo; el nivel 4 es el único costoso de deshacer.
- Respeta la restricción de un solo operador y de plataformas de bajo costo.
- Mantiene las garantías transaccionales mientras se decide qué datos van juntos.

## Consecuencias

**Positivas esperadas**

- Límites de datos explícitos y verificables antes de cualquier separación física.
- Los errores de acceso cruzado aparecen como errores de permisos, no como fallos silenciosos.
- La separación física, si llega, es una operación de infraestructura y no de rediseño.

**Costos esperados**

- Sustituir cada `JOIN` hacia `users` exige una consulta adicional o una copia local que mantener.
- Al eliminar claves foráneas entre dominios, la integridad referencial pasa a depender del código.
- El borrado en cascada de los datos de un usuario deja de ser automático y requiere un mecanismo explícito.
- Gestionar varios usuarios de base de datos y sus permisos.

## Casos que la decisión debe resolver

| Caso | Situación actual | Tratamiento propuesto |
|---|---|---|
| Saldo de créditos | Columna en `users`, modificada por un disparador de descargas | Mover el saldo al dominio de Recursos |
| Datos de contacto en la confirmación de carpooling | Leídos dentro de la transacción | Confirmar primero y pedir el contacto a Identidad después, o mantener Movilidad junto a Identidad hasta resolverlo |
| Nombre y rol del autor de una publicación | `JOIN` con `users` | Copia local en Comunidad o consulta por contrato |
| Ocultamiento automático de publicaciones | Disparador sobre `moderation_reports` que modifica `feed_posts` | Queda dentro de un mismo dueño si moderación y feed pertenecen a Comunidad |
| Catálogos | Referenciados por clave foránea desde varios dominios | Datos de referencia de solo lectura; los demás guardan el identificador sin restricción |

## Evidencias

| Aspecto | Archivo |
|---|---|
| Lecturas de `users` desde otros módulos | [feed.repository.ts](../../apps/api/src/modules/feed/feed.repository.ts), [matchmaking.repository.ts](../../apps/api/src/modules/matchmaking/matchmaking.repository.ts), [carpooling.repository.ts](../../apps/api/src/modules/carpooling/carpooling.repository.ts) |
| Disparadores entre dominios | [003_credits_and_wiki.sql](../../apps/api/src/database/migrations/sql/003_credits_and_wiki.sql), [004_moderation_and_carpooling.sql](../../apps/api/src/database/migrations/sql/004_moderation_and_carpooling.sql) |
| Credencial única | [database.ts](../../apps/api/src/config/database.ts) |

Ningún nivel superior al 0 está implementado.

## Condiciones para reconsiderarla

- Que un dominio necesite un motor de datos distinto o un volumen que justifique su propia instancia: adelantaría el nivel 4 para ese dominio.
- Que la plataforma de base de datos no permita varios usuarios con permisos diferenciados: obligaría a replantear el nivel 2.
- Que mantener copias locales resulte más costoso que las consultas por contrato, o al revés.

[← Índice de ADR](README.md) · [← Índice](../README.md)
