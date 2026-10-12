# C2 · Contenedores objetivo

> **Estado: Propuesto.** Este diagrama representa el destino de la migración. De los contenedores de servidor que muestra, hoy solo existen la aplicación web y los almacenes PostgreSQL y Redis; la lógica está en una única API.

**Pregunta:** ¿cuál es el destino de la migración?

## Diagrama

```mermaid
flowchart TB
    USR(["Miembro de la comunidad"])
    WEB["Aplicación web"]
    GW{{"Entrada de API"}}

    USR --> WEB --> GW

    subgraph SERVICIOS["Servicios por dominio"]
        direction LR
        ID["Identidad<br/>registro, sesión, perfil,<br/>términos, catálogos"]
        RA["Radar<br/>estado del campus"]
        CO["Comunidad<br/>feed, matchmaking,<br/>moderación"]
        MO["Movilidad<br/>rutas y reservas"]
        RE["Recursos<br/>archivos y créditos"]
    end

    GW --> ID & RA & CO & MO & RE

    PGI[("Datos de identidad<br/>PostgreSQL")]
    RDS[("Redis")]
    PGC[("Datos de comunidad<br/>PostgreSQL")]
    PGM[("Datos de movilidad<br/>PostgreSQL")]
    PGR[("Datos de recursos<br/>PostgreSQL")]

    ID --> PGI
    RA --> RDS
    CO --> PGC
    MO --> PGM
    RE --> PGR

    classDef propuesto stroke-dasharray: 5 5
    class GW,ID,RA,CO,MO,RE,PGI,PGC,PGM,PGR propuesto
```

**Leyenda:** trazo discontinuo, propuesto. Trazo continuo, existente (aplicación web y Redis).

### Comunicación entre servicios

El diagrama anterior muestra la estructura. Las relaciones entre servicios se muestran aparte para mantener ambos legibles.

```mermaid
flowchart LR
    MO["Movilidad"] -- "consulta de contacto<br/>tras confirmar, síncrona" --> ID["Identidad"]
    ID -. "usuario eliminado" .-> EV[["Canal de eventos<br/>mecanismo por decidir"]]
    CO["Comunidad"] -. "publicación reportada" .-> EV
    RE["Recursos"] -. "archivo descargado" .-> EV
    EV -. "reacciones" .-> SUS["Servicios suscritos"]

    classDef propuesto stroke-dasharray: 5 5
    class MO,ID,CO,RE,EV,SUS propuesto
```

Todo este segundo diagrama es propuesto. Línea continua: llamada síncrona. Línea de puntos: evento asíncrono.

## Contenedores

| Contenedor | Responsabilidad | Dueño de | Origen |
|---|---|---|---|
| Aplicación web | Interfaz | Nada compartido | Existente |
| Entrada de API | Punto único de entrada y enrutamiento | Nada | Nueva |
| Identidad | Cuentas, emisión de tokens, perfil, términos, catálogos | `users`, catálogos | Módulos `auth`, `users`, `catalogs` |
| Radar | Consenso y estado del campus | Claves `radar:*` | Módulo `radar` |
| Comunidad | Publicaciones, matchmaking, moderación | `feed_posts`, `matchmaking_*`, `moderation_*` | Módulos `feed`, `matchmaking`; moderación por construir |
| Movilidad | Rutas y reservas | `carpooling_*` | Módulo `carpooling`; publicación de rutas por construir |
| Recursos | Archivos y créditos | `academic_files`, `file_downloads`, `wiki_credits_log`, saldo | Por construir sobre el esquema existente |
| Canal de eventos | Transporte de hechos entre servicios | — | Nuevo; mecanismo sin decidir |

Los cuatro cilindros de PostgreSQL representan **propiedad separada**, no necesariamente cuatro servidores. Pueden ser esquemas o usuarios distintos de una misma instancia; ver [ADR-005](../06-decisiones-arquitectonicas/ADR-005-propiedad-gradual-de-datos.md).

## Relaciones

| Relación | Tipo | Motivo |
|---|---|---|
| Entrada → servicios | Síncrona, HTTP | Contrato `/api/v1` actual |
| Cada servicio → identidad del usuario | Ninguna llamada: se verifica el token con la clave pública | El token ya lleva identificador y rol |
| Movilidad → Identidad | Síncrona, por contrato | Los datos de contacto se necesitan en el momento de confirmar y deben estar actualizados |
| Comunidad, Recursos, Identidad → canal de eventos | Asíncrona | Reacciones que no deben bloquear la operación |

## Diferencias con el estado actual

| Aspecto | Actual | Objetivo |
|---|---|---|
| Unidades de servidor | 1 | 5 más la entrada |
| Acceso a `users` | 5 módulos con SQL directo | Solo Identidad |
| Reglas en disparadores de la base | Créditos y moderación | En el servicio dueño |
| Comunicación entre dominios | A través de tablas compartidas | Por contrato o por eventos |
| Organización interna | Capas con dependencias concretas | Hexagonal |
| Funciones simuladas | Seis pantallas | Construidas en su servicio |

## Advertencias

- Este diagrama es un objetivo, no un compromiso de fechas ni una descripción del sistema.
- El número de servicios puede reducirse: mantener Identidad y Comunidad juntas es una variante válida si el costo de operación lo aconseja.
- Marketplace y empleo no aparecen: el plan de migración no les asigna servicio.

**Relacionados:** [C2 actual](02-contenedores-actuales.md) · [C2 de transición](05-contenedores-de-transicion.md) · [Arquitectura objetivo](../02-arquitectura-de-software/05-arquitectura-objetivo.md)

[← Guía del modelo C4](README.md) · [← Índice](../README.md)
