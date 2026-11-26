# SOCIAL-UNSCH 🎓

**SOCIAL-UNSCH** es una plataforma de red social y banco de archivos académicos exclusiva y cooperativa diseñada para la comunidad universitaria de la **Universidad Nacional de San Cristóbal de Huamanga (UNSCH)**.

La plataforma está diseñada con una arquitectura moderna y robusta para mejorar la interacción entre estudiantes, centralizar recursos y ofrecer utilidades críticas de la vida universitaria en tiempo real.

---

## 📌 Estado actual y documentación

> Fase vigente: [Etapa 8 — Cierre de la migración](docs/migracion/ETAPA_08_CIERRE_MIGRACION.md). Último estado de producción verificado: 2026-11-25 ([evidencias](docs/07-evaluacion-y-evolucion/07-estado-actual-y-evidencias.md)).

SOCIAL-UNSCH es un **monolito modular con dos dominios extraídos a procesos propios**. Así queda el sistema al cerrar la migración:

| Pieza | Qué es | Dónde está |
|---|---|---|
| `apps/web` | Aplicación web Next.js | **Desplegada** (Vercel) |
| `apps/api` | API Express con Identidad, Catálogos, Feed, Matchmaking, Carpooling y Moderación | **Desplegada** (Render) |
| `apps/radar` | Servicio independiente de Campus Radar (Redis) | Implementado y probado, **sin desplegar** |
| `apps/feed` | Servicio independiente del Feed (PostgreSQL) | Implementado y probado, **sin desplegar** |
| PostgreSQL | Datos relacionales | **Desplegado** (Supabase); compartido entre API y Feed |
| Redis | Estado efímero del radar | **Desplegado** (Upstash) |

En producción la API sigue atendiendo Radar y Feed **en su propio proceso**: `RADAR_MODE=local` y `FEED_MODE=local` son los valores predeterminados y no se han cambiado. Activar un servicio extraído es un cambio de configuración reversible, pendiente de presupuesto y autorización.

