# ADR-006 · Plataformas gestionadas para el despliegue

| Campo | Valor |
|---|---|
| Estado | Vigente; configuración pendiente de verificación |
| Tipo | Documentación retrospectiva basada en observación externa e informes previos |
| Fecha de documentación | 2026-10-12 |
| Aprobación | Sin constancia |

## Contexto

El sistema necesita alojar una aplicación web, un proceso Node de larga duración, una base PostgreSQL y un Redis. Lo opera una sola persona, en el marco de un proyecto académico.

Esta decisión no puede reconstruirse del código: en el repositorio no hay archivos de despliegue. Se documenta a partir de lo observable desde fuera y de los informes de [migracion/](../migracion/ETAPA_01_LINEA_BASE.md). Lo que proviene de informes y no se pudo confirmar se marca como tal.

## Decisión observada

Usar plataformas gestionadas, una por pieza:

| Pieza | Plataforma | Grado de verificación |
|---|---|---|
| Aplicación web | Vercel | Verificado por la API de despliegues de GitHub y por respuesta HTTP |
| API | Render | Verificado por respuesta HTTP |
| PostgreSQL | Supabase | Indicado en informes; no verificado directamente |
| Redis | Upstash | Indicado en informes; no verificado |

Y, de forma implícita, **mantener la configuración de despliegue en los paneles** de cada plataforma, no en el repositorio.

## Alternativas

Análisis posterior.

| Alternativa | Ventaja | Desventaja |
|---|---|---|
| Un servidor propio con Docker Compose | Todo en un lugar, reproducible desde el repositorio | Administración de sistema, seguridad y copias a cargo del operador; costo fijo |
| Una sola plataforma para todo | Un panel y una factura | Menos opciones sin costo para cada pieza |
| Backend como funciones sin servidor en la plataforma del frontend | Un despliegue | Las conexiones persistentes a PostgreSQL y Redis y el proceso Express no encajan sin rediseño |
| Orquestador de contenedores | Preparado para muchos servicios | Desproporcionado para una persona y cinco piezas |

## Justificación

- Ninguna administración de servidores.
- Cada plataforma está especializada en su pieza y ofrece despliegue desde Git.
- Permite operar sin costo fijo, lo que se ajusta a un proyecto académico. El plan concreto en uso no está confirmado.

## Consecuencias

**Positivas**

- Publicar el frontend es tan simple como fusionar a `main`.
- Sin mantenimiento de sistema operativo, certificados ni red.

**Costos**

- **Configuración no reproducible.** Comandos, variables y versiones viven en cuatro paneles. Si se pierde el acceso o se recrea un servicio, no hay en el repositorio nada que lo reconstruya.
- **Suspensión y pausa por inactividad.** La API tarda decenas de segundos en su primera respuesta, y el informe de la etapa 1 registra una base pausada y un Redis que figuraba como eliminado en capturas previas, sin verificar.
- **Cuatro proveedores, cuatro puntos de fallo y cuatro cuentas** que administrar.
- **Latencia entre proveedores.** Cada consulta de la API cruza la red hasta el proveedor de datos; las regiones no están verificadas.
- **Despliegue no coordinado.** Fusionar a `main` publica el frontend de inmediato; la API y el esquema siguen caminos separados.
- **Multiplicación con más servicios.** La arquitectura objetivo añadiría varios servicios más a este esquema.

## Implicaciones para la migración

| Aspecto | Implicación |
|---|---|
| Más servicios de servidor | Cada uno con su propia suspensión por inactividad si el plan no cambia |
| Entrada de API | Puede resolverse con reescrituras en la plataforma del frontend, sin un servicio adicional |
| Conexión para migraciones | El migrador necesita una conexión con sesión continua; hay que confirmar que el proveedor la ofrece |
| Permisos por servicio en la base | Requiere poder crear varios usuarios de base de datos |
| Configuración versionada | Recomendable antes de multiplicar servicios |

## Evidencias

| Aspecto | Fuente |
|---|---|
| Despliegues de Vercel desde el repositorio | API pública de despliegues de GitHub, consultada el 2026-10-12 |
| API en Render en ejecución y con código de la etapa 2 | Solicitudes HTTP de solo lectura del 2026-10-12 |
| Base accesible para la API | Respuesta con datos de `GET /api/v1/catalogs` del 2026-10-12 |
| Ausencia de archivos de despliegue | Raíz del repositorio en el commit `8e56bfa` |
| Supabase y Upstash | [ETAPA_01_LINEA_BASE.md](../migracion/ETAPA_01_LINEA_BASE.md) |

Detalle en [Mapa de despliegue](../05-despliegue-y-operacion/01-mapa-de-despliegue.md).

## Condiciones para reconsiderarla

- Que la suspensión por inactividad haga inservible el radar o que una pausa de la base se repita.
- Que el número de servicios haga inmanejable la configuración repartida en paneles.
- Que haya presupuesto para un plan sin suspensión o para un servidor propio.
- Que el proyecto pase a manejar datos reales de estudiantes a escala, lo que exigiría garantías de respaldo y disponibilidad que hoy no están verificadas.

[← Índice de ADR](README.md) · [← Índice](../README.md)
