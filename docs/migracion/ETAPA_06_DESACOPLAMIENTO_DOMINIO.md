# Etapa 6 · Selección y desacoplamiento interno del dominio Feed

| Dato | Valor |
|---|---|
| Fecha | 2026-11-24 |
| Rama | `codex/etapa-6-desacoplamiento-feed` |
| Resultado | **PREPARACIÓN INTERNA COMPLETADA** · Extracción no realizada · Despliegue no realizado |
| ADR | [ADR-009](../06-decisiones-arquitectonicas/ADR-009-desacoplamiento-dominio-feed.md) |
| Bloqueo activo | Radar sin desplegar (P-05) y sin 14 días de observación |

---

## 1. Punto de partida verificado

### 1.1 Estado de la etapa 5 (sin asumir el informe anterior)

| Elemento | Estado comprobado |
|---|---|
| Rama `codex/etapa-5-operacion-radar` | Activa; commit `d616f9b` (optimización proxy nativo) |
| `apps/radar` en producción | **NO DESPLEGADO** (404 en `social-unsch-radar.onrender.com`) |
| Activación de `RADAR_MODE=proxy` | **NO REALIZADA** |
| Observación operativa 14 días | **NO INICIADA** |
| CI en `main` (`52e12dc`) | Verde (`verify`, `test-real`, `e2e-radar`) |
| API producción (`/health/ready`) | `ready` con `database: up`, `radar: up` (observación puntual 2026-11-23) |

**Conclusión:** la etapa 5 está ABIERTA. No se declara completada. No se despliega ni extrae ningún otro servicio. Esta etapa 6 se limita a preparación interna.

### 1.2 Bloqueos registrados

| ID | Descripción | Impacto sobre etapa 6 |
|---|---|---|
| P-05 | Radar sin desplegar ni activar | Bloquea extracción de cualquier dominio |
| P-24 | Sobrecarga proxy pendiente de validar en plataforma real | Bloquea activación proxy |
| P-25 | PostgreSQL de producción inestable (causa sin confirmar) | Bloquea pruebas end-to-end contra producción |

Decisión: continuar con refactorizaciones internas que no requieran cambios en producción.

---

## 2. Línea base de pruebas antes de los cambios

