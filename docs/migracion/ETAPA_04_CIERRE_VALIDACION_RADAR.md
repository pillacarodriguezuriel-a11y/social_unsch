# Etapa 4 · Cierre: validación de la separación de Radar

> Registro histórico. La [etapa 5 vigente](ETAPA_05_OPERACION_RADAR.md) actualiza fusión/CI y salud, difiere Identidad/Comunidad y descarta usar latidos para evitar suspensión. Las recomendaciones de operación de este registro no autorizan cambios de producción.

| Dato | Valor |
|---|---|
| Fecha | 2026-11-23 |
| Commit evaluado | Línea base `3077b4b` de `main`; cambios hasta `fcee45d` en la rama `feat/etapa-5-validacion-radar` |
| Rama | `feat/etapa-5-validacion-radar` |
| Entorno local | Windows 11, Intel Core i5-12450H (12 hilos), Node 24.11.1, npm 11.6.2, Docker 29.0.1 |
| Entorno de CI | GitHub Actions, `ubuntu-latest`, Node 20.14.0 |
| Estado | **Parcial.** Separación validada en local y en CI. Un umbral de rendimiento no se cumple. Sin despliegue en producción, por alcance |

> **Por qué no se llama «Etapa 5».** La etapa 4 seguía abierta: CI en rojo desde su fusión, Radar sin desplegar, benchmark simulado y sin pruebas de `apps/radar` contra Redis real. Esta fase cierra esos pendientes. La etapa 5 del [plan](../07-evaluacion-y-evolucion/03-plan-de-migracion.md) sigue siendo Identidad y Comunidad, y no ha empezado.

## 1. Alcance

| Incluido | Excluido |
|---|---|
| Corregir la CI y ejecutar las pruebas reales en ella | Extraer otro dominio |
| Pruebas E2E con API y Radar compilados, PostgreSQL y Redis reales | Activar el proxy en producción |
| Ensayos de aislamiento de fallos en local | Cambiar variables remotas o contratar planes |
| Benchmark real que sustituye al simulado | Migraciones sobre Supabase |
| Corregir los defectos que las pruebas demostraron | Cambios de contrato |
| Preparar despliegue y reversión en Render | — |

## 2. Línea base (antes de cambiar nada)

| Comprobación | Resultado | Lectura |
|---|---|---|
| `npm ci` | Correcto | — |
| `npm run verify` en local | Correcto: 448 + 59 + 14 pruebas, límites sin infracciones, compilación | — |
| `npm run test:real` en local | **Correcto: 36 de 36** | El fallo de la CI no estaba en las pruebas |
| CI en `main` (`3077b4b`) | `verify` correcto, `test-real` **fallido** | Fallaba en las 5 ejecuciones desde el 2026-10-23 |
| API de producción `/health/ready` | **503 `database: down`, `radar: up`** | PostgreSQL de producción no respondía. No se intervino |
| Servicio Radar en Render | 404 | No desplegado |
| ¿La API de producción usa Radar independiente? | **No** | `radar: up` sin servicio remoto: Radar se atiende en proceso |

Una respuesta saludable de la API no prueba la separación: `/health/ready` informa `radar: up` tanto en modo local como en proxy.

## 3. Fallos encontrados y soluciones

| N.º | Fallo | Cómo se demostró | Solución | Prueba que lo cubre |
|---|---|---|---|---|
| F-1 | `test-real` fallaba en CI | Reproducido en local ocupando el puerto 55432 antes de ejecutar la suite: `docker run` del arnés fallaba en `globalSetup` | Se quitaron los `services` del job, que ocupaban los puertos del arnés | Job `test-real` |
| F-2 | Si fallaba el arranque de las pruebas reales, el contenedor quedaba huérfano | Tras F-1 quedó `social_unsch_test_pg_etapa2` | `startTestContainers` limpia si falla; el job elimina contenedores con `if: always()` | Job `test-real` |
| F-3 | Con Redis sin respuesta (conexión abierta), las solicitudes del radar quedaban pendientes indefinidamente | `docker pause` de Redis: la solicitud directa a Radar seguía abierta a los 15 s | `commandTimeout` de 1500 ms en los clientes Redis de API y Radar | E2E escenario 11; pruebas unitarias de `redis.ts` |
| F-4 | Con Redis caído, `GET /radar/status` respondía **200** con todos los nodos «indefinido» | E2E: `docker stop` de Redis | `getStatus` propaga el error de un comando del *pipeline*; responde 500 | E2E escenario 10; pruebas unitarias de ambos repositorios |
| F-5 | El arnés nuevo daba PostgreSQL por listo antes de tiempo | Migración fallida en la primera ejecución del benchmark | `pg_isready` por TCP | Benchmark y E2E |

