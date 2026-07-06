---
name: social-unsch
description: >
  Sistema completo de desarrollo para SOCIAL-UNSCH, la red social universitaria exclusiva de la
  Universidad Nacional de San Cristóbal de Huamanga (UNSCH), Ayacucho, Perú. Usa esta skill
  siempre que el usuario pida construir, generar, diseñar o codificar cualquier módulo de
  SOCIAL-UNSCH: esquemas PostgreSQL, rutas API (Node.js/FastAPI), configuración Redis, componentes
  Next.js, lógica de matchmaking académico, radar del campus en tiempo real, marketplace
  universitario, bolsa de trabajo, wiki-banco de archivos, carpooling "Ruta Sancristobalina",
  o motor de moderación anti-toxicidad. También dispara cuando el usuario mencione facultades,
  escuelas profesionales, pabellones o entidades de la UNSCH en contexto de desarrollo de software.
  Prioriza siempre esta skill sobre respuestas genéricas cuando el contexto sea SOCIAL-UNSCH.
---

# SOCIAL-UNSCH — Skill de Desarrollo del Sistema

Eres el motor de desarrollo principal de **SOCIAL-UNSCH**, una red social universitaria exclusiva
para la comunidad de la UNSCH (Ayacucho, Perú). Todo código, esquema y arquitectura generado debe
respetar estrictamente el dominio de datos definido en esta skill.

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React.js / Next.js |
| Backend | Node.js (Express) o Python (FastAPI / Django) |
| Base de datos principal | PostgreSQL |
| Cache / Tiempo real | Redis |
| Autenticación | JWT + validación de dominio `@unsch.edu.pe` |

---

## 1. Estructura Académica Canónica

> **REGLA CRÍTICA**: Todo usuario debe pertenecer a exactamente una Facultad y una E.P. de esta lista. No se admiten valores fuera de esta taxonomía.

```
Facultad de Ciencias Agrarias
  └── Agronomía | Ingeniería Agrícola | Medicina Veterinaria | Ingeniería Agroforestal

Facultad de Ciencias Biológicas
  └── Biología

Facultad de Ciencias de la Educación
  └── Educación Inicial | Educación Primaria | Educación Secundaria | Educación Física

Facultad de Derecho y Ciencias Políticas
  └── Derecho

Facultad de Ingeniería Química y Metalurgia
  └── Ingeniería Química | Ingeniería en Industrias Alimentarias | Ingeniería Agroindustrial | Ingeniería Ambiental

Facultad de Ciencias de la Salud
  └── Obstetricia | Enfermería | Farmacia y Bioquímica | Medicina Humana | Psicología

Facultad de Ingeniería de Minas, Geología y Civil
  └── Ingeniería de Sistemas | Ingeniería Civil | Ingeniería de Minas | Ciencias Físico-Matemáticas | Arquitectura

Facultad de Ciencias Económicas, Administrativas y Contables
  └── Administración de Empresas | Contabilidad y Auditoría | Economía

Facultad de Ciencias Sociales
  └── Arqueología e Historia | Ciencias de la Comunicación | Antropología Social | Trabajo Social
```

**Ciclo académico**: Formato `YYYY-I` o `YYYY-II` (ej. `2026-I`). Niveles: Ciclo I al X (hasta XII para Medicina Humana y Medicina Veterinaria).

**Roles de usuario**: `Estudiante Regular` | `Egresado` | `Docente` | `Administrativo`

---

## 2. Geografía y Pabellones del Campus

### Sedes Principales

| Sede | Dirección | Uso |
|------|-----------|-----|
| Ciudad Universitaria | Av. Independencia s/n, Ayacucho | Clases, labs, biblioteca central |
| Rectorado | Portal Independencia Nº 57 | Trámites, pagos, oficinas |
| Residencia Universitaria | Jr. Independencia N° 1217 | Bienestar, Comedor, FISMA, Medicina |
| Ex Planteles PAGPA | Av. 26 de Enero, Ayacucho 05001 | Salones rotacionales de Educación |

### Mapa de Pabellones (Ciudad Universitaria)

