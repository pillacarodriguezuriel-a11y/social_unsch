# SOCIAL-UNSCH 🎓

**SOCIAL-UNSCH** es una plataforma de red social y banco de archivos académicos exclusiva y cooperativa diseñada para la comunidad universitaria de la **Universidad Nacional de San Cristóbal de Huamanga (UNSCH)**.

La plataforma está diseñada con una arquitectura moderna y robusta para mejorar la interacción entre estudiantes, centralizar recursos y ofrecer utilidades críticas de la vida universitaria en tiempo real.

---

## 📌 Estado actual y documentación

> Línea base documentada: commit `8e56bfa` de `main` (2026-10-12), actualizada con la [etapa 3](docs/migracion/ETAPA_03_PREPARACION_SEPARACION.md) y la [etapa 4](docs/migracion/ETAPA_04_EXTRACCION_RADAR.md) (2026-10-23).

SOCIAL-UNSCH avanza hacia su arquitectura de transición: una aplicación web Next.js (`apps/web`), **una API principal Express (`apps/api`)** y el **primer microservicio independiente: Campus Radar (`apps/radar`)**, consumido mediante proxy reversible en la API. Los datos relacionales residen en PostgreSQL y el estado temporal en Redis.

| Área | Estado |
|---|---|
| Registro, inicio de sesión, catálogos | Implementado |
| Campus Radar | Implementado (extraído a `apps/radar` con proxy reversible) |
| Feed de publicaciones | Implementado (los filtros existen en la API; la pantalla aún no los usa) |
| Matchmaking | Parcial: descubrir e interactuar funcionan; no hay API para crear perfiles ni proyectos |
| Carpooling | Parcial: la API existe y está probada; la pantalla usa datos del navegador |
| Wiki-banco, moderación, marketplace, empleo, ajustes | Simulado en el navegador; sin API |

La descripción de módulos que sigue presenta la visión del producto. Qué parte está construida se detalla, con evidencia, en la documentación:

- **[Documentación arquitectónica](docs/README.md)**: análisis, arquitectura actual, de transición y objetivo, diseño, modelo C4, despliegue, decisiones y plan de migración.
- [Inventario de implementación](docs/07-evaluacion-y-evolucion/01-inventario-de-implementacion.md): estado de cada funcionalidad.
- Informes de migración: [etapa 1](docs/migracion/ETAPA_01_LINEA_BASE.md), [etapa 2](docs/migracion/ETAPA_02_ESTABILIZACION.md), [etapa 3](docs/migracion/ETAPA_03_PREPARACION_SEPARACION.md) y [etapa 4](docs/migracion/ETAPA_04_EXTRACCION_RADAR.md).
- Decisiones arquitectónicas: [ADR-007 (Workspaces)](docs/06-decisiones-arquitectonicas/ADR-007-workspaces-y-montaje-de-radar.md) y [ADR-008 (Extracción de Radar)](docs/06-decisiones-arquitectonicas/ADR-008-extraccion-radar-servicio-independiente.md).

### Estructura del repositorio

Monorepo con npm workspaces y lockfile único:

| Ruta | Contenido |
|---|---|
| `apps/web` | Aplicación web Next.js (`@social-unsch/web`) |
| `apps/api` | API Express (`@social-unsch/api`), auth, feed, carpooling y proxy de Radar |
| `apps/radar` | Servicio independiente de Campus Radar (`@social-unsch/radar`) |
| `packages/contracts` | Contratos de intercambio de Radar y formato de error (Zod) |
| `scripts` | Arranque conjunto, límites arquitectónicos y benchmark de latencia |
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
