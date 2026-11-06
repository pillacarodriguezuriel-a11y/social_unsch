# Principios de diseño (SOLID)

En Campus Radar, seguir un reporte desde la ruta HTTP hasta Redis permite comprobar qué responsabilidades están separadas y qué cambios obligan a modificar varias piezas.

| Principio | Aplicación en Social-UNSCH | Evidencia |
|---|---|---|
| **S · Responsabilidad única** | El controlador traduce la petición HTTP, el servicio valida el nodo y su valor, y el repositorio ejecuta la votación atómica. En Catálogos el controlador reúne HTTP y SQL. | [Controlador de Radar](../../../apps/api/src/modules/radar/radar.controller.ts) · [Controlador de Catálogos](../../../apps/api/src/modules/catalogs/catalogs.controller.ts) |
| **O · Abierto/cerrado** | La API monta un `RadarModule`. Cambiar del módulo local al proxy requiere seleccionar otro modo al arrancar. Añadir un tipo de reporte sí requiere revisar las validaciones del servicio y el contrato compartido. | [Composición](../../../apps/api/src/composition.ts) · [Contrato](../../../packages/contracts/src/radar.ts) |
| **L · Sustitución** | Tanto el módulo local como el proxy deben ofrecer las mismas operaciones de consulta y reporte. Las pruebas de paridad comprueban las claves y los valores esperados en el servicio extraído. La prueba de integración recorre el proxy. | [Pruebas de paridad](../../../apps/radar/tests/parity/radar.parity.test.ts) · [Prueba del proxy](../../../apps/radar/tests/integration/proxy.e2e.test.ts) |
| **I · Segregación de interfaces** | El puerto `RadarStore` expone las dos operaciones que consume el servicio, `getStatus` y `submitReport`. Los comandos de Redis quedan encapsulados en el adaptador. | [Puerto y repositorio](../../../apps/api/src/modules/radar/radar.repository.ts) |
| **D · Inversión de dependencias** | `RadarService` recibe un `RadarStore` por constructor. La fábrica del módulo crea el adaptador concreto. Esta separación es parcial en el proyecto, pues `FeedService` todavía instancia su repositorio. | [Servicio de Radar](../../../apps/api/src/modules/radar/radar.service.ts) · [Fábrica](../../../apps/api/src/modules/radar/radar.module.ts) · [Servicio del feed](../../../apps/api/src/modules/feed/feed.service.ts) |

Para seguir las llamadas de un reporte y ver dónde se controla un voto duplicado, consulte el [diagrama de código y secuencias](../../04-modelo-c4/Nivel4-DiagramadeCodigo.md).

[Índice documental](../../README.md)
