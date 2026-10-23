# C2 · Contenedores de transición

> **Estado: Propuesto.** Representa el sistema después de la etapa 4 del [plan de migración](../07-evaluacion-y-evolucion/03-plan-de-migracion.md): radar extraído y el resto todavía en el monolito. El servicio de radar no existe. Lo que sí existe desde la etapa 3 es el mecanismo de entrada: la API ya puede reenviar `/api/v1/radar` con `RADAR_MODE=proxy` ([ETAPA_03](../migracion/ETAPA_03_PREPARACION_SEPARACION.md#6-enrutamiento-reversible)).

**Pregunta:** ¿cómo conviven lo existente y lo nuevo durante la migración?

## Diagrama

```mermaid
flowchart TB
    USR(["Miembro de la comunidad"])

    subgraph SISTEMA["SOCIAL-UNSCH en transición"]
        WEB["Aplicación web<br/>existente"]
        MONO["API monolítica<br/>existente · entrada de /api/v1<br/>auth, users, catalogs, feed,<br/>matchmaking, carpooling"]
        PX["Montaje de radar en modo proxy<br/>implementado en la etapa 3, desactivado"]
        RSV["Servicio de radar<br/>extraído del módulo radar"]
    end

    PG[("PostgreSQL<br/>existente")]
    RD[("Redis<br/>existente")]

    USR --> WEB
    WEB -- "todas las solicitudes" --> MONO
    MONO -- "/api/v1/radar con RADAR_MODE=proxy" --> PX
    PX -- "un intento, límite de tiempo" --> RSV
    MONO -. "RADAR_MODE=local:<br/>módulo radar conservado" .-> RD
    MONO --> PG
    RSV --> RD

    classDef propuesto stroke-dasharray: 5 5
    class RSV propuesto
```

**Leyenda:** trazo continuo, contenedor o relación existente; trazo discontinuo, propuesto.

## Contenedores

| Contenedor | Estado | Cambio respecto a hoy |
|---|---|---|
| Aplicación web | Existente | Sin cambios: sigue llamando a la API en `/api/v1` |
| Entrada de API | Implementado en la etapa 3 (desactivado) | La propia API: monta el radar como unidad reemplazable y lo reenvía en modo proxy. Se descartó por ahora una puerta de enlace aparte; ver [Arquitectura de transición](../02-arquitectura-de-software/04-arquitectura-de-transicion.md) |
| API monolítica | Existente | Conserva todos sus módulos. El de radar deja de recibir tráfico, pero no se elimina |
| Servicio de radar | Propuesto | Nuevo proceso con el código del módulo actual. Verifica los tokens por sí mismo con la clave pública |
| PostgreSQL | Existente | Sin cambios |
| Redis | Existente | Pasa a ser usado por el servicio de radar |

## Qué hace reversible esta configuración

| Situación | Acción | Efecto |
|---|---|---|
| El servicio de radar falla o se comporta distinto | `RADAR_MODE=local` en la API | El monolito atiende de nuevo, con el mismo Redis y las mismas claves, sin redesplegar código |
| La API (entrada) falla | Igual que hoy: la API es un único punto de entrada | Sin cambio respecto a la situación actual |

La reversión es posible porque el monolito y el servicio nuevo comparten el mismo formato de claves en Redis y el mismo contrato HTTP. Si alguno de los dos cambia durante la convivencia, la reversión deja de ser segura.

## Condiciones para llegar a este estado

- Repositorio dividido en paquetes y contrato de Radar formalizado (hecho en la etapa 3).
- Verificación de token disponible como código compartido (pendiente).
- Ruta de salud en el monolito (hecho en la etapa 3) y en el servicio nuevo.
- Pruebas reales del radar ejecutándose contra el servicio nuevo sin cambios en sus aserciones.

## Qué no cambia

- El contrato que ve el frontend.
- La emisión de tokens.
- Los datos: Redis ya es un almacén exclusivo del radar.

**Relacionados:** [C2 actual](02-contenedores-actuales.md) · [C2 objetivo](06-contenedores-objetivo.md) · [ADR-004](../06-decisiones-arquitectonicas/ADR-004-extraccion-inicial-de-radar.md)

[← Guía del modelo C4](README.md) · [← Índice](../README.md)
