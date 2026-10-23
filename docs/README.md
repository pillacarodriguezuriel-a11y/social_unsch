# Documentación arquitectónica de SOCIAL-UNSCH

| Dato | Valor |
|---|---|
| Autor | Uriel Carlos Pillaca Rodríguez |
| Código de estudiante | 27222120 |
| Universidad | Universidad Nacional de San Cristóbal de Huamanga |
| Escuela | Escuela Profesional de Ingeniería de Sistemas |
| Curso | Arquitectura de Software |
| Línea base documentada | Commit `8e56bfa` de `main` (2026-10-12) |
| Actualización | Etapa 3 (commit `96783ef`, workspaces y proxy) y Etapa 4 (rama `feat/etapa-4-radar-service`, extracción de Radar) |

Esta documentación explica qué hace SOCIAL-UNSCH, cómo está construido hoy, qué decisiones arquitectónicas contiene y cómo se propone que evolucione. Está escrita para dos lectores: quien evalúa el proyecto en el curso y quien se incorpora a desarrollarlo.

## Cómo leer los estados

Cada afirmación sobre una funcionalidad lleva uno de estos estados. No son intercambiables.

| Estado | Significado |
|---|---|
| **Implementado** | Existe código que lo realiza y se cita el archivo |
| **Parcial** | Existe una parte, pero el flujo completo no se cierra |
| **Simulado** | La pantalla existe, pero usa datos fijos o `localStorage` en lugar de persistencia compartida |
| **Propuesto** | Forma parte del diseño futuro; no hay código |
| **Pendiente de verificación** | No pudo comprobarse con el acceso disponible |

La documentación separa tres momentos: la **arquitectura actual** (lo que hay en `8e56bfa`), la **arquitectura de transición** (cómo conviven los componentes durante la extracción progresiva) y la **arquitectura objetivo** (adónde se quiere llegar).

## Resumen en cinco líneas

- El sistema evoluciona hacia una arquitectura de transición: una aplicación web Next.js (`apps/web`), **una API principal Express (`apps/api`)** y el **servicio independiente de Radar (`apps/radar`)**, coordinados en un monorepo con npm workspaces.
- Los datos persistentes están en PostgreSQL; el radar del campus usa Redis con expiración de 15 minutos y agregación por consenso de 3 votos.
- Autenticación propia con JWT firmado con RS256: la clave privada permanece en la API; Radar valida con clave pública.
- Cinco áreas del frontend consumen la API; seis pantallas siguen simuladas en el navegador.
- La etapa 4 extrae Campus Radar a un servicio independiente, manteniendo compatibilidad de contratos en `packages/contracts`, pruebas de paridad y activación reversible vía proxy.

## Índice

### 1. Análisis del sistema

| Documento | Contenido |
|---|---|
| [Contexto y alcance](01-analisis-del-sistema/01-contexto-y-alcance.md) | Problema, beneficiarios, qué entra y qué no |
| [Actores](01-analisis-del-sistema/02-actores.md) | Personas y sistemas externos |
| [Historias de usuario](01-analisis-del-sistema/03-historias-de-usuario.md) | Historias con criterios de aceptación |
| [Requisitos funcionales](01-analisis-del-sistema/04-requisitos-funcionales.md) | RF-001 a RF-023 con estado y evidencia |
| [Atributos de calidad](01-analisis-del-sistema/05-atributos-de-calidad.md) | Qué atributos importan y qué hay hoy |
| [Restricciones](01-analisis-del-sistema/06-restricciones.md) | Técnicas verificadas y pendientes de confirmar |
| [Drivers arquitectónicos](01-analisis-del-sistema/07-drivers-arquitectonicos.md) | Qué fuerza las decisiones |
| [Escenarios de calidad](01-analisis-del-sistema/08-escenarios-de-calidad.md) | Escenarios medibles |
| [Matriz de trazabilidad](01-analisis-del-sistema/09-matriz-de-trazabilidad.md) | Historia → requisito → módulo → prueba → etapa |

### 2. Arquitectura de software

| Documento | Contenido |
|---|---|
| [Arquitectura actual](02-arquitectura-de-software/01-arquitectura-actual.md) | Procesos, módulos, datos y seguridad observados |
| [Estilos y enfoques](02-arquitectura-de-software/02-estilos-y-enfoques.md) | Monolito modular, capas, hexagonal, servicios, Strangler Fig |
| [Componentes y dependencias](02-arquitectura-de-software/03-componentes-y-dependencias.md) | Quién depende de quién y dónde está el acoplamiento |
| [Arquitectura de transición](02-arquitectura-de-software/04-arquitectura-de-transicion.md) | Convivencia durante la migración (propuesta) |
| [Arquitectura objetivo](02-arquitectura-de-software/05-arquitectura-objetivo.md) | Servicios por dominio (propuesta) |
| [Datos y propiedad por dominio](02-arquitectura-de-software/06-datos-y-propiedad-por-dominio.md) | Tablas, claves de Redis y dueño propuesto |
| [Contratos e integraciones](02-arquitectura-de-software/07-contratos-e-integraciones.md) | API REST vigente y contratos futuros |

