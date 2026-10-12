# ADR-003 · Migración gradual hacia servicios por dominio

| Campo | Valor |
|---|---|
| Estado | **Propuesto**, en discusión |
| Tipo | Decisión futura |
| Fecha de documentación | 2026-10-12 |
| Aprobación | Sin aprobación documentada |

## Contexto

El objetivo declarado del proyecto es evolucionar hacia servicios independientes por dominio, con arquitectura hexagonal interna y eventos selectivos. El punto de partida es un monolito modular en funcionamiento ([ADR-001](ADR-001-estado-y-organizacion-actual.md)), operado por una sola persona, sin entorno de preproducción y con partes de la funcionalidad aún simuladas.

Las dos primeras etapas del plan ya se ejecutaron y están integradas en `main`: línea base ([informe](../migracion/ETAPA_01_LINEA_BASE.md)) y estabilización ([informe](../migracion/ETAPA_02_ESTABILIZACION.md)). Ninguna de las dos cambió el estilo arquitectónico.

## Decisión propuesta

Migrar **por etapas y por dominios**, con la estrategia Strangler Fig, en lugar de reescribir o dividir todo a la vez:

1. Línea base y recuperación de infraestructura. *Ejecutada.*
2. Estabilización. *Ejecutada.*
3. Organización del repositorio, límites, contratos y entrada de API reversible.
4. Extracción de Radar.
5. Separación de Identidad y Comunidad según sus dependencias.
6. Movilidad.
7. Recursos y créditos, con integración asíncrona donde esté justificada.
8. Consolidación de despliegues, observabilidad y resiliencia.

Reglas que acompañan la decisión:

- Cada etapa deja el sistema funcionando y puede revertirse.
- El contrato con el frontend no cambia al mover código.
- No se avanza a la etapa siguiente sin cumplir los criterios de salida de la anterior.
- El número de servicios se mantiene bajo; una etapa puede concluir que un dominio no debe separarse.

El detalle está en el [plan de migración](../07-evaluacion-y-evolucion/03-plan-de-migracion.md).

## Alternativas

| Alternativa | Ventaja | Por qué no se propone |
|---|---|---|
| Mantener el monolito modular indefinidamente | Mínimo costo de operación; suficiente para la carga previsible | No cumple el objetivo de aprendizaje y evolución arquitectónica del proyecto. Sigue siendo una opción legítima si los criterios de validación no se cumplen |
| Reescritura completa como microservicios | Diseño limpio desde cero | Riesgo alto, sin sistema funcionando durante la reescritura, inviable para una persona |
| División simultánea de todos los módulos | Menos tiempo en estado intermedio | Sin posibilidad de aislar la causa de un fallo ni de revertir por partes |
| Monolito hexagonal sin separar servicios | Obtiene la modificabilidad sin el costo operativo | Es un paso intermedio razonable y compatible con esta propuesta; no excluye la separación posterior |

## Justificación

- La migración gradual permite validar cada paso con el sistema en uso.
- Empezar por ordenar el repositorio y los contratos reduce el riesgo de todas las extracciones posteriores.
- El orden por dominios sigue el acoplamiento real medido en el código ([Componentes y dependencias](../02-arquitectura-de-software/03-componentes-y-dependencias.md)): primero lo menos acoplado.
- Las áreas sin backend (recursos, moderación) pueden construirse directamente con la estructura objetivo.

## Consecuencias

**Positivas esperadas**

- Aislamiento de fallos entre dominios.
- Posibilidad de evolucionar y desplegar cada dominio por separado.
- Límites de datos explícitos.

**Costos esperados**

- Más unidades que desplegar, configurar y vigilar, a cargo de una sola persona.
- Latencia y modos de fallo nuevos en las llamadas entre servicios.
- Un periodo prolongado en estado intermedio, con dos formas de hacer las cosas.
- En plataformas que suspenden servicios inactivos, más servicios implican más arranques en frío.
- Pérdida de las transacciones locales entre dominios y de las claves foráneas que los cruzan.

Estos costos no son hipotéticos: son la razón por la que la propuesta incluye criterios de validación y admite detenerse.

## Evidencias

| Aspecto | Fuente |
|---|---|
| Etapas 1 y 2 integradas | *Pull requests* 1 y 2, fusionados en `main` el 2026-10-12; commit `e704b8a` |
| Módulos sin importaciones cruzadas | [src/modules](../../src/modules) |
| Acoplamiento por datos que condiciona el orden | [Componentes y dependencias](../02-arquitectura-de-software/03-componentes-y-dependencias.md) |
| Etapas 3 a 8 | Sin evidencia de ejecución: son propuesta |

## Condiciones para reconsiderarla

- Que tras la etapa 4 la operación de dos servicios resulte más costosa que el beneficio obtenido.
- Que el proyecto pase a tener varios mantenedores, lo que cambiaría el equilibrio a favor de separar más.
- Que cambien las plataformas o el presupuesto disponibles.
- Que la prioridad pase a ser completar las funciones simuladas antes que separar servicios.

[← Índice de ADR](README.md) · [← Índice](../README.md)