| Comprobación | Referencia |
|---|---|
| `npm run verify` | Verde en CI `main` `52e12dc` ([45250089005](https://github.com/pillacarodriguezuriel-a11y/social_unsch/actions/runs/45250089005)) |
| Cobertura API | ≥ 92 % ramas (commit `d616f9b`) |
| Pruebas con dobles | 454/454 API, 61/61 Radar, 14/14 Web |
| Pruebas reales | 36/36 (commit `d616f9b`, CI `main`) |

---

## 3. Selección del dominio: Feed

### 3.1 Matriz de candidatos

| Dominio | Tablas propias | Frontend real | TX compartida | Riesgo extracción | Beneficio |
|---|---|---|---|---|---|
| **Feed** | `feed_posts` | Sí | No | **Bajo** | **Alto** |
| Matchmaking | `matchmaking_*` | Parcial (sin create) | Sí (double match) | Medio | Medio |
| Carpooling | `carpooling_*` | **Simulado** | Sí (asientos + usuarios) | Alto | Bajo |
| Identidad | `users`, catálogos | Sí | Sí (registro) | **Muy alto** | Alto |
| Catálogos | Tablas de referencia | Sí | No | Bajo | Muy bajo |

### 3.2 Justificación

Feed es el único dominio que reúne los cuatro criterios de baja fricción:
1. **Una sola tabla de propiedad** (`feed_posts`): no hay co-propietarios.
2. **Frontend completamente implementado**: no es una pantalla simulada.
3. **Sin transacciones compartidas**: la creación de un post no modifica tablas de otros dominios.
4. **Una dependencia cruzada encapsulable**: solo necesita `full_name` y `role` del autor, aislable en un adaptador de un método.

### 3.3 Por qué NO se elige otro dominio

- **Matchmaking**: no tiene API de creación de perfiles/proyectos; la máquina de estados del double match involucra filas de `users`; beneficio incierto.
- **Carpooling**: el frontend es simulado (localStorage), la confirmación requiere leer datos de contacto de `users` dentro de la transacción, y no hay API de creación de rutas.
- **Identidad**: es la tabla más compartida del sistema; extraerla requiere resolver las claves foráneas desde todos los dominios; es la última, no la primera.
- **Catálogos**: son de solo lectura, sin reglas de negocio; el beneficio no justifica el costo operativo de otro servicio.

---

## 4. Inventario de datos y dependencias del dominio Feed

### 4.1 Tablas

| Tabla | Propietario | Operaciones de Feed |
|---|---|---|
| `feed_posts` | **Feed** | INSERT, SELECT |
| `users` | Identidad | SELECT (nombre y rol para visualización) |

### 4.2 Claves foráneas desde `feed_posts`

| FK | Columna | Tabla destino | Acción al extraer |
|---|---|---|---|
| `fk_fp_user` | `feed_posts.user_id` | `users.id` | Eliminar FK; validar userId vía token o llamada a Identidad |
| `fk_fp_faculty` | `feed_posts.faculty_id` | `faculties.id` | Eliminar FK; cachear catálogos o validar con API de Identidad |
| `fk_fp_school` | `feed_posts.professional_school_id` | `professional_schools.id` | Ídem |

### 4.3 Consultas con JOIN entre dominios

| Consulta | Ubicación | Tipo de acceso | Decisión en esta fase |
|---|---|---|---|
| `findFiltered`: JOIN users | `FeedRepository.findFiltered` | SQL compartido (read) | Mantener; documentado en `ports.ts` como pendiente |
| `create`: SELECT from users | `PgAuthorMetaAdapter.getAuthorMeta` | SQL compartido (read) | **Encapsulado en el adaptador** |

### 4.4 Reglas de negocio invariantes

| Regla | Implementación | Prueba |
|---|---|---|
| Contenido no vacío | `FeedService.createPost` | `feed.service.test.ts` |
| Contenido ≤ 2000 caracteres | `FeedService.createPost` | `feed.service.test.ts` |
| XSS sanitization antes de persistir | `FeedService.sanitizeXSS` | `feed.service.test.ts` |
| Solo publicaciones visibles en feed | `FeedRepository.findFiltered` (WHERE is_visible = true) | `feed.repository.test.ts` |
| Paginación: 1 ≤ limit ≤ 50 | `FeedService.getFeed` | `feed.service.test.ts` |

---

## 5. Cambios en el código

### 5.1 Archivos nuevos

| Archivo | Descripción |
|---|---|
| `apps/api/src/modules/feed/ports.ts` | Puertos del dominio: `IFeedRepository`, `IAuthorMetaReader`, `IFeedPost` |
| `apps/api/src/modules/feed/adapters/pg-author-meta.adapter.ts` | Adaptador: lee metadatos del autor desde `users` |
| `apps/api/src/modules/feed/feed.module.ts` | Punto de composición: `createFeedRouter(deps)` |
| `docs/06-decisiones-arquitectonicas/ADR-009-desacoplamiento-dominio-feed.md` | Decisión arquitectónica |
| `docs/migracion/ETAPA_06_DESACOPLAMIENTO_DOMINIO.md` | Este documento |

### 5.2 Archivos modificados

| Archivo | Cambio |
|---|---|
| `apps/api/src/modules/feed/feed.repository.ts` | Implementa `IFeedRepository`; recibe pool e `IAuthorMetaReader` por constructor |
| `apps/api/src/modules/feed/feed.service.ts` | Recibe `IFeedRepository` por constructor (default: `new FeedRepository()`) |
| `apps/api/src/modules/feed/feed.controller.ts` | Recibe `FeedService` por constructor |
| `apps/api/src/app.ts` | `AppDependencies` incluye `feedRouter: Router`; monta desde `deps.feedRouter` |
| `apps/api/src/composition.ts` | Crea `feedRouter` vía `createFeedRouter({ pool })` |
| `apps/api/tests/helpers/test-app.ts` | Crea `feedRouter` con el pool mockeado |
| `apps/api/tests/unit/feed.service.test.ts` | Usa dobles de `IFeedRepository`; sin dependencia de `pool` |
| `apps/api/tests/unit/feed.repository.test.ts` | Usa pool e `IAuthorMetaReader` inyectados |
| `docs/06-decisiones-arquitectonicas/README.md` | Añade entrada ADR-009 |

### 5.3 Dependencias eliminadas

| Dependencia | Estado |
|---|---|
| `FeedService` → `new FeedRepository()` sin inyección | **Eliminada**: `FeedService` recibe `IFeedRepository` |
| `FeedRepository.create()` → `pool.query` para datos de autor | **Eliminada**: usa `IAuthorMetaReader` |
| `app.ts` → import estático de `feed.routes` | **Eliminada**: recibe `feedRouter` como dependencia |

### 5.4 Dependencias todavía presentes (documentadas)

| Dependencia | Localización | Razón para mantenerla |
|---|---|---|
| JOIN `feed_posts` → `users` en `findFiltered` | `FeedRepository.findFiltered` SQL | Eliminarla requiere separar bases o denormalizar; sin beneficio en esta fase |
| FK `feed_posts.user_id → users.id` | Base de datos | No se elimina FK hasta separar bases |
| FK `feed_posts.faculty_id` y `professional_school_id` | Base de datos | Ídem |
| `pool as any` en `composition.ts` | Coerción de tipos | El pool importado de `config/database` es compatible en tiempo de ejecución |

---

## 6. Verificación

### 6.1 Criterios de aceptación

| Criterio | Estado |
|---|---|
| Cero importaciones de código de otros módulos desde `feed` | ✅ Verificado (`check:boundaries`) |
| `IAuthorMetaReader` encapsula el acceso cruzado a `users` | ✅ `PgAuthorMetaAdapter` |
| `createFeedRouter` es el único punto de composición | ✅ `feed.module.ts` |
| `AppDependencies` recibe `feedRouter` como inyectable | ✅ `app.ts` |
| Tests de `FeedService` sin dependencia del pool | ✅ `feed.service.test.ts` usa dobles |
| Cobertura igual o superior a la línea base | A verificar con `npm run verify` |
| Compilación correcta | A verificar |
| CI verde sobre el commit final | Pendiente (push y CI) |

### 6.2 Pruebas relevantes

| Suite | Cobertura del desacoplamiento |
|---|---|
| `feed.service.test.ts` | Validaciones, XSS, paginación — sin pool |
| `feed.repository.test.ts` | SQL de `findFiltered` y `create`; `IAuthorMetaReader` inyectado |
| `feed.routes.test.ts` (integración) | Rutas HTTP, auth, errores — pool mockeado a nivel módulo |
| `feed_matchmaking.real.test.ts` | Feed contra PostgreSQL real (invariantes y rollback) |

---

## 7. Limitaciones

1. **El JOIN en `findFiltered` permanece**: encapsularlo requeriría un cambio de protocolo de datos o denormalización, lo cual está fuera del alcance de esta fase.
2. **PostgreSQL compartido**: no hay independencia física de datos. Esta etapa documenta la propiedad lógica; la separación física es etapa 7+.
3. **Sin prueba del proxy futuro**: el `feed.module.ts` define el punto de sustitución, pero no hay implementación de un adaptador remoto.
4. **`pool as any` en composition.ts**: el tipo `Pool` de `pg` y el tipo interno del pool difieren en genéricos; la coerción es segura en tiempo de ejecución.

---

## 8. Reversión

| Alcance | Cómo |
|---|---|
| Toda la etapa 6, antes de fusionar | No fusionar la rama |
| Toda la etapa 6, después de fusionar | `git revert` de los commits de la etapa; los cambios de producción son de código, no de datos |
| Sin impacto en producción | Esta etapa no modifica esquemas, migraciones ni variables de entorno |

---

## 9. Condiciones para iniciar la etapa 7 (extracción de Feed)

1. Radar desplegado en producción y con 14 días de observación sin incidentes bloqueantes.
2. Presupuesto confirmado para un segundo servicio en Render (Starter, sin suspensión).
3. Decisión sobre el JOIN de autores: denormalizar `author_name`/`author_role` en `feed_posts` o añadir llamada HTTP a Identidad.
4. Decisión sobre consistencia en `createPost` si Identidad no está disponible (rechazar o encolar).
5. Plan de migración de `feed_posts` a base independiente con rollback verificado.
6. CI verde sobre `main` con esta etapa fusionada.

---

[← Estrategia de migración](README.md) · [← Índice](../README.md)
