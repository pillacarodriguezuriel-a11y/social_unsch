# ADR-002 · Separación interna en capas por módulo

| Campo | Valor |
|---|---|
| Estado | Vigente en el código |
| Tipo | Documentación retrospectiva basada en implementación |
| Fecha de documentación | 2026-10-12 |
| Aprobación | Sin constancia |

## Contexto

Dentro de la API única ([ADR-001](ADR-001-estado-y-organizacion-actual.md)), cada módulo debe atender solicitudes HTTP, aplicar reglas y acceder a datos. Sin una convención, esas tres responsabilidades tienden a mezclarse en los manejadores de ruta.

## Decisión observada

Cada módulo se divide en cuatro archivos con responsabilidades fijas:

| Capa | Archivo | Responsabilidad |
|---|---|---|
| Rutas | `<modulo>.routes.ts` | Asociar URL, middleware y controlador |
| Controlador | `<modulo>.controller.ts` | Entrada y salida HTTP |
| Servicio | `<modulo>.service.ts` | Reglas de negocio |
| Repositorio | `<modulo>.repository.ts` | Acceso a datos |

Decisiones complementarias observadas:

- Los módulos **no se importan entre sí**; comparten solo `config`, `middlewares` y `shared`.
- Los errores de negocio se expresan con `AppError` y los traduce un único middleware.
- La autenticación es un middleware aplicado ruta por ruta.
- Las dependencias se crean con `new` dentro de cada clase, sin interfaces ni contenedor de dependencias.

## Alternativas

Análisis posterior.

| Alternativa | Ventaja | Desventaja |
|---|---|---|
| Manejadores de ruta con todo dentro | Menos archivos | Imposible probar reglas sin HTTP ni base de datos |
| Organización por tipo técnico (`controllers/`, `services/`, `repositories/`) | Habitual en proyectos pequeños | Dispersa cada dominio por todo el árbol y dificulta separarlo |
| Arquitectura hexagonal con puertos e inyección | El negocio no depende de la infraestructura | Más código y conceptos para un proyecto de una persona en su fase inicial |
| Reglas en procedimientos almacenados | Atomicidad garantizada | Lógica fuera del control de versiones habitual y difícil de probar |

## Justificación

- Las capas son la convención más conocida y la más barata de aplicar.
- Agrupar por dominio hace que cada módulo sea una unidad que puede moverse entera.
- Prohibir las importaciones entre módulos evita el acoplamiento más visible.

## Consecuencias

**Positivas**

- Cada archivo tiene un propósito reconocible; un desarrollador nuevo localiza el código con rapidez.
- Los servicios y repositorios pueden probarse por separado.
- Cada módulo puede extraerse copiando su directorio y lo que usa de `config` y `shared`.

**Costos**

- **Dependencias concretas.** El servicio depende de la clase del repositorio y este del pool. Para probar hay que interceptar módulos con `jest.mock`.
- **La separación no es completa.** Hay reglas de negocio en repositorios, en un script de Redis y en disparadores de la base.
- **Aplicación desigual.** `catalogs` no tiene servicio ni repositorio; varios controladores construyen errores sin `AppError`.
- **Sin acoplamiento de código, pero con acoplamiento de datos.** Los módulos no se importan, pero leen las mismas tablas.
- Algunos servicios solo reenvían llamadas, lo que añade archivos sin aportar reglas.

Esta decisión **no equivale a arquitectura hexagonal**: no hay puertos, la dirección de dependencias va del negocio a la infraestructura y no existe un punto de composición. El análisis está en [Estilos y enfoques](../02-arquitectura-de-software/02-estilos-y-enfoques.md).

## Evidencias

| Aspecto | Archivo |
|---|---|
| Las cuatro capas | [src/modules/feed](../../src/modules/feed) |
| Creación de dependencias con `new` | [feed.service.ts](../../src/modules/feed/feed.service.ts) |
| Error tipado y traducción central | [AppError.ts](../../src/shared/errors/AppError.ts), [error.middleware.ts](../../src/middlewares/error.middleware.ts) |
| Excepción a las capas | [catalogs.controller.ts](../../src/modules/catalogs/catalogs.controller.ts) |
| Reglas en el repositorio | [matchmaking.repository.ts](../../src/modules/matchmaking/matchmaking.repository.ts) |
| Pruebas que interceptan módulos | [tests/unit](../../tests/unit) |

## Condiciones para reconsiderarla

- Al extraer un módulo como servicio: es el momento natural para introducir puertos e inyección de dependencias.
- Si se necesita sustituir un almacén, por ejemplo llevar datos de una tabla a otro servicio.
- Si las pruebas con módulos interceptados empiezan a ocultar errores reales de integración.

[← Índice de ADR](README.md) · [← Índice](../README.md)