F-3 y F-4 son defectos del código desplegado en producción: afectan también al modo local.

## 4. Cambios realizados

| Archivo | Cambio |
|---|---|
| [ci.yml](../../.github/workflows/ci.yml) | Sin `services` en `test-real`, limpieza siempre, job `e2e-radar`, ejecución en ramas `feat/**` |
| [test-environment.ts](../../apps/api/tests/real/helpers/test-environment.ts) | Limpieza de contenedores si falla el arranque |
| [redis.ts de la API](../../apps/api/src/config/redis.ts), [redis.ts de Radar](../../apps/radar/src/config/redis.ts) | `commandTimeout` |
| [radar.repository.ts de la API](../../apps/api/src/modules/radar/radar.repository.ts), [de Radar](../../apps/radar/src/modules/radar/radar.repository.ts) | Propagación de errores del *pipeline* |
| [radar-stack.js](../../scripts/lib/radar-stack.js) | Infraestructura real desechable compartida por E2E y benchmark |
| [radar.e2e.test.js](../../tests/e2e/radar.e2e.test.js) | 14 escenarios E2E |
| [benchmark-radar.js](../../scripts/benchmark-radar.js) | Reescrito: aplicaciones reales en lugar de servidores simulados |
| [package.json](../../package.json) | Scripts `test:e2e` y `bench:radar` |

No se cambió ningún contrato, dependencia, umbral de cobertura ni prueba existente.

## 5. Comandos reproducibles

Requieren Docker. Ninguno usa servicios remotos: el arnés rechaza URLs que no sean `127.0.0.1` o `localhost`, y fija todas las variables de los procesos, de modo que un `.env` local no puede redirigirlos.

```bash
npm ci
npm run verify          # límites, tipos, cobertura, pruebas con dobles y compilación
npm run test:real       # 36 pruebas de la API contra PostgreSQL y Redis reales
npm run test:e2e        # 14 escenarios E2E con API y Radar compilados
npm run bench:radar     # benchmark real; escribe docs/migracion/evidencias/benchmark-radar-<fecha>.json
```

## 6. Pruebas E2E con infraestructura real

Cadena probada: cliente → API compilada en modo proxy → Radar compilado → Redis real, y API en modo local para comparar. PostgreSQL real para registro, inicio de sesión, catálogos y feed.

| N.º | Escenario | Resultado esperado | Local | CI |
|---|---|---|---|---|
| 1 | Consulta válida a través de la cadena | 200, contrato válido, `x-request-id` en los registros de API y Radar | Correcto | Correcto |
| 2 | Reporte válido | 200, voto en Redis | Correcto | Correcto |
| 3 | Entradas inválidas | Mismo estado y código en proxy y local | Correcto | Correcto |
| 4 | Tokens ausentes, alterados, expirados o de otra clave | 401 con el código del contrato, en API proxy, API local y Radar directo: 30 de 30 rechazos | Correcto | Correcto |
| 5 | Acceso directo con identidad falsificada | 401 sin token; con token, el voto se asigna al titular del token, no a `x-user-id` | Correcto | Correcto |
| 6 | Voto duplicado en la ventana | Un solo voto en Redis | Correcto | Correcto |
| 7 | Concurrencia | 40 votos simultáneos sin pérdidas; 10 votos simultáneos del mismo estado publican el consenso exactamente 3 veces | Correcto | Correcto |
| 8 | Límite de tiempo del proxy | 504 en 1,5 s ante un destino que no responde | Correcto | Correcto |
| 9 | Radar detenido | 502 inmediato; catálogos, feed y perfil siguen; salud `degraded`; recuperación al reiniciar | Correcto | Correcto |
| 10 | Redis detenido | 500 controlado en menos de 3 s; salud `degraded`; resto intacto; recuperación | Correcto | Correcto |
| 11 | Redis pausado | 500 en menos de 4 s, ninguna solicitud pendiente; recuperación | Correcto | Correcto |
| 12 | PostgreSQL detenido | Salud 503 `unavailable`; Radar sigue respondiendo 200; recuperación | Correcto | Correcto |
| 13 | La web no conoce la dirección de Radar | Sin referencias en `apps/web` | Correcto | Correcto |
| 14 | Parada de procesos | Terminan sin forzarse | Correcto | Correcto |

