# Principios de diseño (SOLID)

En Campus Radar, seguir un reporte desde la ruta HTTP hasta Redis permite comprobar qué responsabilidades están separadas y qué cambios obligan a modificar varias piezas.

| Principio | Aplicación en Social-UNSCH | Evidencia |
|---|---|---|
| **S · Responsabilidad única** | El controlador traduce la petición HTTP, el servicio valida el nodo y su valor, y el repositorio ejecuta la votación atómica. En Catálogos el controlador reúne HTTP y SQL. | [Controlador de Radar](../../../apps/api/src/modules/radar/radar.controller.ts) · [Controlador de Catálogos](../../../apps/api/src/modules/catalogs/catalogs.controller.ts) |
| **O · Abierto/cerrado** | La API monta un `RadarModule`. Cambiar del módulo local al proxy requiere seleccionar otro modo al arrancar. Añadir un tipo de reporte sí requiere revisar las validaciones del servicio y el contrato compartido. | [Composición](../../../apps/api/src/composition.ts) · [Contrato](../../../packages/contracts/src/radar.ts) |
| **L · Sustitución** | Tanto el módulo local como el proxy deben ofrecer las mismas operaciones. En Radar se comprueba con pruebas de paridad y una prueba del proxy, pero sigue habiendo dos implementaciones que podrían divergir. En Feed el problema no existe: hay **una sola** implementación en `packages/feed-domain`, y dos pruebas de contrato en espejo verifican que los dos modos respondan igual. | [Paridad de Radar](../../../apps/radar/tests/parity/radar.parity.test.ts) · [Contrato de Feed en la API](../../../apps/api/tests/contract/feed.contract.test.ts) y [en el servicio](../../../apps/feed/tests/contract/feed.contract.test.ts) |
| **I · Segregación de interfaces** | El puerto `RadarStore` expone las dos operaciones que consume el servicio, `getStatus` y `submitReport`. Los comandos de Redis quedan encapsulados en el adaptador. | [Puerto y repositorio](../../../apps/api/src/modules/radar/radar.repository.ts) |
| **D · Inversión de dependencias** | `RadarService` recibe un `RadarStore` por constructor y la fábrica del módulo crea el adaptador concreto. `FeedService` hace lo mismo con `IFeedRepository`, y su repositorio recibe el acceso a datos por el puerto `SqlQueryable`, de modo que el paquete del dominio no depende de `pg`. La separación sigue siendo parcial: `auth`, `users`, `matchmaking` y `carpooling` instancian sus repositorios con `new`. | [Servicio de Radar](../../../apps/api/src/modules/radar/radar.service.ts) · [Puertos de Feed](../../../packages/feed-domain/src/ports.ts) · [Puerto SQL](../../../packages/feed-domain/src/sql.ts) · [Contraejemplo](../../../apps/api/src/modules/matchmaking/matchmaking.service.ts) |

Para seguir las llamadas de un reporte y ver dónde se controla un voto duplicado, consulte el [diagrama de código y secuencias](../../04-modelo-c4/Nivel4-DiagramadeCodigo.md).

[Índice documental](../../README.md)
