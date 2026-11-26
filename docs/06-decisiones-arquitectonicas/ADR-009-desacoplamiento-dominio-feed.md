# ADR-009 · Preparación del dominio Feed para extracción futura

| Campo | Valor |
|---|---|
| Estado | **Propuesto — implementado en `codex/etapa-6-desacoplamiento-feed`** |
| Fecha de documentación | 2026-11-24 |
| Rama de implementación | `codex/etapa-6-desacoplamiento-feed` |
| Tipo | Decisión de la etapa 6 |

---

## 1. Contexto

La etapa 5 está ABIERTA: `apps/radar` no está desplegado y los 14 días de observación productiva no han comenzado. Según la estrategia de migración gradual (ADR-003), no se extrae ni se despliega otro servicio hasta que Radar esté en operación.

Dentro de ese bloqueo, el equipo puede ejecutar trabajo de desacoplamiento interno sin riesgo de afectar producción.

### 1.1 Estado previo del módulo Feed

| Aspecto | Estado antes de esta decisión |
|---|---|
| `FeedService` | Crea `FeedRepository` con `new` (sin inyección) |
| `FeedController` | Crea `FeedService` con `new` (sin inyección) |
| `FeedRepository.create()` | Llama directamente `pool.query` para recuperar metadatos del autor |
| Dependencia cruzada con Identidad | No documentada, mezclada en la implementación del repositorio |
| Tests de servicio | Verificaban comportamiento inspeccionando llamadas al pool SQL |
| Punto de composición | Ninguno: las instancias se creaban en el lugar de uso |

---

## 2. Problema

No existe un punto de composición explícito para el dominio Feed. Las dependencias entre capas están implícitas y la dependencia cruzada con el dominio Identidad (tabla `users`) no está encapsulada ni documentada.

Esto implica que, si el dominio se extrajera hoy:
- No habría un lugar único en el que sustituir el acceso a PostgreSQL por una llamada HTTP al servicio Identidad.
- Los tests unitarios del servicio dependen del pool, mezclando pruebas de lógica de negocio con pruebas de SQL.
- No hay un contrato formal que documente qué datos son propiedad de Feed y cuáles los toma prestados de otro dominio.

---

## 3. Decisión

**Preparar los límites internos del dominio Feed sin extraerlo a un proceso separado.**

La preparación incluye:

| Elemento | Decisión |
|---|---|
| `ports.ts` | Define `IFeedRepository` e `IAuthorMetaReader` como puertos del dominio |
| `PgAuthorMetaAdapter` | Encapsula el acceso cruzado a `users`; es el único punto que se cambiaría por `HttpAuthorMetaAdapter` al extraer |
| `FeedRepository` | Implementa `IFeedRepository`; recibe pool e `IAuthorMetaReader` por constructor |
| `FeedService` | Recibe `IFeedRepository` por constructor (valor por defecto para retro-compatibilidad) |
| `FeedController` | Recibe `FeedService` por constructor |
| `createFeedRouter(deps)` | Punto de composición; es el punto de sustitución que `app.ts` usará en lugar del router estático |
| `AppDependencies.feedRouter` | Registra el router de Feed como dependencia inyectable de la aplicación |

**PostgreSQL permanece compartido.** No se eliminan claves foráneas ni se separan bases de datos.

**El dominio permanece en `apps/api`.** No se crea ningún proceso nuevo.

---

## 4. Alternativas consideradas

### 4.1 No hacer cambios en esta fase

Válido si el bloqueo de Radar fuera temporal y la extracción estuviera inmediatamente disponible. En la situación actual (Radar sin desplegar, observación sin iniciar), no hacer nada llevaría la deuda técnica a la siguiente fase sin datos de operación.

### 4.2 Extraer Feed ahora como servicio independiente

Rechazado. Contra-indica ADR-003 y el criterio explícito de la etapa 5: *"La extracción de Identidad, Comunidad o cualquier otro dominio queda bloqueada hasta resolver estos criterios y evaluar la experiencia operativa de Radar."*

### 4.3 Desacoplar también Matchmaking

Matchmaking es el segundo candidato dentro del dominio Comunidad, pero no tiene API de creación de perfiles/proyectos, comparte más invariantes con `users` y no muestra evidencia de necesitar escalado independiente. La relación beneficio/riesgo es peor que Feed en este momento.

---

## 5. Dominio seleccionado: Feed

### 5.1 Matriz de candidatos