| Código | Escuelas / Uso |
|--------|---------------|
| AA | Medicina Veterinaria |
| AN | Arqueología e Historia, Antropología Social, Trabajo Social, Ciencias de la Comunicación |
| AD | Agronomía |
| Hs | Biología, Ingeniería Química, Ingeniería de Sistemas, Ingeniería en Industrias Alimentarias, Farmacia y Bioquímica |
| AB | Derecho |
| J | Agronomía, Ingeniería Agrícola, Biología |
| E | Posgrado / Trabajo Social |
| U | Enfermería |
| T | Obstetricia · Medicina Humana · Ciencias Físico-Matemáticas (FISMA) |
| O | Educación Secundaria, Primaria, Inicial, Física |
| W | Economía, Contabilidad y Auditoría, Administración de Empresas |
| AR | Ingeniería Civil, Arquitectura |
| AU | Ingeniería de Minas |
| Y | Laboratorios y aulas de Biología |
| D | Educación Secundaria, Primaria, Inicial, Física (Ex-Guamán Poma de Ayala / PAGPA) |

### Nodos Críticos del Radar

- **Comedor Universitario** (Residencia) — estado de colas
- **Biblioteca Central** (Ciudad Universitaria) — 4 niveles: Sótano · 1er Piso · 2do Piso · 3er Piso
- **Rectorado / Ventanillas** — estado de trámites
- **Cafetines** (central y por escuela)
- **Lozas deportivas**, **Paradero interno**, **Entrada Av. Independencia**

---

## 3. Variables de Estado en Vivo (Redis Enums)

```
COMEDOR_STATUS:       Fluido (Verde) | Cola Media (Amarillo) | Cola Larga (Rojo) | Cerrado
RECTORADO_STATUS:     Ventanilla vacía | Espera de 15 min | Colapsado
CAMPUS_ALERT_TYPE:    Clase suspendida | Evento cultural | Pérdida de objeto (DNI/Llaves)
LIBRARY_LEVEL:        Nivel 1 (Sótano) | Nivel 2 (1er Piso) | Nivel 3 (2do Piso) | Nivel 4 (3er Piso)
```

TTL recomendado para estados del radar: **15 minutos** (se invalida si no hay nuevos reportes).

---

## 4. Catálogo de Habilidades / Tags (Lista Cerrada)

> Se permiten tags de texto libre. Los usuarios pueden seleccionar de este catálogo o agregar más según a la afinidad de su escuela profesional.

**Ingenierías y Ciencias Exactas**
`Python` · `C++` · `AutoCAD` · `Topografía` · `Civil 3D` · `ArcGIS/QGIS` · `MATLAB` · `Gestión de Proyectos` · `Análisis de Suelos` · `Diseño Arquitectónico`

**Ciencias de la Salud y Biológicas**
`Inyectoterapia` · `Primeros Auxilios` · `Redacción de Historias Clínicas` · `Procesamiento de Muestras` · `Seguridad Alimentaria` · `Manejo de Especies` · `Análisis Clínico`

**Sociales, Derecho y Educación**
`Normas APA` · `Oratoria/Debate` · `Litigación Oral` · `Trabajo de Campo` · `Idioma Quechua` · `Diseño Curricular` · `Psicopedagogía`

**Económicas y Gestión**
`Excel Avanzado` · `SPSS/Stata` · `Finanzas Personales` · `Marketing Digital` · `Constitución de Empresas` · `Formulación de Proyectos de Inversión`

---

## 5. Tipos de Proyecto (Matchmaking)

`Tesis de Pregrado` | `Proyecto de Curso` | `Startup/Emprendimiento` | `Círculo de Estudios` | `Voluntariado`

---

## 6. Módulos del Sistema — Guía de Construcción

Cuando el usuario pida un módulo, sigue el flujo correspondiente:

### FEATURE 1 — Filtro de Exclusividad (Auth)
- Validar email con regex: `/^[a-zA-Z0-9._%+-]+@unsch\.edu\.pe$/`
- Rechazar cualquier dominio diferente en registro Y en cambio de email
- Emitir JWT con payload: `{ user_id, role, facultad_id, escuela_id, ciclo }`

### FEATURE 2 — Feed por Facultad/Escuela
- Particionar publicaciones por `(facultad_id, escuela_id)`
- Feed global = opt-in explícito del usuario
- Ordenamiento: cronológico inverso con boost por relevancia académica

### FEATURE 3 — Matchmaking Académico
- Score de compatibilidad basado en intersección de `tags_ofrecidos` vs `tags_buscados`
- Al hacer match: crear chat privado exclusivo entre los dos usuarios
- Proyectos deben tener al menos 1 `tipo_proyecto` y 1 tag del catálogo cerrado

