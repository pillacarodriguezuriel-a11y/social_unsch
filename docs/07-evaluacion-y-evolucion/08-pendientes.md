# Pendientes

> Prioridad actual: [Operación de Radar](../migracion/ETAPA_05_OPERACION_RADAR.md) (§8). Confirmar configuración/despliegue desde paneles, validar en staging/plataforma real el rendimiento del proxy optimizado (`d616f9b`, que ya cumple localmente con -14,8 % en *loopback*, pendiente con red real), decidir presupuesto sin suspensión, autorizar por separado despliegue y activación, y ejecutar 14 días reales de observación. Los arreglos Redis (F-3/F-4) ya están fusionados en `main`; no duplicar su PR. La caída PostgreSQL previa sigue sin causa confirmada y no autoriza restaurar datos.

Acciones abiertas, verificadas el 2026-10-30 y actualizadas el 2026-11-23 con el [cierre de la etapa 4](../migracion/ETAPA_04_CIERRE_VALIDACION_RADAR.md). Este documento registra hallazgos: **no corrige código**. Los identificadores `DT` remiten a [Riesgos y deuda técnica](02-riesgos-y-deuda-tecnica.md), que conserva el catálogo completo.

## Críticos

### P-01 · `test-real` falla en CI · **RESUELTO en la rama**

- **Resolución (2026-11-23):** causa demostrada (conflicto de puertos) y corregida; el job pasa en CI. Pendiente de fusionar.

