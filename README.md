# SOCIAL-UNSCH 🎓

**SOCIAL-UNSCH** es una plataforma de red social y banco de archivos académicos exclusiva y cooperativa diseñada para la comunidad universitaria de la **Universidad Nacional de San Cristóbal de Huamanga (UNSCH)**.

La plataforma está diseñada con una arquitectura moderna y robusta para mejorar la interacción entre estudiantes, centralizar recursos y ofrecer utilidades críticas de la vida universitaria en tiempo real.

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
*   **Node.js** (v18+)
*   **PostgreSQL**
*   **Redis Server**

### Pasos para iniciar localmente

1.  **Instalar dependencias**:
    ```bash
    npm install
    ```

2.  **Iniciar servicios de desarrollo**:
    La plataforma provee scripts integrados para levantar el entorno de desarrollo local:
    *   **Frontend**: `npm run dev:frontend` (corre en el puerto `3001`)
    *   **Backend**: `npm run dev:backend` (corre en el puerto `3000`)
    *   **Orquestador**: `npm run dev` (ejecuta ambos simultáneamente)

3.  **Migraciones y Datos de Prueba**:
    ```bash
    npx ts-node src/database/migrations/migrate_all.ts
    ```

---

## 🔒 Seguridad y Privacidad
El proyecto opera de forma restringida exclusivamente para correos institucionales `@unsch.edu.pe`. Todos los datos sensibles (contraseñas hasheadas con Bcrypt con factor de costo 12) y tokens están excluidos del repositorio público mediante configuraciones estrictas en `.gitignore`.
