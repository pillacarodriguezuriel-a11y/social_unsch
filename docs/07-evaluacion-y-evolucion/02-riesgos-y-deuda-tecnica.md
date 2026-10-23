# Riesgos y deuda técnica

Problemas conocidos del código y de la operación, con su evidencia. Este documento los registra; **no corrige ninguno**. No es una auditoría de seguridad completa: recoge lo encontrado al documentar la arquitectura.

La prioridad es una valoración del autor de esta documentación: **Alta**, afecta a datos, seguridad o disponibilidad; **Media**, dificulta la evolución; **Baja**, mantenimiento.

## Estado tras la etapa 3

La etapa 3 ([informe](../migracion/ETAPA_03_PREPARACION_SEPARACION.md)) modificó estas entradas. Las tablas siguientes conservan la descripción original.

| ID | Estado tras la etapa 3 |
|---|---|
| DT-27 | Parcial: los valores del radar salen ahora del contrato (`packages/contracts`); los catálogos siguen duplicados en las constantes del frontend y del backend |
| DT-28 | Sin cambio de comportamiento: documentado en el contrato; la unificación queda para la etapa 4 |
| DT-31 | Resuelta: `cookie-parser` retirado |
| DT-35 | Parcial: pruebas de la lógica de `app/lib` del frontend; sin pruebas de componentes |
| DT-36 | Resuelta: sin catálogo válido no se ofrece ni se envía ninguna escuela |
| DT-39 | Parcial: `/health/live` y `/health/ready` implementadas; sin registro de solicitudes |
| DT-40 | Resuelta: la API valida su configuración al arrancar |
| DT-45 | Resuelta: workspaces separados y `engines` declarados |
| Nueva | El modo proxy del radar no verifica el token; delega en el servicio de destino. Solo afecta si se activa `RADAR_MODE=proxy` |

## Deuda técnica

### Seguridad y acceso

| ID | Problema | Evidencia | Prioridad | Etapa sugerida |
|---|---|---|---|---|
| DT-01 | El correo no se verifica: cualquiera puede registrarse con una dirección del dominio que no controla | [roles.ts](../../apps/api/src/shared/auth/roles.ts) lo declara pendiente | Alta | 5 |
| DT-02 | El token se guarda en `localStorage`, accesible para cualquier script de la página | [api.ts](../../apps/web/app/lib/api.ts) | Alta | 5 |
| DT-03 | Sin revocación de tokens ni cierre de sesión en servidor; un token robado vale 24 horas | [jwt.ts](../../apps/api/src/config/jwt.ts) | Media | 5 |
| DT-04 | Sin límite de frecuencia en inicio de sesión, registro ni reportes del radar | [app.ts](../../apps/api/src/app.ts) | Alta | 3 |
| DT-05 | Sin autorización por rol en la API; el rol administrador no tiene efecto en el servidor | [auth.middleware.ts](../../apps/api/src/middlewares/auth.middleware.ts) | Media | 5 |
| DT-06 | La aceptación de términos solo se exige en el navegador | [RouteGuard.tsx](../../apps/web/components/ui/RouteGuard.tsx) | Media | 3 |
| DT-07 | Las solicitudes sin cabecera `Origin` pasan el control CORS. Es el comportamiento habitual, pero conviene saber que CORS no protege la API de clientes que no son navegadores | [app.ts](../../apps/api/src/app.ts) | Baja | — |
| DT-08 | No hay procedimiento versionado para crear una cuenta administradora | Búsqueda en el repositorio | Media | 5 |

### Datos y consistencia