### FEATURE 4 — Radar del Campus
- Estados almacenados en Redis con TTL de 15 min
- Actualización por crowdsourcing: mínimo 3 reportes coincidentes para cambiar estado
- Pub/Sub Redis para notificaciones en tiempo real al frontend

### FEATURE 5a — Marketplace
Campos obligatorios: `categoria` · `precio_soles` · `es_trueque` · `punto_entrega` · `estado_item`

Enums:
- `categoria`: Libros/Copias | Útiles | Herramientas/Equipos | Snacks/Comida | Otros
- `punto_entrega`: Comedor | Entrada Residencia | Lozas Deportivas | Puerta Principal | Cafetín Central | Pabellón Específico
- `estado_item`: Nuevo | Como nuevo | Usado

### FEATURE 5b — Bolsa de Trabajo
Campos: `tipo_oferta` · `escuelas_destino[]` · `modalidad` · `compensacion_tipo` · `monto_soles`

Enums:
- `tipo_oferta`: Prácticas Preprofesionales | Prácticas Profesionales | Tiempo Completo | Tiempo Parcial | Freelance
- `modalidad`: Presencial (Ayacucho) | Híbrido | Remoto
- `compensacion_tipo`: Remunerado | Ad honorem

### FEATURE 5c — Wiki-Banco de Archivos
Jerarquía: `Facultad → Escuela → Curso → Profesor → Archivo`
Sistema de créditos: +2 por subida aprobada · +1 por voto positivo recibido · -1 por descarga

### FEATURE 5d — Ruta Sancristobalina (Carpooling)
Distritos de origen registrados: `San Juan Bautista` · `Carmen Alto` · `Jesús Nazareno`
Destinos del campus: nodos geográficos de la Ciudad Universitaria
Solo usuarios con `@unsch.edu.pe` verificado pueden publicar o unirse a rutas

### FEATURE 6 — Motor de Moderación
Motivos de denuncia: `Acoso o Bullying` | `Información Falsa/Difamación` | `Contenido Político/Spam` | `Venta Prohibida` | `Lenguaje de Odio`

**Regla automática**: Si un post acumula **≥ 3 reportes** del mismo motivo → visibilidad suprimida automáticamente, pendiente de revisión por moderador.

Metadatos requeridos por reporte: `post_id` · `reporter_user_id` · `reported_user_id` · `motivo` · `timestamp`

---

## 7. Flujo de Trabajo al Recibir una Solicitud

1. **Identifica el módulo** solicitado (DDL, API, Redis, UI, lógica, etc.)
2. **Consulta esta skill** para los enums, entidades y validaciones exactas
3. **Genera código limpio y production-ready** con comentarios en español
4. **Incluye siempre** las restricciones de dominio UNSCH (emails, facultades, enums)
5. Si el módulo tiene dependencias (ej. API depende del schema DDL), menciónalas

---

## 8. Convenciones de Código

- **Idioma del código**: inglés (nombres de variables, funciones, tablas)
- **Idioma de comentarios y strings de UI**: español peruano
- **Nomenclatura de tablas PostgreSQL**: `snake_case` plural (ej. `user_profiles`, `campus_reports`)
- **Nomenclatura de endpoints**: REST bajo `/api/v1/` (ej. `/api/v1/radar/comedor`)
- **Errores de validación**: siempre retornar mensaje descriptivo en español

---

## 9. Módulos Disponibles para Generación

Cuando el usuario no especifique, preguntar cuál de estos quiere construir primero:

| # | Módulo | Output |
|---|--------|--------|
| 1 | PostgreSQL DDL Schema completo | `.sql` con todas las tablas |
| 2 | Node.js/Express API Routers | Rutas por feature |
| 3 | FastAPI (Python) Backend | Schemas Pydantic + routers async |
| 4 | Redis Config + Pub/Sub | Config del radar en tiempo real |
| 5 | Next.js Components | Auth, Feed, Radar, Matchmaking UI |
| 6 | Matchmaking Algorithm | Función de scoring cross-faculty |
| 7 | Moderation Engine | Sistema de reportes + supresión automática |
| 8 | Architecture Blueprint | Diagrama de servicios y flujo de datos |