Limitación del escenario 14: en Windows, `SIGTERM` termina el proceso sin cierre ordenado. Solo la ejecución en CI, sobre Linux, comprueba el cierre ordenado.

## 7. Benchmark real

Ejecutado con [benchmark-radar.js](../../scripts/benchmark-radar.js) sobre el commit `723e283`, código idéntico al de esta rama. Datos completos: [benchmark-radar-2026-11-23.json](evidencias/benchmark-radar-2026-11-23.json).

| Parámetro | Valor | Justificación |
|---|---|---|
| Repeticiones | 3 por modo, alternadas A, B, A, B, A, B | Mínimo pedido; alternar reparte la deriva del equipo |
| S1 | 50 usuarios simultáneos en bucle cerrado; 10 s de calentamiento y 30 s de medición | Entre 14 000 y 67 000 solicitudes por repetición: muestra suficiente para p99 |
| S2 | 100 reportes válidos por minuto en bucle abierto durante 60 s | Es la carga del umbral; 100 muestras por repetición: p95 fiable, p99 no |
| S3, diagnóstico | 20 solicitudes/s en bucle abierto durante 30 s | Sin saturación: aísla el costo del salto de red |
| Datos | Redis vaciado y sembrado igual en cada repetición; un usuario distinto por reporte | Datos equivalentes y votos todos válidos |
| Errores | Todo estado distinto de 200 cuenta como error, y las latencias incluyen las solicitudes fallidas | Los escenarios no producen rechazos de negocio |

50 usuarios simultáneos no son 50 solicitudes por segundo: en S1 cada usuario envía la siguiente solicitud al recibir la respuesta, y el sistema alcanzó entre 467 y 2 237 solicitudes/s.

**Medianas de tres repeticiones:**

| Escenario | Modo | p50 | p95 | p99 | Rendimiento | Errores inesperados y timeouts |
|---|---|---|---|---|---|---|
| S1 | Local (A) | 36,8 ms | 82,7 ms | 141,2 ms | 1 203 rps | 0 |
| S1 | Proxy (B) | 80,0 ms | 212,1 ms | 328,8 ms | 520 rps | 0 |
| S2 | Local (A) | — | 18,2 ms | — | 100 reportes por repetición | 0 |
| S2 | Proxy (B) | — | 17,1 ms | — | 100 reportes por repetición | 0 |
| S3 | Local (A) | 2,3 ms | 3,5 ms | — | 600 por repetición | 0 |
| S3 | Proxy (B) | 4,5 ms | 14,5 ms | — | 600 por repetición | 0 |
| Arranque | API | — | — | — | 616 ms local; 608 ms proxy | — |
| Arranque | Radar | — | — | — | 450 ms | — |

**Por repetición (S1, p95):** local 46,4 · 182,0 · 82,7 ms; proxy 212,1 · 250,8 · 43,2 ms.

**CPU y memoria durante S1:** API local 51–97 % de un núcleo y unos 240 MB. En modo proxy, API 46–100 % y unos 256 MB, más Radar 39–94 % y unos 220 MB. En las repeticiones 1 y 2 del proxy, ningún proceso llegó al 100 % y aun así el rendimiento cayó: había competencia externa por el equipo.