| Dominio | Tablas propias | Frontend real | Lógica cohesiva | JOIN usuarios | TX compartida | Riesgo | Beneficio |
|---|---|---|---|---|---|---|---|
| **Feed** | `feed_posts` | Sí | Alta | 1 (JOIN + 1 select) | No | **Bajo** | **Alto** |
| Matchmaking | `matchmaking_*` | Parcial | Alta | 2 | Sí (doble match) | Medio | Medio |
| Carpooling | `carpooling_*` | **Simulado** | Alta | Dentro de TX | Sí (asientos) | Alto | Bajo |
| Identidad | `users`, catálogos | Sí | Muy alta | Es la fuente | Sí | **Muy alto** | Alto |
| Catálogos | `faculties`, escuelas | Sí | Muy baja | No | No | Bajo | Muy bajo |

Feed gana por:
1. Única tabla de propiedad (`feed_posts`).
2. Frontend completamente conectado a la API (no simulado).
3. Lógica de negocio cohesiva y mínima: validación, XSS y paginación.
4. Dependencia cruzada con Identidad encapsulable en un adaptador de un solo método.
5. No participa en transacciones compartidas.

### 5.2 Responsabilidades incluidas

- Publicar contenido textual (create).
- Listar publicaciones con filtros académicos y paginación (list).
- Validación de contenido (longitud, XSS).
- Regla de visibilidad (`is_visible = true`).

### 5.3 Responsabilidades excluidas

- Moderación (tablas sin módulo; se decide en el dominio Comunidad).
- Catálogos académicos (propietario: Identidad).
- Identidad del publicador (solo se consulta para visualización).

### 5.4 Datos de propiedad

| Tabla | Estado en esta fase |
|---|---|
| `feed_posts` | Propietario lógico: Feed. Acceso físico: PostgreSQL compartido |
| `users` | Propietario lógico: Identidad. Feed la lee vía `IAuthorMetaReader` |

### 5.5 Dependencias externas

| Dependencia | Acceso actual | Punto de sustitución |
|---|---|---|
| Identidad: `users.full_name`, `users.role` | `PgAuthorMetaAdapter` → `SELECT FROM users` | Reemplazar `PgAuthorMetaAdapter` por `HttpAuthorMetaAdapter` |
| Identidad: JOIN en `findFiltered` | SQL dentro de `FeedRepository.findFiltered` | Denormalizar `author_name`/`author_role` en `feed_posts` o añadir segunda consulta |

---

## 6. Consistencia requerida

- La creación de un post es una operación simple de INSERT sin transacción multi-tabla. No hay riesgo de inconsistencia.
- Si en la extracción futura la lectura de metadatos del autor fallara (HTTP a Identidad no disponible), el post se crearía sin datos de autor. Decisión a tomar en la etapa de extracción: rechazar la publicación o almacenar y rellenar en diferido.

---

## 7. Riesgos y compensaciones

| Riesgo | Compensación |
|---|---|
| JOIN en `findFiltered` no está en el adaptador explícito | Documentado en `ports.ts`; se aborda en la extracción real |
| `pool as any` en `composition.ts` | Coerción necesaria por incompatibilidad de tipos entre el pool del paquete `pg` y el tipado interno; sin impacto en tiempo de ejecución |
| Los tests de integración crean `FeedRepository` con el pool mockeado a nivel de módulo | El comportamiento es idéntico al anterior; comprobado ejecutando la suite |

---

## 8. Criterios para autorizar la extracción (etapa 7)

1. Radar desplegado y con 14 días de observación productiva sin incidentes bloqueantes.
2. Medición de latencia real de un servicio en Render (Radar proporciona la referencia).
3. Decisión sobre cómo manejar el JOIN de autores al separar las bases (denormalización vs. llamada HTTP a Identidad).
4. Decisión sobre consistencia en creación de post si Identidad no está disponible.
5. Plan de migración de datos de `feed_posts` a su propia base, con rollback verificado.

---

## 9. Evidencias en el código

| Elemento | Ruta |
|---|---|
| Puertos | [apps/api/src/modules/feed/ports.ts](../../apps/api/src/modules/feed/ports.ts) |
| Adaptador de autor | Entonces en `apps/api/src/modules/feed/adapters/pg-author-meta.adapter.ts`; desde la etapa 8 vive una sola vez en [packages/feed-domain/src/pg-feed.repository.ts](../../packages/feed-domain/src/pg-feed.repository.ts) |
| Repositorio | [apps/api/src/modules/feed/feed.repository.ts](../../apps/api/src/modules/feed/feed.repository.ts) |
| Servicio | [apps/api/src/modules/feed/feed.service.ts](../../apps/api/src/modules/feed/feed.service.ts) |
| Controlador | [apps/api/src/modules/feed/feed.controller.ts](../../apps/api/src/modules/feed/feed.controller.ts) |
| Módulo/composición | [apps/api/src/modules/feed/feed.module.ts](../../apps/api/src/modules/feed/feed.module.ts) |
| Composición principal | [apps/api/src/composition.ts](../../apps/api/src/composition.ts) |
| Dependencias de la app | [apps/api/src/app.ts](../../apps/api/src/app.ts) |

[← Índice de ADR](README.md)
