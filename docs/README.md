# Social-UNSCH · Documentación de arquitectura

Social-UNSCH reúne reportes del campus, publicaciones, búsqueda de compañeros de proyecto y viajes compartidos para la comunidad de la Universidad Nacional de San Cristóbal de Huamanga. Los cuatro bloques siguientes recorren el proyecto desde las necesidades de sus usuarios hasta el código que atiende una petición.

| Dato | Valor |
|---|---|
| Autor | Uriel Carlos Pillaca Rodríguez |
| Código de estudiante | 27222120 |
| Universidad | Universidad Nacional de San Cristóbal de Huamanga |
| Escuela | Escuela Profesional de Ingeniería de Sistemas |
| Curso | Arquitectura de Software |
| Última verificación de despliegue documentada | 2026-10-30 sobre `b763885`, rama `main` |

## 1. Análisis de sistema

| Documento | Pregunta que responde |
|---|---|
| [Actores](01-analisis-de-sistema/01-actores.md) | ¿Quién puede registrarse, reportar el estado del campus o confirmar una reserva? |
| [Historias de usuario](01-analisis-de-sistema/02-historias-del-usuario.md) | ¿Qué necesita conseguir cada participante? |
| [Requisitos funcionales](01-analisis-de-sistema/03-requisitos-funcionales.md) | ¿Qué operaciones cubre la plataforma y cuáles siguen simuladas? |
| [Atributos de calidad](01-analisis-de-sistema/04-atributos-de-calidad.md) | ¿Qué garantías requieren los reportes, las cuentas y los asientos? |
| [Restricciones](01-analisis-de-sistema/05-restricciones.md) | ¿Qué límites técnicos, institucionales y de operación condicionan el diseño? |
| [Drivers arquitectónicos](01-analisis-de-sistema/06-drivers-arquitectonicos.md) | ¿Qué requisitos influyen en la estructura del sistema? |
| [Decisiones arquitectónicas](01-analisis-de-sistema/07-decisiones-arquitectonicas.md) | ¿Qué decisión responde a cada driver y dónde se registró? |
| [Escenarios de calidad](01-analisis-de-sistema/08-escenarios-atributos-calidad.md) | ¿Cómo comprobar la respuesta ante votos duplicados, reservas simultáneas o caídas de infraestructura? |

[Contexto y alcance](01-analisis-de-sistema/contexto-y-alcance.md) · [Matriz de trazabilidad](01-analisis-de-sistema/09-matriz-de-trazabilidad.md)

## 2. Arquitectura de software

| Documento | Contenido |
|---|---|
| [Arquitectura inicial](02-arquitectura-software/arquitectura-inicial.md) | Web en Next.js, API en Express, PostgreSQL y Redis. |
| [Componentes arquitectónicos](02-arquitectura-software/componentes-arquitectonicos.md) | Los siete módulos de la API y sus dependencias de código y datos. |
| [Estilo arquitectónico](02-arquitectura-software/estilo-arquitectonico.md) | Monolito modular y estrategia para extraer servicios por dominio. |
| [Enfoque arquitectónico](02-arquitectura-software/enfoque-arquitectonico.md) | Capas dentro de los módulos, puerto de almacenamiento de Radar y composición de dependencias. |

[Arquitectura de transición](02-arquitectura-software/04-arquitectura-de-transicion.md) · [Arquitectura objetivo](02-arquitectura-software/05-arquitectura-objetivo.md) · [Datos](02-arquitectura-software/06-datos-y-propiedad-por-dominio.md) · [Contratos](02-arquitectura-software/07-contratos-e-integraciones.md) · [Dominios](02-arquitectura-software/08-dominios-del-sistema.md)

## 3. Diseño de software

| Documento | Contenido |
|---|---|
| [Diseño interno de módulos](03-diseño-de-software/diseño-interno/diseño-interno-de-modulos.md) | Recorrido de una petición de publicación desde la ruta hasta PostgreSQL. |
| [Patrones de diseño](03-diseño-de-software/diseño-interno/patrones-de-diseño.md) | Repositorios, inyección de dependencias, middleware y operaciones atómicas. |
| [Principios de diseño](03-diseño-de-software/diseño-interno/principios-de-diseño.md) | Aplicación de SOLID al reporte de Campus Radar y límites en otros módulos. |

[Flujos principales](03-diseño-de-software/04-flujos-principales.md) · [Reglas de negocio](03-diseño-de-software/05-reglas-de-negocio.md) · [Errores y consistencia](03-diseño-de-software/06-errores-y-consistencia.md)

## 4. Modelo C4

| Nivel | Qué muestra |
|---|---|
| [1 · Contexto](04-modelo-c4/Nivel1-DiagramadeContextodelSistema.md) | La comunidad universitaria y su relación con Social-UNSCH. |
| [2 · Contenedores](04-modelo-c4/Nivel2-DiagramadeContenedores.md) | Aplicaciones, almacenes y comunicación entre ellos. |
| [3 · Componentes](04-modelo-c4/Nivel3-Diagrama-de-Componentes.md) | Responsabilidades dentro de la API y del servicio Radar. |
| [4 · Código](04-modelo-c4/Nivel4-DiagramadeCodigo.md) | Clases y secuencias de Radar, autenticación, catálogos y movilidad. |

Los diagramas se leen directamente en GitHub. La [guía C4](04-modelo-c4/README.md) incluye vistas adicionales de transición y del diseño propuesto.

## Migración, operación y evidencias

- La última [verificación de despliegue registrada](07-evaluacion-y-evolucion/07-estado-actual-y-evidencias.md) situó Radar dentro de la API. El [informe de extracción](migracion/EXTRACCION_RADAR.md) explica cómo seleccionar el servicio independiente y revertir el cambio.
- El [inventario de implementación](07-evaluacion-y-evolucion/01-inventario-de-implementacion.md) distingue los flujos conectados a la API de las pantallas con datos simulados. Véanse los [pendientes](07-evaluacion-y-evolucion/08-pendientes.md) y los [riesgos](07-evaluacion-y-evolucion/02-riesgos-y-deuda-tecnica.md).
- El [mapa de despliegue](05-despliegue-y-operacion/01-mapa-de-despliegue.md), la [configuración](05-despliegue-y-operacion/02-configuracion-y-entornos.md), el [proceso de entrega](05-despliegue-y-operacion/03-proceso-de-entrega.md) y la [guía de recuperación](05-despliegue-y-operacion/04-observabilidad-y-recuperacion.md) describen la operación.
- Para seguir la evolución del proyecto, consultar los [registros de decisión](06-decisiones-arquitectonicas/README.md), el [plan](07-evaluacion-y-evolucion/03-plan-de-migracion.md) y los [informes de migración](migracion/README.md).
- Los [criterios de validación](07-evaluacion-y-evolucion/04-criterios-de-validacion.md), la [estrategia de pruebas](07-evaluacion-y-evolucion/05-estrategia-de-pruebas.md), las [métricas](07-evaluacion-y-evolucion/06-metricas.md) y el [informe documental](INFORME_DOCUMENTACION.md) recogen los métodos y las evidencias.

[README del proyecto](../README.md)
