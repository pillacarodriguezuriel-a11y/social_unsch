# Informe de la documentación arquitectónica

Cómo se elaboró esta documentación, qué se comprobó realmente y qué limitaciones tiene. Sirve para que el lector sepa cuánto puede confiar en cada parte.

| Dato | Valor |
|---|---|
| Fecha | 2026-10-12 |
| Línea base | Commit `8e56bfa` de `main` |
| Rama de trabajo | `docs/arquitectura-social-unsch` |
| Alcance del cambio | Solo archivos Markdown: `docs/` y `README.md` |

## Revisión del 2026-10-30

Se revisó toda la documentación contra el código de `b763885`, con estas reglas: solo archivos Markdown, ningún cambio de código, y sin leer archivos `.env`. Se actualizó tras la fusión del PR n.º 5. Las secciones siguientes describen la edición original del 2026-10-12.

| Comprobación | Resultado |
|---|---|
| Pruebas con dobles de API, Radar y web, y límites | Correctas; ver [Estado actual y evidencias](07-evaluacion-y-evolucion/07-estado-actual-y-evidencias.md) |
| Pruebas reales | No ejecutadas: Docker no estaba activo. En CI, fallidas |
| Estado de CI y del PR | API pública de GitHub. El log del job fallido exige autenticación |
| Producción | Solicitudes GET de solo lectura a rutas públicas; sin cuentas ni escrituras |
| Paneles de plataformas | Sin acceso |
| Enlaces | Enlaces y anclas resueltos por script |
| Diagramas | Revisión estática por script de estructura y caracteres conflictivos. **No se renderizaron con el parser oficial de Mermaid**: conviene revisarlos en la vista previa de GitHub |

