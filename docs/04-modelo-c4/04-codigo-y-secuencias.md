# C4 · Código y secuencias

**Pregunta:** ¿qué clases, funciones e interfaces realizan los flujos arquitectónicamente importantes?
**Describe:** el código de la `main` (`b763885`). Solo se dibujan flujos seleccionados, no todo el repositorio.

| Flujo | Sección |
|---|---|
| Radar: API en modo local | [A1](#a1-radar-en-la-api) |
| Radar: reporte con consenso | [A2](#a2-secuencia-reporte-con-consenso) |
| Radar: servicio y proxy | [A3](#a3-radar-a-través-del-proxy) |
| Autenticación | [B](#b-autenticación) |
| Catálogos | [C](#c-catálogos) |
| Carpooling | [D](#d-carpooling) |
| Dirección hexagonal | [E](#e-nivel-de-código-y-arquitectura-hexagonal) |

## A1. Radar en la API

```mermaid
classDiagram
    class RadarModule {
        <<interface>>
        +mode: local o proxy
        +router: Router
        +checkReady() Promise
    }
    class RadarStore {
        <<interface>>
        +getStatus() Promise
        +submitReport(node, statusValue, userId, fieldName, allSets) Promise
    }
    class RadarController {
        +getStatus(req, res, next)
        +submitReport(req, res, next)
    }
    class RadarService {
        -allowedNodes
        +getStatus()
        +submitReport(node, status, userId)
    }
    class RadarRepository {
        -luaVoteScript: string
        +getStatus()
        +submitReport(...)
    }
    class AppError {
        +statusCode: number
        +errorCode: string
    }

    RadarController --> RadarService : recibe por constructor
    RadarService --> RadarStore : depende del puerto
    RadarRepository ..|> RadarStore : implementa
    RadarService ..> AppError : lanza
    RadarModule ..> RadarController : modo local
```

| Elemento | Archivo |
|---|---|
| `RadarModule`, `createLocalRadarModule` | [radar.module.ts](../../apps/api/src/modules/radar/radar.module.ts) |
| `createRadarProxyModule` | [radar.proxy.ts](../../apps/api/src/modules/radar/radar.proxy.ts) |
| `RadarController` | [radar.controller.ts](../../apps/api/src/modules/radar/radar.controller.ts) |
| `RadarService` | [radar.service.ts](../../apps/api/src/modules/radar/radar.service.ts) |
| `RadarStore`, `RadarRepository` | [radar.repository.ts](../../apps/api/src/modules/radar/radar.repository.ts) |
| Composición | [composition.ts](../../apps/api/src/composition.ts) |

`RadarStore` es el único puerto de comportamiento del backend. `createAppResources` elige la unidad según `RADAR_MODE`, crea el cliente Redis solo en modo local y `createApp` monta el enrutador resultante sin conocer el modo.

## A2. Secuencia: reporte con consenso

`POST /api/v1/radar/report` en modo local.

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario
    participant W as CampusRadar
    participant A as requireAuth
    participant C as RadarController
    participant S as RadarService
    participant R as RadarRepository
    participant D as Redis

    U->>W: elige un estado
    W->>A: POST /radar/report con token
    alt token ausente o inválido
        A-->>W: 401
    end
    A->>C: req.user
    C->>C: comprobar node y status
    C->>S: submitReport(node, status, userId)
    alt nodo o estado no válido
        S-->>W: 400 mediante AppError
    end
    S->>R: submitReport(..., conjuntos del nodo)
    R->>D: EVAL script de votación
    Note over D: comprueba voto previo, registra, cuenta<br/>y con 3 votos publica el estado
    D-->>R: actualizado, votos, mensaje
    alt consenso alcanzado
        C-->>W: 200 updated true
    else faltan votos
        C-->>W: 200 updated false, votos actuales
    end
```

El consenso es atómico porque vive en el script Lua, no en el servicio.

## A3. Radar a través del proxy

**Estado: IMPLEMENTADO PARCIALMENTE.** Código en `main`; el servicio sin desplegar y el proxy sin activar.

```mermaid
sequenceDiagram
    autonumber
    participant W as Aplicación web
    participant L as Logging de la API
    participant P as createRadarProxyModule
    participant G as createRadarAuthGuard
    participant C as RadarController de apps/radar
    participant S as RadarService
    participant D as Redis

    W->>L: /api/v1/radar/status con Bearer
    L->>L: valida o genera x-request-id
    L->>P: solicitud
    P->>G: mismo método, ruta, query y Authorization
    alt token no válido
        G-->>W: 401 con el código del contrato
    end
    G->>C: req.user derivado del token
    C->>S: getStatus()
    S->>D: pipeline de 7 HGETALL
    D-->>S: hashes
    S-->>W: 200 a través del proxy
    alt fallo de conexión
        P-->>W: 502 ERR_RADAR_UPSTREAM_UNAVAILABLE
    else vence el límite de tiempo
        P-->>W: 504 ERR_RADAR_UPSTREAM_TIMEOUT
    end
```

Archivos: [radar.proxy.ts](../../apps/api/src/modules/radar/radar.proxy.ts), [apps/radar/src/app.ts](../../apps/radar/src/app.ts), [auth.middleware.ts de Radar](../../apps/radar/src/middlewares/auth.middleware.ts).

El proxy hace **un solo intento**: repetir un `POST` podría duplicar efectos, y no recurre al Radar local sin que lo decida el operador.

## B. Autenticación

```mermaid
classDiagram
    class AuthController {
        -authService: AuthService
        +register(req, res, next)
        +login(req, res, next)
    }
    class AuthService {
        -authRepository: AuthRepository
        +register(input)
        +login(email, passwordPlain)
    }
    class AuthRepository {
        +findByEmail(email)
        +findById(id)
        +create(input)
    }
    class TokenPayload {
        <<interface>>
        user_id
        role
        school_id
        has_accepted_terms
        facultad_id
        escuela_id
        ciclo
    }
    AuthController --> AuthService : crea con new
    AuthService --> AuthRepository : crea con new
    AuthService ..> TokenPayload : firma
```

```mermaid
sequenceDiagram
    autonumber
    participant W as Inicio de sesión
    participant C as AuthController
    participant S as AuthService
    participant R as AuthRepository
    participant D as PostgreSQL
    participant J as config/jwt

    W->>C: POST /auth/login
    C->>C: loginSchema.parse
    C->>S: login(email, password)
    S->>R: findByEmail(email)
    R->>D: SELECT users LEFT JOIN professional_schools
    D-->>R: fila o vacío
    alt usuario inexistente o contraseña incorrecta
        S-->>W: 401 ERR_AUTH_INVALID_CREDENTIALS
    end
    S->>S: bcrypt.compare
    S->>J: signAccessToken con RS256 y 24 h
    J-->>S: token
    S-->>W: 200 con token y usuario
    W->>W: guarda token y usuario en localStorage
```

Después, cada ruta protegida pasa por `requireAuth`, que extrae el Bearer y llama a `verifyAccessToken`. No se consulta la base. Los errores son `ERR_AUTH_TOKEN_MISSING`, `ERR_AUTH_INVALID_TOKEN` y `ERR_AUTH_TOKEN_EXPIRED`.

| Elemento | Archivo |
|---|---|
| Rutas y controlador | [auth.routes.ts](../../apps/api/src/modules/auth/auth.routes.ts), [auth.controller.ts](../../apps/api/src/modules/auth/auth.controller.ts) |
| Validadores | [auth.validators.ts](../../apps/api/src/modules/auth/auth.validators.ts) |
| Servicio y repositorio | [auth.service.ts](../../apps/api/src/modules/auth/auth.service.ts), [auth.repository.ts](../../apps/api/src/modules/auth/auth.repository.ts) |
| Tokens y guarda | [jwt.ts](../../apps/api/src/config/jwt.ts), [auth.middleware.ts](../../apps/api/src/middlewares/auth.middleware.ts) |
| Política de roles | [roles.ts](../../apps/api/src/shared/auth/roles.ts) |

Limitaciones observadas: no hay renovación ni revocación, y el campo `jti` declarado en `TokenPayload` no se emite. Además, el registro normaliza el correo a minúsculas pero la búsqueda no: ver DT-47 en [Riesgos y deuda técnica](../07-evaluacion-y-evolucion/02-riesgos-y-deuda-tecnica.md).

## C. Catálogos

```mermaid
sequenceDiagram
    autonumber
    participant F as Formulario de registro o ajustes
    participant H as useCatalogs
    participant L as loadCatalogs
    participant C as CatalogsController
    participant D as PostgreSQL

    F->>H: montar componente
    H->>L: loadCatalogs()
    L->>C: GET /api/v1/catalogs, ruta pública
    C->>D: 3 SELECT con Promise.all
    D-->>C: facultades, escuelas, pabellones
    C-->>L: 200 con IDs reales
    L->>L: parseCatalogResponse
    L-->>H: CatalogData
    H-->>F: escuelas agrupadas por facultad
    F->>F: resolveSchoolSelection antes de enviar
```

| Pregunta | Respuesta | Evidencia |
|---|---|---|
| ¿Cómo se consultan? | El controlador usa el pool directamente, sin servicio ni repositorio | [catalogs.controller.ts](../../apps/api/src/modules/catalogs/catalogs.controller.ts) |
| ¿Cómo se conservan los IDs? | `loadCatalogs` resuelve por clave natural, nunca actualiza claves primarias y aborta ante correspondencias ambiguas | [load_catalogs.ts](../../apps/api/src/database/migrations/load_catalogs.ts) |
| ¿Cómo se serializan cargas simultáneas? | Bloqueo `SHARE ROW EXCLUSIVE` en una transacción | [load_catalogs.ts](../../apps/api/src/database/migrations/load_catalogs.ts) |
| ¿Cómo los usa el frontend? | Solo envía IDs presentes en el catálogo cargado. Si falla, deshabilita la selección; ya no usa constantes locales | [catalogs.ts](../../apps/web/app/lib/catalogs.ts), [useCatalogs.ts](../../apps/web/app/lib/useCatalogs.ts) |

## D. Carpooling

**Estado: IMPLEMENTADO PARCIALMENTE.** La API está completa para listar, solicitar y confirmar; la pantalla usa `localStorage` y no existe ruta para publicar ni rechazar.

```mermaid
classDiagram
    class CarpoolingController {
        +getRoutes(req, res, next)
        +requestSeat(req, res, next)
        +confirmSeat(req, res, next)
    }
    class CarpoolingService {
        +getActiveRoutes(originDistrict)
        +requestSeat(routeId, passengerId, options)
        +confirmSeat(routeId, driverId, passengerId)
    }
    class CarpoolingRepository {
        +findActiveRoutes(originDistrict)
        +findRouteById(routeId)
        +findRequest(routeId, passengerId)
        +createRequestTransaction(routeId, passengerId, options)
        +confirmBookingTransaction(routeId, driverId, passengerId)
    }
    CarpoolingController --> CarpoolingService : crea con new
    CarpoolingService --> CarpoolingRepository : crea con new
```

```mermaid
sequenceDiagram
    autonumber
    participant X as Cliente HTTP
    participant C as CarpoolingController
    participant S as CarpoolingService
    participant R as CarpoolingRepository
    participant D as PostgreSQL

    X->>C: PATCH confirm con passenger_id
    C->>S: confirmSeat(routeId, driverId, passengerId)
    S->>R: confirmBookingTransaction(...)
    R->>D: BEGIN
    R->>D: SELECT ruta FOR UPDATE
    Note over R: existe, es su conductor y quedan asientos
    R->>D: SELECT solicitud FOR UPDATE
    Note over R: existe y está en SEAT_REQUESTED
    R->>D: UPDATE solicitud a SEAT_CONFIRMED
    R->>D: UPDATE ruta, asientos menos 1
    R->>D: SELECT contactos de conductor y pasajero
    alt alguna comprobación falla
        R->>D: ROLLBACK
        S-->>X: 400, 403 o 404 mediante AppError
    else todo correcto
        R->>D: COMMIT
        C-->>X: 200 con contactos
    end
```

| Operación | Transacción | Protección de concurrencia |
|---|---|---|
| Solicitar asiento | `createRequestTransaction`: lee metadatos e inserta en una sesión | Índice único parcial `uq_active_carpooling_request`; el error `23505` se traduce a `ERR_CARPOOLING_DUPLICATE_REQUEST` |
| Confirmar asiento | `confirmBookingTransaction` | `FOR UPDATE` sobre ruta y solicitud |

Persistencia: `carpooling_routes`, `carpooling_requests`; lectura de `users` y `professional_schools`. Código de prueba presente en producción: `injectedFailure` y un cliente alternativo si `pool.connect` no existe (DT-21).

## E. Nivel de código y arquitectura hexagonal

```mermaid
flowchart TB
    P["Presentación<br/>rutas, controladores"] --> A["Aplicación<br/>casos de uso"]
    A --> D["Dominio<br/>reglas"]
    A --> PU["Puertos<br/>interfaces"]
    I["Infraestructura y adaptadores<br/>Redis, PostgreSQL"] -. "implementa" .-> PU
```

> Las dependencias deben apuntar hacia el dominio y los casos de uso, no hacia la infraestructura.

**Estado: IMPLEMENTACIÓN PARCIAL / DIRECCIÓN ARQUITECTÓNICA PROPUESTA.**

| Condición | Radar | Demás módulos |
|---|---|---|
| Puerto de almacenamiento | Sí: `RadarStore` | No |
| Dependencias inyectadas | Sí, por constructor | No: `new` en campos privados |
| Composición explícita | Sí: `composition.ts`, `apps/radar/src/app.ts` | No |
| Dominio separado de la aplicación | No: `RadarService` reúne ambos y mantiene los valores permitidos | No |
| Puerto ubicado en el centro | No: `RadarStore` se declara en el archivo del adaptador, y el servicio importa de `radar.repository.ts` | No aplica |
| Regla sin dependencia de HTTP | Parcial: `RadarService` lanza errores con estado HTTP | No |

Radar es, por tanto, un primer paso hacia puertos y adaptadores, no una arquitectura hexagonal terminada.

## Qué enseñan estos diagramas

| Observación | Dónde se ve |
|---|---|
| El flujo sigue el camino middleware, controlador, servicio, repositorio | Todas las secuencias |
| Las reglas atómicas viven en el almacén o en el repositorio | Script Lua y transacción de confirmación |
| La identidad llega resuelta desde el token | `req.user` en Radar y carpooling |
| La frontera de Radar es HTTP y clave pública; no comparte código con la API | Secuencia A3 |

**Nivel anterior:** [C3 · Componentes](03-componentes-del-backend.md) · **Trazabilidad:** [Requisito a código](07-trazabilidad-c4.md)

[← Guía del modelo C4](README.md) · [← Índice](../README.md)