- **Problema:** el job de pruebas reales falla en el PR n.º 5 y en `main`.
- **Impacto:** las 36 pruebas de concurrencia, migraciones y Redis no protegen `main`: la etapa 4 se fusionó y desplegó sin ellas.
- **Evidencia:** ejecuciones [39985651148](https://github.com/pillacarodriguezuriel-a11y/social_unsch/actions/runs/39985651148) y [41060703064](https://github.com/pillacarodriguezuriel-a11y/social_unsch/actions/runs/41060703064). Causa probable, PENDIENTE DE VALIDACIÓN: conflicto de puertos entre los servicios de [ci.yml](../../.github/workflows/ci.yml) y los contenedores de [test-environment.ts](../../apps/api/tests/real/helpers/test-environment.ts).
- **Etapa relacionada:** 4.
- **Acción recomendada:** leer el log; hacer que el arnés reutilice los servicios del flujo o quitar esos servicios.

### P-02 · Sin respaldo verificado de PostgreSQL

- **Problema:** no hay procedimiento versionado de respaldo ni restauración.
- **Impacto:** perder la base sería irrecuperable; el proyecto ya sufrió la pausa de servicios gratuitos.
- **Evidencia:** DT-18 y RM-03.
- **Etapa relacionada:** 3 (arrastrado) y 8.
- **Acción recomendada:** confirmar qué ofrece el proveedor y ensayar una restauración.

### P-03 · Sin límite de frecuencia en rutas públicas

- **Problema:** inicio de sesión, registro y reportes del radar no limitan intentos.
- **Impacto:** fuerza bruta y abuso del consenso.
- **Evidencia:** sin middleware en [app.ts](../../apps/api/src/app.ts); DT-04.
- **Etapa relacionada:** 3 (arrastrado).
- **Acción recomendada:** limitar por IP y usuario. Requiere definir `trust proxy`, hoy sin configurar.

### P-04 · Ejecutores heredados invocables a mano

- **Problema:** siguen en el repositorio scripts con seed de administrador, borrado de catálogos y aceptación masiva de términos.
- **Impacto:** riesgo de dañar datos por error.
- **Evidencia:** DT-10.
- **Etapa relacionada:** 3 (arrastrado).
- **Acción recomendada:** retirarlos tras confirmar que no se usan.

## Arquitectónicos

### P-05 · Radar sin desplegar ni activar

- **Problema:** `apps/radar` está en `main`, pero no se ha desplegado.
- **Impacto:** no puede afirmarse que SOCIAL-UNSCH tenga un servicio extraído en operación.
- **Evidencia:** 404 en el dominio previsto, repetido tras la fusión.
- **Etapa relacionada:** 4.
- **Acción recomendada:** corregir P-01 y seguir [Activación](../migracion/EXTRACCION_RADAR.md#activación).

### P-06 · Dos implementaciones de Radar

- **Problema:** la lógica está copiada en `apps/api` y `apps/radar`.
- **Impacto:** pueden divergir y romper la reversión. Ya difiere el formato de `last_updated`.
- **Evidencia:** [API](../../apps/api/src/modules/radar/radar.repository.ts), [Radar](../../apps/radar/src/modules/radar/radar.repository.ts); DT-48.
- **Etapa relacionada:** 4.
- **Acción recomendada:** unificar el formato y retirar la copia local tras la observación. **Feed ya no tiene este problema:** su lógica vive una sola vez en `packages/feed-domain`; conviene aplicar el mismo patrón a Radar.

### P-26 · Feed sin desplegar ni activar, y sin umbrales aprobados

- **Problema:** `apps/feed` está en `main` y probado, pero no se ha desplegado, `FEED_MODE=local` sigue siendo el valor activo y sus umbrales de rendimiento no están aprobados por el propietario.
- **Impacto:** no puede afirmarse que el Feed opere como servicio independiente, ni que cumpla un criterio de rendimiento. Las mediciones existentes son **exploratorias**.
- **Evidencia:** [benchmark-feed-etapa8-2026-11-25.json](../migracion/evidencias/benchmark-feed-etapa8-2026-11-25.json) con `thresholdsApproved: false`; `npm run ops:probe` con `PROBE_FEED`.
- **Etapa relacionada:** 7 y 8.
- **Acción recomendada:** aprobar o corregir los umbrales propuestos y seguir el orden de activación del [ADR-011](../06-decisiones-arquitectonicas/ADR-011-cierre-de-la-migracion-y-alcance-final.md): Feed **después** de que Radar complete su observación.

### P-28 · Feed no tiene independencia de datos

- **Problema:** `apps/feed` comparte PostgreSQL con la API y lee `users` mediante `JOIN` y un adaptador.
- **Impacto:** una caída de PostgreSQL afecta a los dos procesos por igual; describir el sistema como «microservicios independientes» sería inexacto.
- **Evidencia:** [Datos y propiedad](../02-arquitectura-software/06-datos-y-propiedad-por-dominio.md#acceso-a-datos-de-los-servicios-extraídos).
- **Etapa relacionada:** 7 y 8; depende de ADR-005.
- **Acción recomendada:** mantenerlo declarado explícitamente. Dar permisos mínimos por dominio dentro de la misma base es el siguiente paso razonable; separar físicamente, solo con beneficio demostrado.

## Calidad

### P-07 · `apps/radar` sin pruebas contra Redis real · **RESUELTO en la rama**

- **Resolución (2026-11-23):** suite E2E con Radar compilado y Redis real, en CI.

- **Problema:** todas sus pruebas usan Redis simulado.
- **Impacto:** el script y la conexión TLS no se ejercitan desde el servicio.
- **Evidencia:** [apps/radar/tests](../../apps/radar/tests/integration/proxy.e2e.test.ts).
- **Etapa relacionada:** 4.
- **Acción recomendada:** añadir una suite real y sumarla a CI.

### P-08 · La paridad no compara ambas implementaciones · **PARCIAL**

- **Avance (2026-11-23):** la E2E compara API local y API proxy en errores, autenticación y fallos. No cubre toda la lógica de votación por separado.

- **Problema:** [radar.parity.test.ts](../../apps/radar/tests/parity/radar.parity.test.ts) solo ejecuta `apps/radar`.
- **Impacto:** da una seguridad mayor de la real.
- **Evidencia:** el archivo no importa código de `apps/api`, ni puede hacerlo por las reglas de límites.
- **Etapa relacionada:** 4.
- **Acción recomendada:** ejecutar la misma batería HTTP contra ambos modos desde fuera.

### P-09 · El benchmark no mide el sistema · **RESUELTO en la rama**

- **Resolución (2026-11-23):** benchmark reescrito con las aplicaciones reales. Su resultado no cumple el umbral de sobrecarga: ver P-24.

- **Problema:** [benchmark-radar.js](../../scripts/benchmark-radar.js) simula los servidores.
- **Impacto:** las cifras de ETAPA_04 y ADR-008 no sirven para decidir.
- **Evidencia:** [Métricas](06-metricas.md#cifras-que-no-deben-citarse-como-resultados).
- **Etapa relacionada:** 4.
- **Acción recomendada:** medir con las aplicaciones reales y Redis, en local y en la plataforma.

### P-24 · Sobrecarga del proxy por encima del umbral

- **Problema:** con 50 usuarios simultáneos, el p95 por proxy fue un 156 % peor que en modo local; a 20 solicitudes/s, 11 ms más. El umbral es un 20 %.
- **Impacto:** no puede afirmarse que la separación cumpla el criterio de rendimiento acordado.
- **Evidencia:** [benchmark-radar-2026-11-23.json](../migracion/evidencias/benchmark-radar-2026-11-23.json). Medición local con alta dispersión entre repeticiones.
- **Etapa relacionada:** 4.
- **Acción recomendada:** medir en la plataforma real y en un equipo dedicado; decidir explícitamente si el criterio relativo es adecuado con latencias base de pocos milisegundos. No cambiar la meta sin registrar la decisión.

### P-27 · `apps/feed` sin suite propia contra PostgreSQL real

- **Problema:** el SQL de Feed se prueba con dobles en `packages/feed-domain` y de extremo a extremo en `tests/e2e/feed.e2e.test.js`, pero `apps/feed` no tiene una suite equivalente a `apps/api/tests/real` con su propio pool.
- **Impacto:** el comportamiento del pool del servicio (límite de 10 conexiones, timeout de 5 s, manejador de error) no se ejercita contra una base real fuera del E2E.
- **Evidencia:** [apps/feed/tests](../../apps/feed/tests/integration/feed.app.test.ts) usa un pool simulado; [jest.config.ts](../../apps/feed/jest.config.ts) excluye `src/config/database.ts` de la cobertura.
- **Etapa relacionada:** 8.
- **Acción recomendada:** añadir una suite real para `apps/feed` reutilizando el arnés de contenedores desechables, antes de activar el proxy en producción.

## Infraestructura

### P-25 · PostgreSQL de producción no disponible

- **Problema:** el 2026-11-23 la salud de la API respondió `database: down`.
- **Impacto:** inicio de sesión, feed, matchmaking y carpooling no funcionan en producción.
- **Evidencia:** `GET /health/ready` 503. Causa probable, PENDIENTE DE VALIDACIÓN: pausa por inactividad del plan gratuito de Supabase.
- **Etapa relacionada:** 1.
- **Acción recomendada:** que el propietario revise el panel de Supabase; ver P-02.

### P-10 · Arranque en frío incompatible con el proxy

- **Problema:** si Radar se suspende, tardaría más que el límite máximo del proxy (30 s).
- **Impacto:** las primeras solicitudes recibirían 504.
- **Evidencia:** 32,6 s observados en la API el 2026-10-30 y más de 70 s el 2026-11-23; límite en [env.ts](../../apps/api/src/config/env.ts). Alternativas en el [cierre de la etapa 4](../migracion/ETAPA_04_CIERRE_VALIDACION_RADAR.md).
- **Etapa relacionada:** 4.
- **Acción recomendada:** decidir el plan de instancia o un latido antes de activar.

### P-11 · Configuración sin confirmar en los paneles

- **Problema:** proveedor, planes, comandos, `RADAR_MODE` y versiones no pudieron verificarse.
- **Impacto:** lo documentado depende de inferencias externas.
- **Evidencia:** [Mapa de despliegue](../05-despliegue-y-operacion/01-mapa-de-despliegue.md#comprobaciones-que-requieren-al-propietario).
- **Etapa relacionada:** 1.
- **Acción recomendada:** que el propietario confirme la lista.

### P-12 · Configuración de despliegue no versionada

- **Problema:** no existen `render.yaml` ni `vercel.json`.
- **Impacto:** un panel mal configurado no deja rastro; Radar sumará otro servicio.
- **Evidencia:** DT-41.
- **Etapa relacionada:** 4.
- **Acción recomendada:** versionar la configuración al crear Radar.

### P-13 · Consultas preparadas con nombre y pooler

- **Problema:** los repositorios usan consultas con `name`, que pueden fallar con un pooler en modo transacción.
- **Impacto:** errores intermitentes según cómo conecte la API. Sin evidencia de fallo.
- **Evidencia:** [feed.repository.ts](../../apps/api/src/modules/feed/feed.repository.ts); el informe sin seguimiento menciona *Transaction Pooler*. PENDIENTE DE VALIDACIÓN.
- **Etapa relacionada:** 3.
- **Acción recomendada:** confirmar el modo de conexión de la API en producción.

## Frontend

### P-14 · Seis pantallas simuladas

- **Problema:** carpooling, banco de archivos, moderación, marketplace, empleo y ajustes no comparten datos.
- **Impacto:** quien usa la plataforma puede creer que sus datos se guardan.
- **Evidencia:** [Inventario](01-inventario-de-implementacion.md).
- **Etapa relacionada:** 5 a 7.
- **Acción recomendada:** conectar primero carpooling, cuya API ya existe.

### P-15 · Token en `localStorage`

- **Problema:** cualquier script de la página puede leerlo.
- **Impacto:** un XSS robaría la sesión durante 24 horas.
- **Evidencia:** [api.ts](../../apps/web/app/lib/api.ts); DT-02.
- **Etapa relacionada:** 5.
- **Acción recomendada:** valorar cookies `HttpOnly` junto con la extracción de Identidad.

### P-16 · Sin pruebas de componentes

- **Problema:** solo se prueba la lógica de `app/lib`.
- **Impacto:** regresiones de pantalla sin detectar.
- **Evidencia:** [apps/web/tests](../../apps/web/tests/catalogs.test.ts).
- **Etapa relacionada:** 8.
- **Acción recomendada:** cubrir inicio de sesión, radar y feed.

## Backend

### P-17 · Correo sensible a mayúsculas

- **Problema:** el registro guarda el correo en minúsculas, pero las búsquedas usan el texto recibido.
- **Impacto:** quien escriba mayúsculas no podrá iniciar sesión, y un registro duplicado con otra grafía acabaría en error 500.
- **Evidencia:** [auth.repository.ts](../../apps/api/src/modules/auth/auth.repository.ts), [auth.validators.ts](../../apps/api/src/modules/auth/auth.validators.ts); DT-47. Hallazgo por lectura de código.
- **Etapa relacionada:** 5.
- **Acción recomendada:** normalizar en el validador y añadir una prueba.

### P-18 · Validación laxa en Radar

- **Problema:** el aforo acepta decimales aunque el mensaje exige un entero, y un `status` no textual produce 500.
- **Impacto:** conjuntos de voto residuales y errores evitables.
- **Evidencia:** [radar.service.ts](../../apps/radar/src/modules/radar/radar.service.ts); DT-50.
- **Etapa relacionada:** 4.
- **Acción recomendada:** validar con `RadarReportRequestSchema` en ejecución, en un cambio versionado del contrato.

### P-19 · Radar expone rutas y CORS fuera del contrato

- **Problema:** monta `/status` y `/report` en la raíz y admite orígenes por defecto con `localhost` en producción.
- **Impacto:** superficie mayor de la necesaria.
- **Evidencia:** [app.ts](../../apps/radar/src/app.ts), [env.ts](../../apps/radar/src/config/env.ts); DT-49 y DT-51.
- **Etapa relacionada:** 4.
- **Acción recomendada:** quitar el montaje en raíz y exigir `ALLOWED_ORIGINS`.

### P-20 · Sin autorización por rol ni términos en servidor

- **Problema:** la API solo comprueba el token.
- **Impacto:** el rol administrador no tiene efecto y la aceptación de términos se puede omitir.
- **Evidencia:** DT-05 y DT-06.
- **Etapa relacionada:** 5.
- **Acción recomendada:** definirlo junto con el servicio de Identidad.

## Documentación

### P-21 · Registros históricos con cifras no válidas

- **Problema:** ETAPA_04 y ADR-008 incluyen afirmaciones superadas por esta revisión.
- **Impacto:** podrían citarse en la defensa del proyecto.
- **Evidencia:** ambos llevan ahora una nota de corrección.
- **Etapa relacionada:** 4.
- **Acción recomendada:** al cerrar la etapa, registrar los resultados reales en un ADR nuevo.

### P-22 · Decisiones sin aprobación documentada

- **Problema:** los ADR propuestos no registran quién los aprobó.
- **Impacto:** no se distingue decisión tomada de discusión, aunque ADR-003 y ADR-004 ya se estén ejecutando.
- **Evidencia:** [Índice de ADR](../06-decisiones-arquitectonicas/README.md).
- **Etapa relacionada:** 4.
- **Acción recomendada:** que el propietario confirme su estado.

### P-23 · Informes sin seguimiento

- **Problema:** `TEST_REPORT.md` y `reporte_despliegue_y_pendientes.md` describen estados anteriores al monorepo.
- **Impacto:** pueden confundirse con el estado vigente.
- **Evidencia:** citan `tsconfig.backend.json` y 363 pruebas.
- **Etapa relacionada:** —.
- **Acción recomendada:** archivarlos o descartarlos; decisión del propietario.

Ver también: [Estado actual y evidencias](07-estado-actual-y-evidencias.md) · [Plan de migración](03-plan-de-migracion.md)

[← Índice](../README.md)
