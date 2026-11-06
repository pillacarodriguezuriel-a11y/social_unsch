# Decisiones arquitectónicas de Social-UNSCH

Los drivers explican por qué dos flujos del campus necesitan tratamientos distintos. Un reporte sobre el comedor pierde utilidad con el tiempo y puede caducar en Redis. La confirmación de un viaje, en cambio, debe descontar un asiento y aceptar la solicitud en una sola transacción. Estas diferencias condicionan qué módulos se pueden separar. [Drivers arquitectónicos](06-drivers-arquitectonicos.md) · [Reglas de negocio](../03-diseño-de-software/05-reglas-de-negocio.md)

| Decisión | Drivers | Justificación y resultado |
|---|---|---|
| [ADR-001 · Monolito modular](../06-decisiones-arquitectonicas/ADR-001-estado-y-organizacion-actual.md) | DA-01, DA-02, DA-05 | Una API centraliza el acceso institucional. PostgreSQL guarda los datos persistentes y Redis gestiona los reportes efímeros de Radar. |
| [ADR-002 · Capas por módulo](../06-decisiones-arquitectonicas/ADR-002-separacion-interna-de-responsabilidades.md) | DA-04 | En el feed, el controlador recibe la petición, el servicio aplica las reglas de publicación y el repositorio ejecuta SQL. Esa separación permite probar cada responsabilidad. |
| [ADR-003 · Migración gradual](../06-decisiones-arquitectonicas/ADR-003-migracion-gradual-por-dominios.md) | DA-04, DA-05 | Mantener las rutas públicas permite trasladar un dominio por vez y conservar el acceso del frontend durante la transición. |
| [ADR-004 · Extraer Radar primero](../06-decisiones-arquitectonicas/ADR-004-extraccion-inicial-de-radar.md) | DA-01, DA-04 | Radar concentra sus escrituras en Redis y puede validar la identidad mediante la clave pública. La implementación de esta decisión se detalla en ADR-008. |
| [ADR-005 · Propiedad de los datos](../06-decisiones-arquitectonicas/ADR-005-propiedad-gradual-de-datos.md) | DA-03, DA-06 | Se propone agrupar los datos que deben cambiar juntos. En movilidad, la confirmación y el descuento de asientos comparten una transacción. |
| [ADR-006 · Alojamiento gestionado](../06-decisiones-arquitectonicas/ADR-006-plataformas-de-despliegue.md) | DA-05 | El proyecto usa Vercel para la web y Render para la API. Los límites de los planes condicionan cuántos servicios puede operar el equipo. |
| [ADR-007 · Workspaces y montaje de Radar](../06-decisiones-arquitectonicas/ADR-007-workspaces-y-montaje-de-radar.md) | DA-04 | El contrato de Radar vive en un paquete compartido. La API recibe un módulo reemplazable para atender su ruta. |
| [ADR-008 · Enrutamiento reversible](../06-decisiones-arquitectonicas/ADR-008-extraccion-radar-servicio-independiente.md) | DA-01, DA-02, DA-04 | `RADAR_MODE` selecciona el módulo local o el proxy hacia `apps/radar`. Ambos atienden el contrato de Radar y se prueban en el repositorio. |

[Escenarios para evaluar estas decisiones](08-escenarios-atributos-calidad.md) · [Índice documental](../README.md)