| ID | Problema | Evidencia | Prioridad | Etapa sugerida |
|---|---|---|---|---|
| DT-09 | El índice único de solicitudes de carpooling puede no crearse y la migración se registra igualmente como aplicada | [005_canonical_extensions.sql](../../apps/api/src/database/migrations/sql/005_canonical_extensions.sql); la validación de [migrator.ts](../../apps/api/src/database/migrations/migrator.ts) no lo comprueba | Alta | 3 |
| DT-10 | Ejecutores y SQL heredados siguen en el repositorio y pueden invocarse a mano: seed con cuenta administradora, borrado de catálogos, aceptación masiva de términos | `run_seed.ts`, `seed.sql`, `add_canonical_data.sql`, `fix_accept_terms.ts` en [src/database/migrations](../../apps/api/src/database/migrations) | Alta | 3 |
| DT-11 | La suma de verificación de las migraciones se guarda, pero no se compara: modificar un archivo ya aplicado pasa inadvertido | [migrator.ts](../../apps/api/src/database/migrations/migrator.ts) | Media | 3 |
| DT-12 | Las migraciones no tienen pasos de reversión | [sql/](../../apps/api/src/database/migrations/sql) | Media | 3 |
| DT-13 | Registro simultáneo con el mismo correo: uno de los dos recibe un error 500 | [auth.service.ts](../../apps/api/src/modules/auth/auth.service.ts) | Baja | 3 |
| DT-14 | Posible coincidencia perdida si dos intereses mutuos llegan a la vez. Inferencia por análisis | [matchmaking.repository.ts](../../apps/api/src/modules/matchmaking/matchmaking.repository.ts) | Baja | 5 |
| DT-15 | Dos columnas para el ciclo académico, con rangos distintos y un valor por defecto que inventa el ciclo 1 | [001_base_schema.sql](../../apps/api/src/database/migrations/sql/001_base_schema.sql), [004_moderation_and_carpooling.sql](../../apps/api/src/database/migrations/sql/004_moderation_and_carpooling.sql) | Media | 5 |
| DT-16 | Créditos iniciales contradictorios: 5 por defecto en el esquema, 0 en el registro | [001_base_schema.sql](../../apps/api/src/database/migrations/sql/001_base_schema.sql), [auth.repository.ts](../../apps/api/src/modules/auth/auth.repository.ts) | Baja | 7 |
| DT-17 | Seis tablas sin código que las use | [Inventario](01-inventario-de-implementacion.md) | Baja | 5 y 7 |
| DT-18 | Sin respaldo de PostgreSQL definido en el repositorio | — | Alta | 3 |

### Diseño y código

| ID | Problema | Evidencia | Prioridad | Etapa sugerida |
|---|---|---|---|---|
| DT-19 | Dependencias creadas con `new`, sin interfaces | [radar.service.ts](../../apps/api/src/modules/radar/radar.service.ts) y demás servicios | Media | Al extraer cada servicio |
| DT-20 | La tabla `users` se consulta desde cinco módulos | [Componentes y dependencias](../02-arquitectura-de-software/03-componentes-y-dependencias.md) | Media | 5 |
| DT-21 | Código de prueba en producción: parámetro `injectedFailure` y cliente alternativo si `pool.connect` no existe | [carpooling.repository.ts](../../apps/api/src/modules/carpooling/carpooling.repository.ts), [carpooling.service.ts](../../apps/api/src/modules/carpooling/carpooling.service.ts) | Media | 6 |
| DT-22 | Métodos de repositorio sin uso en el flujo actual | `createRequest`, `deleteRequest`, `getPassengerMeta` en [carpooling.repository.ts](../../apps/api/src/modules/carpooling/carpooling.repository.ts) | Baja | 6 |
| DT-23 | Códigos de error de otros dominios en matchmaking | [matchmaking.service.ts](../../apps/api/src/modules/matchmaking/matchmaking.service.ts) | Baja | 3 |
| DT-24 | Errores del repositorio identificados comparando textos | [carpooling.service.ts](../../apps/api/src/modules/carpooling/carpooling.service.ts) | Baja | 6 |
| DT-25 | Validación de entrada dispar: esquemas en unos módulos, condiciones manuales en otros | Controladores | Baja | 3 |
| DT-26 | Dos funciones distintas de escape de HTML; el contenido se guarda ya escapado | [feed.service.ts](../../apps/api/src/modules/feed/feed.service.ts), [carpooling.controller.ts](../../apps/api/src/modules/carpooling/carpooling.controller.ts) | Baja | 5 |
| DT-27 | Catálogos y valores permitidos repetidos en tres lugares | [app/lib/unsch.constants.ts](../../apps/web/app/lib/unsch.constants.ts), [src/shared/constants/unsch.constants.ts](../../apps/api/src/shared/constants/unsch.constants.ts), [radar.service.ts](../../apps/api/src/modules/radar/radar.service.ts) | Media | 3 |
| DT-28 | Estados del radar aceptados en dos idiomas y contados por separado | [radar.service.ts](../../apps/api/src/modules/radar/radar.service.ts) | Media | 4 |
| DT-29 | Nombres de consulta preparada generados con los valores del filtro en el feed, lo que crea una consulta preparada distinta por cada combinación | [feed.repository.ts](../../apps/api/src/modules/feed/feed.repository.ts) | Baja | 5 |
| DT-30 | El tipo del token declara `jti`, que nunca se emite; `school_id` y `escuela_id` duplican el mismo valor | [jwt.ts](../../apps/api/src/config/jwt.ts), [auth.service.ts](../../apps/api/src/modules/auth/auth.service.ts) | Baja | 3 |
| DT-31 | Dependencia `cookie-parser` declarada y sin uso | [package.json](../../package.json) | Baja | 3 |
| DT-32 | `ts-node` se usa en los comandos de base de datos sin ser dependencia directa | [package.json](../../package.json) | Baja | 3 |

