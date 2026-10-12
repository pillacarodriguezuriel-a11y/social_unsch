# ADR-004 · Radar como primer servicio extraído

| Campo | Valor |
|---|---|
| Estado | **Propuesto**, en discusión |
| Tipo | Decisión futura |
| Fecha de documentación | 2026-10-12 |
| Aprobación | Sin aprobación documentada |

## Contexto

La migración gradual ([ADR-003](ADR-003-migracion-gradual-por-dominios.md)) necesita un primer dominio con el que ejercitar todo el mecanismo: entrada de API, verificación de tokens fuera del monolito, despliegue de una segunda unidad y reversión. Conviene que ese primer caso tenga el menor riesgo posible.

## Decisión propuesta

Extraer el módulo `radar` como primer servicio independiente, conservando su contrato HTTP y su formato de claves en Redis, y manteniendo el módulo original en el monolito hasta validar el servicio nuevo.

## Alternativas

| Candidato | Dependencias de datos ajenos | Valoración |
|---|---|---|
| **Radar** | Ninguna | Menor riesgo |
| Catálogos | Solo lectura de tablas de referencia | Riesgo bajo, pero poco representativo: no usa autenticación y apenas tiene reglas |
| Feed | Lee nombre y rol de `users` | Obliga a resolver primero el acceso a datos de usuario |
| Matchmaking | Lee `users`; transacciones propias | Igual que feed, con más complejidad |
| Carpooling | Lee datos de contacto dentro de una transacción | El más acoplado; no apto como primer caso |
| Identidad | Es la fuente de `users` | Todos dependen de ella; debe ir después |

## Justificación

Sustentada en el código actual:

- **No usa PostgreSQL.** Su repositorio solo importa el cliente Redis ([radar.repository.ts](../../src/modules/radar/radar.repository.ts)).
- **No importa ningún otro módulo.**
- **Es dueño exclusivo de su almacén.** Ningún otro módulo usa Redis.
- **Solo necesita el identificador del usuario**, que ya viaja en el token ([radar.controller.ts](../../src/modules/radar/radar.controller.ts)).
- **Sus datos son efímeros.** Un error durante la extracción no puede causar pérdida permanente: los datos caducan a los 15 minutos.
- **Tiene pruebas contra Redis real** ([radar.real.test.ts](../../tests/real/radar.real.test.ts)) que pueden reutilizarse para validar el servicio nuevo.
- **Patrón de uso distinto.** Es la función de consulta más frecuente y la que más se beneficia de poder fallar sin arrastrar al resto.

## Consecuencias

**Positivas esperadas**

- Se construye y prueba todo el mecanismo de extracción con el caso más simple.
- Un fallo de Redis o del radar queda aislado en su propio proceso.
- Sirve de plantilla para la organización hexagonal de los servicios siguientes.

**Costos esperados**

- Un segundo servicio que desplegar y vigilar.
- Si la plataforma suspende servicios inactivos, el radar tendría su propio arranque en frío, justo en la función donde la inmediatez importa más. Debe medirse antes de darlo por bueno.
- El beneficio funcional directo para el usuario es nulo: el valor está en el aprendizaje y en el aislamiento.
- Durante la convivencia existen dos implementaciones del radar que no deben divergir.

## Trabajo previo necesario

Estos puntos existen hoy en el código y deben resolverse antes o durante la extracción:

| Punto | Detalle | Evidencia |
|---|---|---|
| Valores duplicados en dos idiomas | Los estados se aceptan en inglés y en español y se cuentan por separado | [radar.service.ts](../../src/modules/radar/radar.service.ts) |
| Umbral y vigencia escritos en el repositorio | Existen como constantes compartidas, sin usarse | [radar.repository.ts](../../src/modules/radar/radar.repository.ts), [unsch.constants.ts](../../src/shared/constants/unsch.constants.ts) |
| Middleware de autenticación compartido | El servicio nuevo necesita `requireAuth` y la clave pública | [auth.middleware.ts](../../src/middlewares/auth.middleware.ts) |
| Reconexión a Redis | El cliente deja de reintentar tras 5 fallos | [redis.ts](../../src/config/redis.ts) |
| Estado de Redis en producción | Sin verificar | [Mapa de despliegue](../05-despliegue-y-operacion/01-mapa-de-despliegue.md) |

## Evidencias

Las citadas en la justificación. No existe ningún servicio de radar independiente: esta decisión no está implementada.

## Condiciones para reconsiderarla

- Que la latencia del arranque en frío de un servicio de radar separado sea peor que la actual de forma perceptible.
- Que Redis en producción no esté disponible de forma estable.
- Que la etapa 3 no haya producido una entrada de API reversible: sin ella, extraer el radar no se puede deshacer con facilidad.

Diagrama: [C2 de transición](../04-modelo-c4/05-contenedores-de-transicion.md).

[← Índice de ADR](README.md) · [← Índice](../README.md)