La estructura numerada existente se conservó en lugar de crear otra paralela. La equivalencia está en el [portal](README.md#mapa-de-la-documentación).

## Método

1. **Inspección del repositorio.** Se actualizó la referencia remota y se trabajó sobre una copia limpia de `main`, separada del directorio de trabajo del propietario, cuyos archivos locales sin seguimiento no se tocaron ni se incluyeron.
2. **Lectura del código.** Se leyeron la aplicación Express, la configuración, los middlewares, los siete módulos, las cinco migraciones SQL, el migrador, la carga de catálogos, el seed, la configuración de pruebas y el consumo de la API desde el frontend.
3. **Contraste con los informes previos.** Los informes de [migracion/](migracion/ETAPA_02_ESTABILIZACION.md) se usaron como contexto, no como evidencia. Las diferencias encontradas están en [Riesgos y deuda técnica](07-evaluacion-y-evolucion/02-riesgos-y-deuda-tecnica.md#diferencias-entre-documentación-previa-y-código).
4. **Referencia académica.** Se revisó el repositorio `devlizbethjaico/Marketplace-arquitSoft-02` (commit `bf0dd8d`) para orientar la organización por secciones y el formato de escenarios de calidad y del modelo C4. No se copió contenido. Esa referencia separa un diseño conceptual, en sus documentos, de un código de ejemplo en otra tecnología; ninguna de sus tecnologías o funciones se atribuye a SOCIAL-UNSCH.
5. **Redacción** con cinco estados explícitos: implementado, parcial, simulado, propuesto y pendiente de verificación.

## Estado del repositorio al documentar

| Aspecto | Hallazgo |
|---|---|
| Rama principal | `main` en `8e56bfa` |
| Etapas 1 y 2 | Fusionadas mediante los *pull requests* 1 y 2; el commit de fusión de la etapa 2 es `e704b8a` |
| Diferencia entre `e704b8a` y `8e56bfa` | Solo el README |
| Instrucciones para agentes o colaboradores | No existen `AGENTS.md`, `CLAUDE.md` ni `CONTRIBUTING.md` |
| Cambios locales del propietario | Tres archivos sin seguimiento en su directorio de trabajo; conservados y no incluidos |
| Rama `docs/arquitectura-social-unsch` | No existía antes de este trabajo |

## Comprobaciones realizadas

### Sobre la documentación

| Comprobación | Método | Resultado |
|---|---|---|
| Enlaces relativos | Script que resuelve cada enlace de `README.md` y `docs/` contra el sistema de archivos, incluidas las anclas a títulos | Todos los enlaces de los documentos de esta tarea resuelven. Los únicos enlaces que no resuelven están en el informe previo `migracion/ETAPA_02_ESTABILIZACION.md`, que usa rutas locales `file:///`; no se modificó |
| Sintaxis de los diagramas | Los 34 bloques Mermaid se renderizaron con `@mermaid-js/mermaid-cli` 11.17.0 (Mermaid 11.17.2) | Los 34 se generan sin error |
| Legibilidad de los diagramas | Revisión visual de cuatro diagramas renderizados | Dos diagramas de la arquitectura objetivo se simplificaron por cruces de líneas |
| Símbolos citados | Búsqueda en el código de cada función, restricción, índice, disparador y constante citados | Todos existen |
| Rutas citadas | Comparación de las rutas mencionadas con las registradas en los enrutadores | Las 16 coinciden |
| Códigos de error citados | Búsqueda de cada código `ERR_` en `src/` | Todos existen, salvo `ERR_DOMINIO_CAUSA`, que es un ejemplo de formato |
| Secretos | Búsqueda de claves, tokens y cadenas de conexión con credenciales en los archivos nuevos | Ninguno. Los ejemplos usan marcadores |
| Alcance del cambio | Revisión de la lista de archivos modificados | Solo Markdown en `docs/` y `README.md` |

**Limitación:** no se pudo comprobar cómo muestra GitHub los diagramas. La versión de Mermaid que usa GitHub puede diferir de la empleada en la validación. Se usó sintaxis de diagramas de flujo, de secuencia, de clases, de estados y de entidad-relación, y se evitó la sintaxis C4 específica de Mermaid, que es experimental.

### Sobre el código

No se ejecutó la suite del proyecto como parte de esta tarea, porque solo se modificó Markdown. Los resultados que se citan proceden de ejecuciones anteriores:

| Resultado | Fecha | Procedencia | Sobre qué código |
|---|---|---|---|
| `npm run build`: correcto | 2026-10-12 | Ejecución propia, anterior a esta tarea | Commit `fa85296` |
| `npm run build:frontend`: correcto, 14 páginas | 2026-10-12 | Ejecución propia, anterior a esta tarea | Commit `fa85296` |
| Pruebas con dobles: 19 suites, 380 pruebas, todas pasan; cobertura de sentencias 95,46 %, ramas 91,35 %, funciones 97,1 %, líneas 95,59 % | 2026-10-12 | Ejecución propia, anterior a esta tarea | Commit `fa85296` |
| Pruebas reales: 5 suites, 33 pruebas, todas pasan | Sin fecha exacta; octubre de 2026 | **Informado** por [ETAPA_02_ESTABILIZACION.md](migracion/ETAPA_02_ESTABILIZACION.md). No reproducido por el autor de esta documentación | Rama de la etapa 2 |

El commit `fa85296` y la línea base `8e56bfa` difieren únicamente en el README, por lo que esos resultados corresponden al mismo código fuente.

La cobertura mide solo los archivos listados en [jest.config.ts](../apps/api/jest.config.ts); excluye la configuración, el migrador y todo el frontend.

### Sobre los despliegues

Sin acceso a los paneles. Se hicieron solicitudes de solo lectura el 2026-10-12:

| Comprobación | Resultado |
|---|---|
| API pública de GitHub: despliegues | Despliegue de producción de Vercel para `8e56bfa`; despliegues de vista previa para otras ramas |
| `GET` a la página de inicio de sesión del frontend | 200 |
| `GET /api/v1/radar/status` sin token | 401 con el formato de error de la aplicación; primera respuesta en unos 32 segundos |
| `GET /api/v1/catalogs` | 200 con facultades y escuelas |
| `POST /api/v1/auth/login` con un correo inexistente | 401 |

No se crearon cuentas ni datos en producción, no se ejecutaron migraciones ni seeds y no se cambió ninguna configuración.

## Limitaciones

| Limitación | Efecto |
|---|---|
| Sin acceso a Vercel, Render, Supabase ni Upstash | La configuración de despliegue y los proveedores de datos figuran como pendientes de verificación |
| Redis de producción sin comprobar | No puede afirmarse que el radar funcione en producción |
| Esquema de producción comprobado solo de forma indirecta | No consta que `schema_migrations` y el índice único de carpooling existan allí |
| Pruebas reales no reproducidas | Sus resultados se citan como informados |
| Comportamiento del frontend no observado en un navegador | Las afirmaciones sobre pantallas provienen de la lectura del código |
| Algunas conclusiones son inferencias del código | Están señaladas como tales donde aparecen; por ejemplo, el doble escape de HTML y la condición de carrera del matchmaking |
| Sin mediciones de rendimiento ni de disponibilidad | Todos los umbrales son objetivos pendientes de validación |
| Decisiones sin registro histórico | Los ADR retrospectivos reconstruyen la decisión; no hay constancia de quién ni cuándo la tomó |
| Restricciones académicas no documentadas en el repositorio | Figuran como pendientes de confirmar |
| No es una auditoría de seguridad | La deuda listada es la encontrada al documentar; puede haber más |

## Qué es implementación y qué es propuesta

| Parte | Naturaleza |
|---|---|
| Análisis del sistema | Implementación, con el estado de cada requisito. Los umbrales de los escenarios son propuestas |
| Arquitectura actual, estilos, componentes, datos, contratos vigentes | Implementación |
| Arquitectura de transición y objetivo; propiedad de datos; contratos entre servicios | **Propuesta** |
| Diseño: organización, SOLID, patrones, flujos, reglas, errores | Implementación; las recomendaciones están separadas |
| C4: contexto, contenedores actuales, componentes, código | Implementación |
| C4: contenedores de transición y objetivo | **Propuesta** |
| Despliegue | Mezcla señalada: comandos existentes, hechos verificados, hechos informados y procedimientos propuestos |
| ADR-001, 002 y 006 | Retrospectivos |
| ADR-003, 004 y 005 | **Propuestos** |
| Inventario y deuda técnica | Implementación |
| Plan de migración, etapas 3 a 8, y criterios de validación | **Propuesta** |

## Problemas de código detectados y no corregidos

Esta tarea no modifica código. Los problemas encontrados están registrados con su evidencia en [Riesgos y deuda técnica](07-evaluacion-y-evolucion/02-riesgos-y-deuda-tecnica.md). Los de mayor prioridad:

- El índice único de solicitudes de carpooling puede no crearse sin que la migración falle.
- Siguen en el repositorio ejecutores de migración heredados con efectos destructivos.
- No hay respaldo de la base definido, integración continua ni ruta de salud.
- El correo no se verifica y el token se guarda en `localStorage`.

## Mantenimiento

Esta documentación describe un commit concreto. Cuándo debe actualizarse cada documento está en [Criterios de validación](07-evaluacion-y-evolucion/04-criterios-de-validacion.md#validación-de-esta-documentación).

[← Índice](README.md)