### 3. Diseño de software

| Documento | Contenido |
|---|---|
| [Organización interna](03-diseno-de-software/01-organizacion-interna.md) | Estructura de un módulo |
| [Principios SOLID](03-diseno-de-software/02-principios-solid.md) | Aplicación real, parcial y recomendada |
| [Patrones de diseño](03-diseno-de-software/03-patrones-de-diseno.md) | Patrones presentes en el código |
| [Flujos principales](03-diseno-de-software/04-flujos-principales.md) | Registro, feed, radar, carpooling, catálogos |
| [Reglas de negocio](03-diseno-de-software/05-reglas-de-negocio.md) | Reglas y dónde se aplican |
| [Errores y consistencia](03-diseno-de-software/06-errores-y-consistencia.md) | Manejo de errores y límites transaccionales |

### 4. Modelo C4

[Guía del modelo](04-modelo-c4/README.md) · [C1 Contexto](04-modelo-c4/01-contexto.md) · [C2 Contenedores actuales](04-modelo-c4/02-contenedores-actuales.md) · [C3 Componentes del backend](04-modelo-c4/03-componentes-del-backend.md) · [C4 Código y secuencias](04-modelo-c4/04-codigo-y-secuencias.md) · [C2 de transición](04-modelo-c4/05-contenedores-de-transicion.md) · [C2 objetivo](04-modelo-c4/06-contenedores-objetivo.md)

### 5. Despliegue y operación

| Documento | Contenido |
|---|---|
| [Mapa de despliegue](05-despliegue-y-operacion/01-mapa-de-despliegue.md) | Vercel, Render, Supabase, Upstash: verificado y pendiente |
| [Configuración y entornos](05-despliegue-y-operacion/02-configuracion-y-entornos.md) | Variables por nombre y propósito |
| [Proceso de entrega](05-despliegue-y-operacion/03-proceso-de-entrega.md) | Comandos existentes y procedimiento propuesto |
| [Observabilidad y recuperación](05-despliegue-y-operacion/04-observabilidad-y-recuperacion.md) | Qué se puede observar hoy y qué falta |

### 6. Decisiones arquitectónicas

[Índice de ADR](06-decisiones-arquitectonicas/README.md): ocho registros: tres retrospectivos, tres propuestos, uno de la etapa 3 ([ADR-007](06-decisiones-arquitectonicas/ADR-007-workspaces-y-montaje-de-radar.md)) y uno de la etapa 4 ([ADR-008](06-decisiones-arquitectonicas/ADR-008-extraccion-radar-servicio-independiente.md)).

### 7. Evaluación y evolución

| Documento | Contenido |
|---|---|
| [Inventario de implementación](07-evaluacion-y-evolucion/01-inventario-de-implementacion.md) | Estado de cada funcionalidad |
| [Riesgos y deuda técnica](07-evaluacion-y-evolucion/02-riesgos-y-deuda-tecnica.md) | Deuda con evidencia y diferencias entre documentos y código |
| [Plan de migración](07-evaluacion-y-evolucion/03-plan-de-migracion.md) | Ocho etapas, dependencias y reversión |
| [Criterios de validación](07-evaluacion-y-evolucion/04-criterios-de-validacion.md) | Qué comprobar antes de extraer un servicio |

### Informes relacionados

| Documento | Contenido |
|---|---|
| [Informe de esta documentación](INFORME_DOCUMENTACION.md) | Método, comprobaciones realizadas y limitaciones |
| [Etapa 1: línea base](migracion/ETAPA_01_LINEA_BASE.md) | Informe histórico de la etapa 1 |
| [Etapa 2: estabilización](migracion/ETAPA_02_ESTABILIZACION.md) | Informe histórico de la etapa 2 |
| [Etapa 3: preparación de la separación](migracion/ETAPA_03_PREPARACION_SEPARACION.md) | Workspaces, contratos de Radar, enrutamiento reversible, salud y ajustes de despliegue |
| [Etapa 4: extracción de Radar](migracion/ETAPA_04_EXTRACCION_RADAR.md) | Servicio independiente Radar, frontera de autenticación, observabilidad, pruebas E2E y activación reversible |
| [Inventario de configuración](migracion/INVENTARIO_CONFIGURACION.md) | Inventario técnico; actualizado en las etapas 3 y 4 |
| [Resultados de verificación](migracion/RESULTADOS_VERIFICACION.md) | Comprobaciones de la etapa 1 |

Los informes de `migracion/` son registros de su momento. Donde difieren del código actual, prevalece el código; las diferencias detectadas están en [Riesgos y deuda técnica](07-evaluacion-y-evolucion/02-riesgos-y-deuda-tecnica.md#diferencias-entre-documentación-previa-y-código).

## Diagramas

Todos los diagramas son bloques Mermaid dentro de los archivos Markdown. En los diagramas, el trazo continuo representa lo implementado y el trazo discontinuo lo propuesto.

[← README del proyecto](../README.md)