### Frontend

| ID | Problema | Evidencia | Prioridad | Etapa sugerida |
|---|---|---|---|---|
| DT-33 | Seis pantallas simuladas presentan como reales datos que no se comparten | [Inventario](01-inventario-de-implementacion.md) | Alta para la percepción del usuario | 5 a 7 |
| DT-34 | Carpooling tiene API probada y pantalla que no la usa | [CarpoolingDashboard.tsx](../../apps/web/components/ui/CarpoolingDashboard.tsx) | Media | 6 |
| DT-35 | Sin pruebas de frontend | — | Media | 3 |
| DT-36 | La lista de respaldo de escuelas puede enviar identificadores distintos de los de la base si la API falla | [register/page.tsx](../../apps/web/app/%28auth%29/register/page.tsx) | Baja | 5 |
| DT-37 | Componentes que mezclan presentación, estado y acceso a datos | [components/ui](../../apps/web/components/ui) | Baja | — |

### Operación

| ID | Problema | Evidencia | Prioridad | Etapa sugerida |
|---|---|---|---|---|
| DT-38 | Sin integración continua | Sin `.github/workflows` | Alta | 3 |
| DT-39 | Sin ruta de salud ni registro de solicitudes | [app.ts](../../apps/api/src/app.ts) | Alta | 3 |
| DT-40 | La API arranca aunque falte configuración obligatoria | [database.ts](../../apps/api/src/config/database.ts), [jwt.ts](../../apps/api/src/config/jwt.ts) | Media | 3 |
| DT-41 | Configuración de despliegue fuera del repositorio | [ADR-006](../06-decisiones-arquitectonicas/ADR-006-plataformas-de-despliegue.md) | Media | 3 |
| DT-42 | Sin entorno de preproducción | [Configuración y entornos](../05-despliegue-y-operacion/02-configuracion-y-entornos.md) | Media | 8 |
| DT-43 | Código y esquema se despliegan sin coordinación | [Proceso de entrega](../05-despliegue-y-operacion/03-proceso-de-entrega.md) | Alta | 3 |
| DT-44 | El cliente Redis deja de reintentar tras 5 fallos | [redis.ts](../../apps/api/src/config/redis.ts) | Media | 4 |
| DT-45 | Un solo paquete para frontend y backend; sin versión de Node declarada | [package.json](../../package.json) | Media | 3 |
| DT-46 | `.gitignore` excluye informes de sprint y de incidencias, que existen solo en una máquina | [.gitignore](../../.gitignore) | Baja | — |

## Diferencias entre documentación previa y código

Donde un documento anterior y el código no coinciden, vale el código.

