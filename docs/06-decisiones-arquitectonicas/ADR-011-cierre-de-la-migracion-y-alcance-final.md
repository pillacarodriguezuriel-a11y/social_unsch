# ADR-011 · Cierre de la migración: alcance final, orden de activación y detención de nuevas extracciones

| Campo | Valor |
|---|---|
| Estado | **Propuesto — implementado en `codex/etapa-8-cierre-migracion`** |
| Fecha de documentación | 2026-11-25 |
| Rama de implementación | `codex/etapa-8-cierre-migracion` |
| Tipo | Decisión de la etapa 8 |
| Decisiones anteriores | ADR-003 (migración gradual), ADR-008 (extracción de Radar), ADR-009 y ADR-010 (Feed) |
| Reemplaza numeración de | Plan de migración, etapas 6 a 8 (*Movilidad*, *Recursos*, *Consolidación*) |

---

## 1. Contexto

Al abrir la etapa 8, `main` (`452f9d6`) contiene el código de las etapas 1 a 7: el monorepo con límites y contratos, `apps/radar` y `apps/feed` como servicios independientes, y el enrutamiento reversible por configuración (`RADAR_MODE`, `FEED_MODE`). Ambos modos remotos están **desactivados por defecto**.

Tres hechos condicionan el cierre:

1. **Ningún servicio extraído está desplegado.** El 2026-11-23 el dominio previsto para Radar devolvía 404; `apps/feed` nunca se desplegó. En producción la API atiende los dos dominios en proceso.
2. **El presupuesto no está decidido.** Render Free suspende tras 15 min sin tráfico, con arranque en frío de 27–60 s, superior al timeout máximo configurable del proxy (30 s). Activar un proxy contra un servicio en plan Free produce 504 sistemáticos. Salir de Free cuesta $7/mes por servicio y la decisión es del propietario.
3. **La numeración del plan quedó obsoleta.** El plan numera las etapas 6, 7 y 8 como *Movilidad*, *Recursos* y *Consolidación*, pero el propietario adelantó Feed —parte del dominio *Comunidad*, que el plan había diferido— y esas etapas se ejecutaron con contenido distinto.

### 1.1 Restricciones operativas activas

- No se ejecutan migraciones sobre Supabase ni se modifican variables de Render, Vercel o Upstash.
- No se contratan recursos ni se aumentan costos.
- No se hace merge que active producción ni despliegue sin autorización explícita y concreta.
- No se declara desplegado lo que solo está implementado y probado.

---

## 2. Decisión

**2.1 El alcance final de esta fase queda cerrado en cinco piezas:** `apps/web`, `apps/api`, `apps/radar`, `apps/feed`, más PostgreSQL y Redis. **No se extrae ningún otro dominio.** Identidad, Comunidad (salvo Feed), Movilidad, Recursos y Moderación permanecen dentro de `apps/api`. Las etapas *Movilidad* y *Recursos* del plan quedan **no ejecutadas y fuera de este cierre**; su reapertura exige una decisión nueva apoyada en la experiencia operativa real de Radar y Feed.

**2.2 El sistema no se describe como «microservicios independientes».** Feed comparte PostgreSQL con la API y lee `users` mediante `JOIN`. Es un **proceso independiente sobre datos compartidos**. La propiedad de datos por dominio sigue siendo propuesta (ADR-005).

**2.3 La lógica compartida vive una sola vez.** `packages/feed-domain` concentra el servicio de dominio, el repositorio SQL, el lector de metadatos de autor y los manejadores HTTP; `apps/api` y `apps/feed` solo aportan cableado y el adaptador de Express. El paquete no tiene dependencias de ejecución: el acceso a datos entra por un puerto estructural (`SqlQueryable`) que `pg.Pool` satisface. Así los modos local y proxy no pueden divergir en validación, códigos de error ni SQL.

**2.4 El contrato de Feed es verificable en los dos modos.** `packages/contracts/src/feed.ts` define las rutas, los esquemas y los códigos de error, y dos pruebas de contrato espejo —una en `apps/api`, otra en `apps/feed`— comprueban las respuestas reales contra los mismos esquemas.

**2.5 El orden de activación es estricto y secuencial:**

1. Desplegar Radar sin tráfico y verificarlo aislado.
2. Activar `RADAR_MODE=proxy` y cumplir su periodo de observación de 14 días.
3. Solo con Radar estable, desplegar Feed sin tráfico y verificarlo aislado.
4. Activar `FEED_MODE=proxy` e iniciar su propio periodo de observación.