**No es una arquitectura de microservicios independientes:** `apps/feed` comparte la base de datos de la API y lee la tabla `users`. Es un proceso independiente sobre datos compartidos ([detalle](docs/02-arquitectura-software/06-datos-y-propiedad-por-dominio.md#acceso-a-datos-de-los-servicios-extraídos)).

| Área funcional | Estado |
|---|---|
| Registro, inicio de sesión, catálogos | Implementado |
| Campus Radar | Implementado en la API. Servicio `apps/radar` y proxy reversible: código en `main`, sin desplegar |
| Feed de publicaciones | Implementado en la API. Servicio `apps/feed` y proxy reversible: código en `main`, sin desplegar. Los filtros existen en la API; la pantalla aún no los usa |
| Matchmaking | Parcial: descubrir e interactuar funcionan; no hay API para crear perfiles ni proyectos |
| Carpooling | Parcial: la API existe y está probada; la pantalla usa datos del navegador |
| Wiki-banco, moderación, marketplace, empleo, ajustes | Simulado en el navegador; sin API |

La descripción de módulos que sigue presenta la visión del producto. Qué parte está construida se detalla, con evidencia, en la documentación:

- **[Documentación arquitectónica](docs/README.md)**: análisis, arquitectura actual, de transición y objetivo, diseño, modelo C4, despliegue, decisiones y plan de migración.
- [Inventario de implementación](docs/07-evaluacion-y-evolucion/01-inventario-de-implementacion.md): estado de cada funcionalidad.
- [Estrategia e informes de migración](docs/migracion/README.md): etapas 1 a 8, con la aclaración de por qué el plan y lo ejecutado numeran distinto las etapas 6 a 8.
- Decisiones arquitectónicas: [ADR-008 (Radar)](docs/06-decisiones-arquitectonicas/ADR-008-extraccion-radar-servicio-independiente.md), [ADR-010 (Feed)](docs/06-decisiones-arquitectonicas/ADR-010-extraccion-feed-servicio-independiente.md) y [ADR-011 (alcance final y cierre)](docs/06-decisiones-arquitectonicas/ADR-011-cierre-de-la-migracion-y-alcance-final.md).

### Estructura del repositorio

Monorepo con npm workspaces y lockfile único:

| Ruta | Contenido |
|---|---|
| `apps/web` | Aplicación web Next.js (`@social-unsch/web`) |
| `apps/api` | API Express (`@social-unsch/api`), auth, catálogos, carpooling, matchmaking y modos local/proxy de Radar y Feed |
| `apps/radar` | Servicio independiente de Campus Radar (`@social-unsch/radar`) |
| `apps/feed` | Servicio independiente de Feed (`@social-unsch/feed`) |
| `packages/contracts` | Contratos de intercambio de Radar, Feed y formato de error (Zod) |
| `packages/feed-domain` | Dominio Feed compartido (puertos, servicio, repositorio SQL y manejadores HTTP sin dependencias de ejecución) |
| `scripts` | Arranque conjunto, límites arquitectónicos, sondas operativas y benchmarks de Radar y Feed |
| `docs` | Documentación arquitectónica e informes de migración |

---

## 🚀 Módulos y Características Principales

### 📡 1. Campus Radar (Crowdsourcing en Tiempo Real)
*   **Monitoreo de Afluencia**: Estado del comedor universitario y aforo por niveles de la Biblioteca Central (Sótano a 3er Piso) administrado mediante Redis con TTL de 15 minutos.
*   **Alertas del Campus**: Reporte de incidencias físicas (pérdida de DNI/llaves, eventos culturales, suspensión de clases) validados mediante un sistema de consenso crowdsourcing (mínimo 3 reportes coincidentes).

### 🤝 2. Conexión Sancristobalina (Matchmaking Académico)
*   **Algoritmo de Afinidad (UNSCH-301)**: Mide la compatibilidad de habilidades deseadas y ofrecidas para formar equipos de tesis, proyectos de curso, círculos de estudios o voluntariados.
*   **Búsqueda Curricular**: Filtros avanzados por facultades y un catálogo cerrado de tags organizados por áreas (Ingenierías, Salud, Sociales, Económicas).
*   **Privacidad (Ley N° 29733)**: Interacciones anonimizadas; la información de contacto y canales de chat solo se revelan ante un Match mutuo.

### 📁 3. Wiki-Banco de Archivos Académicos
*   **Economía de Créditos**: Descarga de exámenes, prácticas y apuntes del ciclo.
*   **Estructura Académica**: Organizado conforme a las 9 facultades y 31 escuelas profesionales oficiales de la UNSCH.

### 🚗 4. Ruta Sancristobalina (Carpooling)
*   **Rutas Seguras**: Publicación y reserva de asientos de vehículos particulares con validación obligatoria de distritos de origen (San Juan Bautista, Carmen Alto, etc.) y destino al campus.

### 🛡️ 5. Moderación Automática
*   **Filtros de Contenido**: Detección de acoso, spam político y ventas no autorizadas con supresión automática al alcanzar un umbral de reportes.

---

## 🛠️ Stack Tecnológico

*   **Frontend**: Next.js, React, TailwindCSS, Lucide Icons.
*   **Backend**: Node.js, Express, TypeScript, Zod.
*   **Persistencia**: PostgreSQL (Base de Datos relacional para usuarios, proyectos, publicaciones).
*   **Afluencia en Vivo**: Redis (Estructuras Hash y Sets para votaciones de radar eficientes y efímeras).
*   **Autenticación**: JSON Web Tokens (JWT) firmados con algoritmo asimétrico RS256 de 24h de duración.

---

## 💻 Configuración del Proyecto

### Requisitos Previos
*   **Node.js** 20.14+, 22.11+ o 24 (ver `engines`) y **npm** 10.8+
*   **PostgreSQL**
*   **Redis Server**

### Pasos para iniciar localmente

1.  **Instalar dependencias** (un solo lockfile para todo el monorepo) y crear los archivos de entorno a partir de las plantillas:
    ```bash
    npm ci
    cp apps/api/.env.example apps/api/.env
    cp apps/web/.env.example apps/web/.env.local
    ```
    Un `.env` existente en la raíz sigue funcionando para la API, por compatibilidad.
    Las variables se explican en [Configuración y entornos](docs/05-despliegue-y-operacion/02-configuracion-y-entornos.md).

2.  **Iniciar servicios de desarrollo**:
    La plataforma provee scripts integrados para levantar el entorno de desarrollo local:
    *   **Frontend**: `npm run dev:frontend` (corre en el puerto `3001`)
    *   **Backend**: `npm run dev:backend` (corre en el puerto `3000`)
    *   **Ambos a la vez**: `npm run dev:all` (`npm run dev` levanta solo el backend)

3.  **Gestión de Base de Datos y Catálogos**:
    *   **Evolución del Esquema (DDL Idempotente)**:
        ```bash
        npm run db:migrate
        ```
    *   **Sincronización de Catálogos Canónicos (Facultades, Escuelas, Pabellones)**:
        ```bash
        npm run db:catalogs
        ```
    *   **Estado de Migraciones**:
        ```bash
        npm run db:migrate:status
        ```
    *   **Carga de Datos Demo (Solo Local / Opcional)**:
        ```bash
        ALLOW_DEMO_SEED=true npm run db:seed:demo
        ```

4.  **Pruebas Automatizadas**:
    *   **Suite con dobles de prueba, contrato de Radar y frontend (umbral de cobertura del 90 % en la API)**:
        ```bash
        npm test
        npm run test:coverage
        ```
    *   **Verificación completa** (límites, tipos, cobertura, pruebas del frontend y compilaciones):
        ```bash
        npm run verify
        ```
    *   **Suite de Integración Real (PostgreSQL 15 y Redis 7 Aislados)**:
        ```bash
        npm run test:real
        ```

5.  **Compilación y salud**:
    *   `npm run build` (API), `npm run build:frontend` (web) o `npm run build:all`.
    *   `GET /health/live` y `GET /health/ready` en la API.
    *   Los ajustes de Vercel y Render para esta estructura están en la [etapa 3 §9](docs/migracion/ETAPA_03_PREPARACION_SEPARACION.md#9-impacto-sobre-vercel-y-render).

---

## EXPOSICIÓN PARA DEFENDER EL CURSO
https://canva.link/b26bvy2rx25ldmx