| Documento | Afirmación | Lo que muestra el código |
|---|---|---|
| [README](../../README.md) | `npm run dev` ejecuta frontend y backend | Solo el backend; ambos se levantan con `npm run dev:all` ([package.json](../../package.json)). **Corregido en el README junto con esta documentación** |
| README | «18 suites» de pruebas | Hay 19 archivos de prueba entre [tests/unit](../../apps/api/tests/unit) y [tests/integration](../../apps/api/tests/integration). **Corregido en el README junto con esta documentación** |
| README | Biblioteca «sótano a tercer piso» | Pisos 1 a 4 ([radar.service.ts](../../apps/api/src/modules/radar/radar.service.ts)) |
| README | Banco de archivos, moderación automática y publicación de rutas descritos como características | Sin API; ver [Inventario](01-inventario-de-implementacion.md) |
| README | Canales de chat tras una coincidencia | Solo se genera un identificador |
| README | «Arquitectura moderna y robusta» | Es un monolito modular con la deuda listada arriba |
| [ETAPA_02](../migracion/ETAPA_02_ESTABILIZACION.md) | El índice único se llama `idx_carpooling_requests_active_unique` | Se llama `uq_active_carpooling_request` ([005_canonical_extensions.sql](../../apps/api/src/database/migrations/sql/005_canonical_extensions.sql)) |
| ETAPA_02 | La pantalla de ajustes envía el identificador real «en la actualización de perfil» | No existe ruta de actualización de perfil; la pantalla guarda en `localStorage` |
| ETAPA_02 | Carpooling opera «con bloqueo pesimista» | Cierto para la confirmación; la solicitud no bloquea filas y se apoya en el índice único |
| ETAPA_02 | Etapa «plenamente estabilizada y verificada» | Verificada con pruebas locales; la aplicación en la base remota solo consta de forma parcial |
| [ETAPA_01](../migracion/ETAPA_01_LINEA_BASE.md) y [RESULTADOS](../migracion/RESULTADOS_VERIFICACION.md) | El inicio de sesión en producción devuelve 500 | El 2026-10-12 devolvía 401 ante credenciales inexistentes: la situación cambió |
| [INVENTARIO](../migracion/INVENTARIO_CONFIGURACION.md) | Describe el estado de la etapa 1 | Posterior a él son el módulo de catálogos, el migrador nuevo y las pruebas reales |
| ETAPA_02 | Enlaza archivos con rutas locales de la forma `file:///d:/social_unsch/...` | Esos enlaces solo funcionan en la máquina donde se escribió el informe; en GitHub no resuelven |
| Contexto de esta tarea | Etapas 1 y 2 integradas en `e704b8a` | Correcto; `main` avanzó después a `8e56bfa`, que solo modifica el README |

Los informes de `migracion/` son registros de su momento: no se ha cambiado su contenido. En la etapa 3 solo se actualizaron sus enlaces a archivos que cambiaron de ubicación.

## Riesgos de la migración

| ID | Riesgo | Probabilidad | Impacto | Mitigación propuesta |
|---|---|---|---|---|
| RM-01 | La operación de varios servicios supera la capacidad de una persona | Alta | Alto | Pocos servicios; observabilidad antes de extraer; admitir detenerse |
| RM-02 | Arranques en frío multiplicados por el número de servicios | Alta, si los planes no cambian | Medio | Medir tras la etapa 4 antes de continuar |
| RM-03 | Pausa o pérdida de un servicio de datos por inactividad | Media; ya ocurrió según el informe de la etapa 1 | Alto | Respaldo periódico; comprobación programada de disponibilidad |
| RM-04 | Divergencia entre el monolito y el servicio extraído durante la convivencia | Media | Medio | Mismas pruebas para ambos; congelar cambios funcionales en el módulo |
| RM-05 | Pérdida de integridad al retirar claves foráneas entre dominios | Media | Alto | Subir de nivel de propiedad de datos de uno en uno ([ADR-005](../06-decisiones-arquitectonicas/ADR-005-propiedad-gradual-de-datos.md)) |
| RM-06 | Cambio de contrato inadvertido al mover código | Media | Alto | Formalizar el contrato y añadir pruebas de contrato en la etapa 3 |
| RM-07 | Migrar antes de completar las funciones simuladas reparte el esfuerzo | Alta | Medio | Decidir de forma explícita la prioridad entre construir y separar |
| RM-08 | Migración aplicada sobre producción sin ensayo | Media | Alto | Procedimiento con respaldo y ensayo aislado ([Proceso de entrega](../05-despliegue-y-operacion/03-proceso-de-entrega.md)) |
| RM-09 | Dependencia de configuración no versionada en cuatro paneles | Media | Medio | Versionar la configuración de despliegue |
| RM-10 | Exposición de datos de contacto al introducir llamadas entre servicios | Baja | Alto | Contrato de contacto restringido; nunca en eventos ni listados |

Probabilidad e impacto son estimaciones cualitativas, no mediciones.

## Qué atender primero

Con independencia de la migración, estos puntos protegen lo que ya funciona:

1. DT-18 y RM-03: respaldo de la base.
2. DT-10: retirar los ejecutores heredados.
3. DT-09: asegurar que el índice único existe en cada base.
4. DT-38 y DT-39: integración continua y ruta de salud.
5. DT-04: límite de frecuencia en las rutas públicas.
6. Verificar Redis en producción.

[← Índice](../README.md)
