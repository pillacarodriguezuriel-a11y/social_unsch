# Estilo arquitectónico

La configuración local de Radar permite ejecutar las funciones del campus en una API modular. El repositorio también incluye el servicio independiente que habilita la transición descrita en esta página.

## Cinco preguntas distintas

| Pregunta | Categoría | Respuesta hoy | Respuesta propuesta |
|---|---|---|---|
| ¿En cuántas unidades se despliega la lógica de servidor? | Estilo arquitectónico | Una en operación: monolito modular. Radar con código propio sin desplegar | Varios servicios por dominio |
| ¿Cómo se ordena el código dentro de una unidad? | Enfoque de organización interna | Capas; Radar con un puerto e inyección | Hexagonal en cada servicio |
| ¿Qué soluciones recurrentes aparecen en el código? | Patrones de diseño | Repositorio, middleware, error tipado, script atómico, composición explícita | Puertos y adaptadores generalizados |
| ¿Cómo se guarda el código en Git? | Organización del repositorio | Monorepo con npm workspaces | Sin cambios |
| ¿Dónde se ejecuta? | Plataforma de despliegue | Vercel, Render y servicios de datos gestionados | Las mismas, con más servicios |

Cada fila puede cambiar sin que cambien las demás. Un monolito puede ser hexagonal; un conjunto de microservicios puede vivir en un monorepo; cambiar de plataforma no cambia el estilo.

## Estilo actual: monolito modular

Un **monolito** es un sistema cuya lógica de servidor se compila y despliega como una sola unidad. Es **modular** cuando su código está dividido en partes con responsabilidades separadas y dependencias controladas.

Evidencia de que es un monolito:

- Un solo punto de arranque, [server.ts](../../apps/api/src/server.ts), y una sola aplicación Express, [app.ts](../../apps/api/src/app.ts), que registra todos los enrutadores.
- Un solo comando de compilación y uno de arranque en [package.json](../../package.json).
- Un solo pool de PostgreSQL y un solo cliente Redis compartidos ([database.ts](../../apps/api/src/config/database.ts), [redis.ts](../../apps/api/src/config/redis.ts)).

Evidencia de que es modular:

- Un directorio por dominio en [src/modules](../../apps/api/src/modules).
- Ningún módulo importa código de otro módulo. Los módulos solo comparten `config`, `middlewares` y `shared`.

Límite de esa modularidad: los módulos están separados en el código, pero no en los datos. Varios leen las mismas tablas. Ver [Componentes y dependencias](componentes-arquitectonicos.md).

Matiz importante: **el monolito ya no es la única unidad desplegable del repositorio.** `apps/radar` y `apps/feed` se compilan y arrancan por separado, aunque hoy no estén desplegados y la API siga atendiendo ambos dominios en proceso. El estilo efectivo en producción sigue siendo monolito modular; el estilo disponible en el código es monolito modular **más dos servicios activables por configuración**.

El detalle de las capas y los puertos de Radar y Feed está en el [enfoque arquitectónico](enfoque-arquitectonico.md).

## Estilo propuesto: servicios por dominio

Un **servicio por dominio** es una unidad desplegable que es dueña de una parte del negocio y de sus datos. La propuesta agrupa los módulos actuales en pocos servicios en lugar de uno por módulo, por la restricción de un solo operador.

| Servicio propuesto | Módulos actuales que absorbería |
|---|---|
| Servicio propuesto | Módulos actuales que absorbería | Estado real |
|---|---|---|
| Identidad | `auth`, `users`, `catalogs` | PROPUESTO: sigue en la API |
| Radar | `radar` | `apps/radar` IMPLEMENTADO, **sin desplegar** |
| Comunidad | `feed`, `matchmaking` y la moderación futura | **Solo Feed extraído** (`apps/feed`), sin desplegar; `matchmaking` y moderación siguen en la API |
| Movilidad | `carpooling` | **NO EJECUTADO**, fuera del alcance acordado ([ADR-011](../06-decisiones-arquitectonicas/ADR-011-cierre-de-la-migracion-y-alcance-final.md)) |
| Recursos | Banco de archivos y créditos (hoy sin módulo) | **NO EJECUTADO**, fuera del alcance acordado |