**Nunca se cambian los dos modos a la vez.** Cada activación requiere autorización explícita del propietario y deja al otro servicio como estaba.

**2.6 Los umbrales de Feed son propuestos, no aprobados.** `scripts/benchmark-feed.js` mide lecturas, escrituras y arranque en frío comparando local y proxy, pero emite sus veredictos como **EXPLORATORIOS** hasta que el propietario apruebe los umbrales. Ninguna medición exploratoria cuenta como criterio cumplido.

**2.7 El cierre operativo permanece abierto.** La migración se declara «completada en producción» solo cuando los seis criterios del [cierre verificable](../migracion/ETAPA_08_CIERRE_MIGRACION.md#12-cierre-verificable) estén cumplidos. Hoy se cumplen los tres primeros (código, CI, integración) y faltan los tres últimos (despliegue, modos remotos activos, validación operativa).

---

## 3. Consecuencias

### 3.1 Positivas

| Consecuencia | Detalle |
|---|---|
| Divergencia local/proxy estructuralmente imposible | Un cambio de filtro, orden o mensaje de error afecta a los dos modos a la vez |
| Contrato de Feed comprobable | Dos pruebas espejo validan las respuestas reales contra los mismos esquemas |
| Riesgo de activación acotado | Un modo a la vez, con reversión por configuración y sin fallback automático |
| Alcance explícito | Se detiene la expansión a Movilidad y Recursos antes de tener evidencia operativa |
| Honestidad del estado | Implementado, desplegado y validado se informan por separado |

### 3.2 Negativas y riesgos

| Riesgo | Mitigación |
|---|---|
| El cierre queda incompleto por falta de presupuesto y accesos | Documentado como bloqueo externo con acciones exactas; el modo local sigue operativo e íntegro |
| Dos implementaciones del enrutamiento (local y proxy) conviven | Se retira la local solo tras el periodo de observación en verde |
| Feed sin independencia de datos puede dar falsa sensación de aislamiento | Declarado explícitamente aquí y en la documentación de datos; `apps/feed` cae por separado de la API, pero una caída de PostgreSQL afecta a ambos |
| Umbrales de Feed sin aprobar | Las mediciones se marcan exploratorias; no habilitan la activación |
| El presupuesto de conexiones crece al desplegar Feed | API `max: 20` + Feed `max: 10` = 30; debe validarse contra el límite del plan de Supabase antes de activar |

---

## 4. Alternativas consideradas

| Alternativa | Por qué se descartó |
|---|---|
| Declarar la migración completada al tener CI en verde | Confundiría código terminado con sistema operando; ningún servicio extraído está desplegado |
| Activar Radar y Feed en la misma ventana | Impide atribuir una degradación a un servicio y duplica el riesgo de la reversión |
| Mantener la lógica de Feed duplicada en ambos procesos | Ya había divergido en nombres y comentarios; el siguiente cambio habría separado el comportamiento de los dos modos en silencio |
| Dar a `feed-domain` una dependencia de `pg` para compartir el repositorio | Rompería el límite `feed-domain-puro`; el puerto estructural logra lo mismo sin dependencias |
| Continuar con Movilidad y Recursos según el plan | No hay evidencia operativa de que la extracción aporte beneficio; el alcance acordado se detiene aquí |
| Evitar la suspensión del plan Free con latidos periódicos | Elude el límite del proveedor en lugar de resolverlo y falsea la medición del arranque en frío |

---

## 5. Cumplimiento verificable

| Afirmación de este ADR | Cómo comprobarla |
|---|---|
| La lógica de Feed no está duplicada | `packages/feed-domain/src/pg-feed.repository.ts` es la única implementación del SQL; `apps/*/modules/feed` solo cablea |
| `feed-domain` no tiene dependencias de ejecución | `npm run check:boundaries` (regla `feed-domain-puro`) |
| El contrato se cumple en los dos modos | `apps/api/tests/contract/feed.contract.test.ts` y `apps/feed/tests/contract/feed.contract.test.ts` |
| El modo local sigue siendo el predeterminado | `apps/api/src/config/env.ts` y `apps/api/tests/unit/env.test.ts` |
| La reversión funciona | `tests/e2e/feed.e2e.test.js`, paridad proxy ↔ local |
| Ningún servicio extraído está desplegado | `npm run ops:probe` con `PROBE_RADAR` y `PROBE_FEED` |

[← Registros de decisión](README.md) · [Etapa 8](../migracion/ETAPA_08_CIERRE_MIGRACION.md)