**Lectura:**
- El salto adicional tiene un costo real y consistente: en S3, sin saturación, la p50 sube de 2,3 a 4,5 ms en las tres repeticiones.
- Bajo saturación (S1), el modo proxy procesa cada solicitud en dos procesos y serializa dos veces. Con la misma CPU, rinde menos y su cola crece antes.
- La dispersión es alta. El equipo compartía CPU con contenedores ajenos al proyecto, que no se detuvieron por instrucción, y el generador de carga corre en el mismo equipo.

## 8. Umbrales

Metas tomadas de la documentación vigente, sin cambios: [Métricas](../07-evaluacion-y-evolucion/06-metricas.md), [Escenarios de calidad](../01-analisis-de-sistema/08-escenarios-atributos-calidad.md) y [Criterios de validación](../07-evaluacion-y-evolucion/04-criterios-de-validacion.md).

| Umbral | Resultado | Evidencia | Veredicto |
|---|---|---|---|
| Pruebas automáticas sin fallos | verify, test:real y E2E en verde | Local y CI [45215241769](https://github.com/pillacarodriguezuriel-a11y/social_unsch/actions/runs/45215241769) | **CUMPLE** |
| Cobertura ≥ 90 % en API y Radar | API 96,75 / 93,00 / 98,33 / 96,85 %; Radar 98,65 / 91,47 / 97,72 / 99,31 % (sentencias / ramas / funciones / líneas) | `npm run verify` | **CUMPLE** |
| Accesos inválidos rechazados al 100 % | 30 de 30 | E2E escenario 4 | **CUMPLE** |
| Voto duplicado contado una vez | 1 voto en Redis | E2E escenario 6 | **CUMPLE** |
| Sin pérdida de votos bajo concurrencia | 40 de 40; consenso exacto 3 de 3 | E2E escenario 7 | **CUMPLE** |
| p95 de consulta < 500 ms con 50 usuarios | 82,7 ms local y 212,1 ms proxy | Benchmark S1 | **CUMPLE** (local) |
| Sobrecarga p95 del proxy ≤ 20 % | +156 % en S1; +319 % (11 ms) en S3 | Benchmark S1 y S3 | **NO CUMPLE** |
| 100 reportes/min: 0 errores y p95 < 500 ms | 0 errores en 600; p95 18,2 y 17,1 ms | Benchmark S2 | **CUMPLE** (local) |
| Fallo de Radar: 0 errores en flujos ajenos | Catálogos, feed (lectura y escritura) y perfil sin errores con Radar, Redis o la red caídos | E2E escenarios 9 a 11 | **CUMPLE** |

Estos resultados solo valen para el equipo, la carga y la duración medidos.

**Sobre el umbral incumplido:**
1. Evidencia conservada en el JSON.
2. Causa identificada: salto HTTP adicional y doble procesamiento en un equipo compartido.
3. No se encontró una corrección proporcionada dentro del alcance. El proxy ya mantiene conexiones vivas y no reintenta, y la latencia base de pocos milisegundos hace que cualquier salto supere un 20 % relativo.
4. Se repitió la medición: dos ejecuciones completas, el 2026-11-23, con el mismo veredicto.
5. **Queda declarado como no cumplido.** La meta no se modifica. Si el propietario considera que un criterio relativo no es adecuado con latencias de milisegundos, debe registrarse como decisión, preferiblemente tras medir en la plataforma real.

## 9. Evidencias de CI

| Ejecución | Commit | verify | test-real | e2e-radar | Nota |
|---|---|---|---|---|---|
| [41060703064](https://github.com/pillacarodriguezuriel-a11y/social_unsch/actions/runs/41060703064) | `b763885` (main) | Correcto | **Fallido** | — | Línea base |
| [45211335248](https://github.com/pillacarodriguezuriel-a11y/social_unsch/actions/runs/45211335248) | `723e283` | Correcto | **Correcto** | Fallido | test-real corregido |
| [45215241769](https://github.com/pillacarodriguezuriel-a11y/social_unsch/actions/runs/45215241769) | `fcee45d` | Correcto | Correcto | **Correcto** | Todo en verde |

Fallo intermedio del job E2E: en Node 20.14, el hook `before` de nivel superior no terminaba antes de las pruebas (`apiProxy` era `undefined`). Se diagnosticó publicando los errores como anotaciones, porque los logs exigen autenticación, y se corrigió agrupando las pruebas en `describe`. Era un defecto del test, no del sistema.

## 10. Estado del despliegue

| Elemento | Estado |
|---|---|
| Radar en producción | **Local**: la API lo atiende en proceso |
| Servicio Radar en Render | NO IMPLEMENTADO (404) |
| Proxy en producción | Código desplegado, sin activar |
| PostgreSQL de producción | **Caído** el 2026-11-23 (`database: down`). Sin acceso al panel para diagnosticarlo |
| Correcciones F-3 y F-4 | Solo en la rama; llegarán a producción al fusionar, por despliegue automático |

**Clasificación de Radar:** *independiente probado* (local y CI), **no** *independiente en producción*.

### Compatibilidad del arranque en frío con el proxy

| Dato | Valor |
|---|---|
| Límite máximo del proxy | 30 000 ms, por validación de [env.ts](../../apps/api/src/config/env.ts) |
| Límite configurado recomendado | 5 000 ms |
| Arranque en frío observado de la API en Render | 32,6 s el 2026-10-30; más de 70 s sin respuesta el 2026-11-23 |
| Arranque del proceso Radar en local | 450 ms hasta `/health/ready`, mediana de 3 (proceso ya instalado, sin plataforma) |

**Conclusión:** con un plan que suspende el servicio por inactividad, el arranque en frío supera el límite del proxy. Las primeras solicitudes tras la inactividad recibirían 504, incluso con el límite máximo. Aumentar el timeout no es solución: el arranque observado ya supera el máximo permitido y la API retendría conexiones durante ese tiempo.

| Alternativa | Implicación | Requiere |
|---|---|---|
| Plan de instancia sin suspensión para Radar | Elimina el arranque en frío; costo mensual | Autorización de gasto |
| Latido externo cada pocos minutos | Gratis, pero un servicio siempre activo consume horas de instancia gratuitas. Con API y Radar activos todo el mes, pueden superarse las horas incluidas en el plan gratuito; comprobar los límites vigentes de Render | Decisión del propietario |
| Mantener Radar en modo local | Sin costo ni riesgo nuevo; no hay aislamiento en producción | Nada: es el estado actual |

**Recomendación:** no activar el proxy mientras Radar se despliegue en un plan con suspensión por inactividad.

### Configuración de Render para Radar

Valores ficticios. Configurar desde la raíz del repositorio, porque el lockfile único está en la raíz.

| Campo | Valor |
|---|---|
| Tipo | Web Service |
| Nombre | `social-unsch-radar` |
| Región | La misma que la API |
| Rama | `main` |
| Root Directory | Vacío (raíz del repositorio) |
| Build Command | `npm ci --include=dev && npm run build:radar` |
| Start Command | `npm run start:radar` |
| Health Check Path | `/health/ready` |
| `NODE_VERSION` | `20.14.0`, la misma que la CI |
| `NODE_ENV` | `production` |
| `REDIS_URL` | `rediss://default:<CONTRASENA>@<HOST_UPSTASH>:6379`, el mismo Redis que la API para que la reversión conserve los votos |
| `JWT_PUBLIC_KEY` | La misma clave pública de la API, PEM en una línea con `\n` |
| `ALLOWED_ORIGINS` | Origen de la web y de la API, separados por comas; obligatorio de hecho, aunque el código solo avisa si falta |
| `PORT` | Lo asigna Render |

Radar nunca debe recibir `JWT_PRIVATE_KEY` ni `DATABASE_URL`.

Comunicación API → Radar: HTTPS público al dominio de Render. El proxy reenvía `Authorization` y `x-request-id`; Radar verifica el token por su cuenta.

### Activación, cuando se autorice

1. Fusionar esta rama con la CI en verde.
2. Resolver la caída de PostgreSQL de producción y el arranque en frío.
3. Crear el servicio con la tabla anterior y esperar `GET /health/ready` = 200 con `redis: up`.
4. En la API: `RADAR_MODE=proxy`, `RADAR_PROXY_TARGET=https://<servicio-radar>.onrender.com` y `RADAR_PROXY_TIMEOUT_MS=5000`. Reiniciar.
5. Ejecutar las comprobaciones posteriores.

### Comprobaciones posteriores al despliegue

| Comprobación | Esperado |
|---|---|
| `GET <API>/health/ready` | 200 `ready`, `database: up`, `radar: up` |
| `GET <RADAR>/health/ready` | 200 `ready`, `redis: up` |
| `GET <API>/api/v1/radar/status` con token | 200, cuerpo del contrato |
| Mismo `x-request-id` en los registros de API y Radar | Presente en ambos: prueba que el tráfico pasa por Radar |
| `GET <RADAR>/api/v1/radar/status` sin token | 401 `ERR_AUTH_TOKEN_MISSING` |
| `GET <API>/api/v1/catalogs` | 200 |
| La web de Vercel muestra el radar | Sin cambios visibles |

### Condiciones que obligan a revertir

- Cualquier 502 o 504 sostenido en `/api/v1/radar/*`.
- `radar: down` en la salud de la API durante más de 5 minutos.
- p95 de `/api/v1/radar/status` peor que el modo local en más de un 20 % en producción.
- Votos que no se publican o diferencias de contrato.

### Reversión

1. En la API: `RADAR_MODE=local`, con `REDIS_URL` definida. No vaciar `RADAR_PROXY_TARGET` dejando `RADAR_MODE=proxy`: la API no arrancaría.
2. Reiniciar la API.
3. Comprobar `/health/ready` con `radar: up` y `GET /api/v1/radar/status` con token.

Los votos se conservan si ambos procesos usan el mismo Redis. La reversión es probada en local: los escenarios 9 y 10 comparan ambos modos. **No se ha ensayado en producción.**

## 11. Distinción de estados

| Elemento | OBJETIVO | IMPLEMENTADO | PROBADO LOCALMENTE | VERIFICADO EN CI | VERIFICADO EN PRODUCCIÓN |
|---|---|---|---|---|---|
| Radar como proceso independiente | Sí | Sí | Sí | Sí | **No** |
| API consumiendo Radar por proxy | Sí | Sí | Sí | Sí | **No** |
| Contrato conservado | Sí | Sí | Sí | Sí | No aplica hasta activar |
| Aislamiento de fallos | Sí | Sí | Sí | Sí | **No** |
| Límite por comando Redis (F-3) | Sí | Sí | Sí | Sí | No: falta fusionar |
| Error de Redis visible (F-4) | Sí | Sí | Sí | Sí | No: falta fusionar |
| Pruebas reales de la API | Sí | Sí | Sí | Sí | No aplica |
| Rendimiento | Sí | Sí | Sí: un umbral no cumple | No: solo local | **No** |
| Reversión | Sí | Sí | Sí | Sí | **No** |

## 12. Limitaciones

- El benchmark mide un solo equipo donde conviven generador de carga, aplicaciones y contenedores. No representa Render ni Upstash: falta la latencia de red entre servicios gestionados.
- Los resultados solo valen para la carga, la duración y el equipo medidos.
- Los tokens de la carga y de la mayoría de escenarios se firman con la clave de prueba, igual que los emite la API. El escenario de inicio de sesión usa un token emitido por la API real.
- No se ensayó nada en producción, por instrucción.

## 13. Pendientes

| N.º | Pendiente | Responsable |
|---|---|---|
| 1 | Revisar y fusionar el PR de esta rama | Propietario |
| 2 | Recuperar PostgreSQL de producción (`database: down`) | Propietario, panel de Supabase |
| 3 | Decidir el plan de instancia de Radar o mantener el modo local | Propietario |
| 4 | Medir latencia y arranque en frío en la plataforma real | Tras desplegar |
| 5 | Decidir cómo tratar el umbral de sobrecarga incumplido | Propietario |
| 6 | Ensayar la reversión en producción y observar 2 semanas | Tras activar |
| 7 | Retirar el Radar local de la API | Tras la observación |

Detalle en [Pendientes](../07-evaluacion-y-evolucion/08-pendientes.md).

[← Estrategia de migración](README.md) · [← Índice](../README.md)
