# ADR-001 · Monolito modular con PostgreSQL, Redis y JWT propio

| Campo | Valor |
|---|---|
| Estado | Vigente en el código |
| Tipo | Documentación retrospectiva basada en implementación |
| Fecha de documentación | 2026-10-12 |
| Aprobación | Sin constancia |

## Contexto

SOCIAL-UNSCH necesitaba ofrecer varias funciones distintas a una comunidad cerrada: identidad, radar del campus, publicaciones, matchmaking y movilidad. Lo desarrolla y opera una sola persona, con plataformas de bajo costo ([restricciones](../01-analisis-del-sistema/06-restricciones.md)).

El contexto original de la decisión no está documentado. Lo que sigue se reconstruye a partir del código del commit `8e56bfa`.

## Decisión observada

El sistema se construyó como:

1. **Una aplicación web** en Next.js y **una única API** en Express, ambas en el mismo repositorio y paquete.
2. La API organizada en **módulos por dominio**, no por tipo técnico.
3. **PostgreSQL** como almacén principal, con SQL escrito a mano y sin ORM.
4. **Redis** como almacén exclusivo del radar, con un script atómico para el consenso.
5. **Autenticación propia** con JWT firmado con RS256, en lugar de un proveedor de identidad externo.

## Alternativas

Análisis posterior; no hay constancia de que se evaluaran en su momento.

| Alternativa | Por qué habría sido razonable | Por qué la decisión observada resulta defendible |
|---|---|---|
| Microservicios desde el inicio | Aislamiento por dominio | Multiplica el trabajo de operación para una sola persona, sin límites de dominio aún probados |
| Lógica de servidor dentro de Next.js (rutas de API) | Un solo despliegue | Ata el backend al ciclo de vida del frontend y a su plataforma |
| ORM en lugar de SQL directo | Menos código repetido, migraciones generadas | Las operaciones críticas necesitan control explícito de transacciones y bloqueos |
| Guardar el radar en PostgreSQL | Un almacén menos | La expiración automática y el conteo atómico son nativos en Redis |
| Proveedor de identidad externo | Menos responsabilidad sobre credenciales; verificación de correo incluida | Dependencia y posible costo añadidos; restringir el dominio de correo es simple con código propio |
| JWT con clave simétrica (HS256) | Configuración más sencilla | Con RS256, quien verifica no puede emitir tokens: útil si más adelante hay varios servicios |

## Justificación

- Un solo proceso de servidor es lo más simple de desplegar y depurar para un equipo de una persona.
- La división por dominios mantiene el código localizado y prepara una futura separación.
- Redis encaja con datos que caducan solos y con una operación que debe ser atómica.
- La firma asimétrica separa quién emite de quién verifica.

## Consecuencias

**Positivas**

- Un único despliegue de servidor y un único lugar donde buscar un fallo.
- Transacciones locales para todas las operaciones de PostgreSQL.
- El radar no depende de PostgreSQL y puede fallar sin afectar al resto.
- Los tokens pueden verificarse sin consultar a ningún servicio.

**Costos**

- Todos los módulos comparten proceso: un defecto grave en uno afecta a todos, y no pueden escalarse por separado.
- Todos los módulos comparten base y credencial: nada impide que uno lea las tablas de otro, y varios lo hacen.
- Frontend y backend comparten paquete y dependencias.
- La autenticación propia traslada al proyecto la responsabilidad de proteger credenciales, y hoy faltan verificación de correo, revocación de tokens y limitación de intentos.
- El SQL manual repite consultas y coloca reglas de negocio en los repositorios.

## Evidencias

| Aspecto | Archivo |
|---|---|
| Una sola aplicación Express con todos los enrutadores | [app.ts](../../src/app.ts) |
| Módulos por dominio | [src/modules](../../src/modules) |
| Pool único de PostgreSQL | [database.ts](../../src/config/database.ts) |
| Redis solo en el radar | [radar.repository.ts](../../src/modules/radar/radar.repository.ts) |
| JWT RS256 | [jwt.ts](../../src/config/jwt.ts) |
| Un solo paquete | [package.json](../../package.json) |

## Condiciones para reconsiderarla

- Que un módulo necesite escalar o desplegarse con independencia de los demás.
- Que más de una persona o equipo trabaje en dominios distintos y se estorben.
- Que un fallo en un módulo tumbe repetidamente todo el servicio.
- Que la carga de mantener la autenticación propia supere la de integrar un proveedor.

La propuesta de evolución está en [ADR-003](ADR-003-migracion-gradual-por-dominios.md).

[← Índice de ADR](README.md) · [← Índice](../README.md)