Detalle en [Arquitectura objetivo](05-arquitectura-objetivo.md). El alcance se cerró en dos dominios extraídos: Radar y Feed. Extraer Identidad, Movilidad o Recursos exige una decisión nueva.

## Estrategia de transición: Strangler Fig

**Strangler Fig** (higuera estranguladora) es una estrategia para reemplazar un sistema por partes: se coloca una entrada delante del sistema existente, se construye cada pieza nueva al lado y se redirige hacia ella una ruta cada vez, hasta que la pieza antigua deja de recibir tráfico y puede retirarse.

Es una estrategia de migración, no un estilo: describe el camino, no el destino. Aquí, la API decide con `RADAR_MODE` si `/api/v1/radar` se atiende en proceso o en el servicio nuevo, y con `FEED_MODE` lo mismo para `/api/v1/feed`. Ambas decisiones se toman en [composition.ts](../../apps/api/src/composition.ts) sin que `app.ts` las conozca. Detalle en [Estrategia de migración](../migracion/README.md). **Estado: IMPLEMENTADO PARCIALMENTE;** ninguno de los dos redireccionamientos se ha activado, y el orden acordado es Radar primero, Feed después.

## Eventos asíncronos

Una integración por **eventos** consiste en que un servicio publica un hecho ya ocurrido y otros reaccionan más tarde, sin que el primero espere. Conviene cuando la reacción puede tardar y no debe bloquear ni revertir la operación original.

Hoy no hay ningún mecanismo de eventos. Lo más parecido son los disparadores de la base de datos, que se ejecutan dentro de la misma transacción y, por tanto, son síncronos.

La propuesta los limita a casos justificados, por ejemplo acreditar créditos tras una descarga o registrar un reporte de moderación. Las operaciones que exigen respuesta inmediata y consistente, como confirmar un asiento, seguirían siendo síncronas. **Estado: Propuesto.**

## Organización del repositorio: monorepo

Un **monorepo** es un único repositorio que contiene varios paquetes con dependencias y construcción propias. No es un estilo arquitectónico: un monorepo puede contener un monolito o veinte servicios.

Los workspaces son `apps/web`, `apps/api`, `apps/radar`, `apps/feed`, `packages/contracts` y `packages/feed-domain`. Cada uno tiene scripts propios y los seis comparten el lockfile. [Configuración del monorepo](../../package.json)

Los dos paquetes cumplen papeles distintos: `contracts` define **qué** se intercambia por HTTP (esquemas Zod de Radar y Feed), mientras que `feed-domain` contiene **la implementación** de las reglas y el SQL de Feed, compartida entre la API y el servicio para que los dos modos no puedan divergir.

## Resumen

| Concepto | Categoría | Estado en SOCIAL-UNSCH |
|---|---|---|
| Monolito modular | Estilo | Implementado; es lo que opera en producción |
| Capas | Enfoque interno | Implementado en seis de siete módulos |
| Puertos e inyección | Enfoque interno | Implementado en Radar y Feed; no en los otros cinco módulos |
| Arquitectura hexagonal o limpia | Enfoque interno | Validado en los dos dominios extraídos; dirección propuesta para el resto |
| Dominio compartido en un paquete | Enfoque interno | Implementado en Feed (`packages/feed-domain`); pendiente en Radar |
| Servicios por dominio | Estilo | Dos extraídos (Radar y Feed): código en `main`, **sin desplegar**. Alcance cerrado ahí |
| Strangler Fig | Estrategia de migración | Implementado parcialmente: entrada y piezas nuevas, sin redirección activa |
| Eventos asíncronos | Mecanismo de integración | Propuesto, selectivo; no ejecutado |
| Monorepo con varios paquetes | Organización del repositorio | Implementado en la etapa 3; ampliado a seis workspaces |

[← Índice](../README.md)
