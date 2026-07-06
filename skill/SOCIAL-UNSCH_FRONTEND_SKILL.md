---
name: social-unsch-frontend
description: Especificación técnica única (Single Source of Truth) para maquetar el frontend del sistema "SOCIAL-UNSCH" — una red social/marketplace académico para estudiantes de la UNSCH. Usar esta skill SIEMPRE que se trabaje en componentes, vistas, estilos, layouts o flujos de interacción de SOCIAL-UNSCH, o cuando se mencione "Crimson Heritage Design System", "Campus Radar", "Matchmaking", "Wiki-Banco de Archivos", "Job Board" del campus, o cualquier pantalla del cliente Next.js de este proyecto. Aplica tanto si se está generando código TSX/Tailwind nuevo, como si se está revisando, corrigiendo o extendiendo componentes ya existentes del sistema. Consultar esta skill antes de escribir cualquier componente, definir paleta de colores, estructurar el layout, o decidir el comportamiento visual de un estado de error/vacío/carga dentro de este proyecto.
---

# SOCIAL-UNSCH — Frontend Architecture & UI/UX Skill

Esta skill encapsula el rol de **Arquitecto Frontend Principal y Líder de UI/UX** para "SOCIAL-UNSCH". Es la **Única Fuente de Verdad** que deben consultar todos los agentes de IA antes de generar o modificar cualquier vista, componente, estilo o flujo de interacción del cliente.

**Regla de oro:** ante cualquier ambigüedad de diseño, estilo o estructura no contemplada explícitamente aquí, prioriza siempre la opción más simple, modular y coherente con el Crimson Heritage Design System descrito en la Sección 2, en lugar de improvisar una solución visual nueva.

---

## Cómo usar esta skill

1. Antes de escribir código, identifica en qué sección cae la tarea (stack, design system, componente core, estado de borde, o lógica cliente-API).
2. Aplica las reglas de esa sección de forma literal — los valores de color, naming, y estructura de componentes son normativos, no sugerencias.
3. Si la tarea involucra texto visible al usuario, redáctalo en español peruano neutro (ver Sección 6); el código (nombres, props, hooks) siempre en inglés.
4. Si la tarea no está cubierta por ninguna sección, manténte fiel al espíritu del sistema (sobrio, institucional, modular, gamificado) antes que inventar un patrón nuevo.

---

## 1. Arquitectura del Stack Tecnológico y Rendimiento

- **Framework principal:** Next.js (App Router) con React y TypeScript, estructurado de forma estrictamente modular (sin componentes monolíticos; cada componente vive en su propio archivo con responsabilidad única).
- **Estilos y layout:** Tailwind CSS como única herramienta de estilos. Diseño ágil, limpio, con soporte nativo para responsive design (mobile-first, luego adaptado a desktop).
- **Gestión de estado global:** Zustand o React Context API — ligero, optimizado específicamente para el manejo de créditos del usuario y tokens de sesión. Evitar soluciones de estado pesadas (Redux, etc.) salvo que el proyecto lo requiera explícitamente.
- **Iconografía:** Lucide React exclusivamente. Mantener consistencia visual (mismo grosor de trazo, mismo tamaño base) en toda la aplicación.
- **Tipografía:** Importación global de la familia "Manrope" como fuente principal de toda la interfaz.

---

## 2. Sistema de Diseño Global — Crimson Heritage Design System

Configuración normativa para `tailwind.config.js`. Estos valores son exactos y aprobados; no deben aproximarse ni sustituirse por tonos similares.

| Token | Color | Hex | Uso |
|---|---|---|---|
| `primary` | Crimson Profundo | `#5C0000` | Estados activos, botones principales, headers, enlaces críticos |
| `secondary` | Crimson Mitigado | `#A6665C` | Bordes secundarios, etiquetas de condición, subtítulos |
| `tertiary` | Azul Técnico | `#001586` | Alertas del sistema, notificaciones urgentes del radar, tags destacados |
| `neutral-gray` | Gris Estructural | `#847370` | Fuentes de texto, fondos de contenedores secundarios, tarjetas |

**Bordes y sombras:**
- Esquinas suavizadas: `rounded-xl` o `rounded-2xl` en todos los contenedores (cards, modales, inputs).
- Elevaciones sutiles: `shadow-sm` como elevación por defecto. Evitar sombras pesadas (`shadow-xl`, `shadow-2xl`) que rompan la sobriedad institucional del sistema.

**Principio de aplicación:** `primary` se reserva para acciones críticas e identidad de marca; `tertiary` (azul) nunca debe confundirse con un color de marca — es exclusivo para alertas/notificaciones del sistema, de modo que el usuario aprenda a asociar azul = "algo del sistema requiere tu atención".

---

## 3. Maquetación de Componentes Core (basado en Google Stitch)

### 3.1 Layout Base — Persistent Sidebar

- Estructura de **grid de tres columnas** en pantallas de escritorio.
- **Columna izquierda (sidebar fija):**
  - Menú de navegación vertical: `Home`, `Campus Radar`, `Matchmaking`, `Marketplace`, `Wiki-Files`, `Job Board`.
  - Perfil del alumno verificado, con tag visible `@unsch.edu.pe`.
  - Botones inferiores: `Ajustes` y `Cerrar Sesión`.
- En mobile, este sidebar colapsa según el patrón responsive estándar de Tailwind (no se especifica un patrón fijo aquí; usar buen juicio: drawer, bottom nav, o hamburguesa, manteniendo siempre accesibles las 6 secciones de navegación).

### 3.2 Módulo Dashboard & Radar

- Caja de texto para publicar posts, **segmentados por Escuela Profesional** (el usuario elige o filtra por su escuela al publicar/ver contenido).
- Bloque "Radar" con medidores de estado en tiempo real, representados como **píldoras de estado dinámicas**:
  - Verde / "Fluido" → ej. Comedor.
  - Amarillo / "Moderado" → ej. Biblioteca.
  - (Mantener esta semántica de color en cualquier otro nodo de campus que se agregue: verde = fluido, amarillo = moderado, y de ser necesario rojo = saturado/congestionado).

### 3.3 Módulo Marketplace

- Rejilla (grid) de tarjetas de producto. Cada tarjeta **debe** renderizar obligatoriamente:
  1. Imagen del producto.
  2. Precio destacado en Crimson (`primary`), o en su lugar un tag de **"¡Trueque!"** si no es venta directa.
  3. Condición del artículo: `Nuevo`, `Como nuevo`, `Usado`.
  4. Nodo de entrega en el campus (ej. "Pabellón W", "Comedor Central").
  5. Tarjeta de identidad del vendedor con botón directo de chat.
- Ninguna tarjeta de Marketplace debe omitir alguno de estos cinco elementos.

### 3.4 Módulo Wiki — Banco de Archivos

- Navegación por **migas de pan (breadcrumbs)** que refleje la jerarquía académica de la UNSCH (Facultad → Escuela Profesional → Curso → Carpeta, según corresponda).
- Lista de archivos en formato tabla, con:
  - Medidor de votos (ej. "+24 votos").
  - Botón carmesí de descarga, especificando el **costo en tokens/créditos** de la descarga directamente sobre el botón o adyacente a él.

---

## 4. Manejo Senior de Casos de Borde y Estados Críticos

### 4.1 Error de Registro — Filtro de Exclusividad Institucional

- Formulario de registro centralizado.
- Si se detecta un correo inválido (cualquier dominio que no sea el institucional, ej. `@gmail.com`):
  - El input de correo muta a **borde rojo carmesí**.
  - El botón "Crear Cuenta" queda **bloqueado**.
  - Se despliega un contenedor de **feedback didáctico** (no un simple mensaje de error genérico) dirigido a ingresantes/"cachimbos", que:
    - Explica por qué se requiere el correo institucional.
    - Ofrece enlaces directos al manual de activación institucional.

### 4.2 Estado Vacío (Empty State) del Repositorio

- Vista limpia cuando una carpeta académica no tiene archivos.
- Debe incluir:
  - Ilustración minimalista.
  - Encabezado motivador, ej.: "Vaya, parece que nadie ha subido exámenes aquí todavía. 📭".
  - Botón gigante de llamada a la acción: **"Subir Primer Documento (+2 Créditos)"**, reforzando la gamificación del sistema de créditos.

### 4.3 Panel del Moderador

- Vista de administración densa en datos.
- Cola de reportes, donde cada tarjeta muestra:
  - Texto censurado entre comillas (el contenido reportado, mostrado de forma segura/censurada).
  - Motivo(s) de la denuncia.
  - Traza de auditoría del reporte (quién reportó, cuándo, historial de acciones previas si las hay).
  - Botones de acción definitiva: `[Restaurar Publicación]` o `[🚨 Baneo Permanente de Cuenta]`.
- Este panel solo debe ser alcanzable por roles autorizados (ver Sección 5 — Route Guards).

### 4.4 Ajustes de Privacidad e Historial de Créditos

- Panel dividido en dos bloques:
  - **Privacidad:** interruptores (toggles) limpios para activar/desactivar la visibilidad en el "Tinder de Tesis" (Matchmaking).
  - **Historial de créditos:** tabla estilo estado de cuenta bancario, mostrando de forma transparente:
    - Ingresos (ej. "+2 créditos por documento aprobado").
    - Egresos (ej. "-1 crédito por descarga").
    - Fecha de cada movimiento.

### 4.5 Flujo de Salida Seguro (Logout)

- Pantalla de confirmación completa al cerrar sesión.
- Debe desplegar una **alerta de seguridad explícita**, advirtiendo al alumno que si está en una computadora compartida (Biblioteca Central, laboratorios de facultades), debe **cerrar la pestaña del navegador** para destruir la sesión local por completo.

---

## 5. Integrador de API y Guards (Client-Side Logic)

- **Manejo de sesión:** interceptores de Axios/Fetch que inyectan automáticamente el Bearer JWT Token en cada petición dirigida al backend. Esto debe centralizarse (un solo punto de configuración), no repetirse manualmente en cada llamada.
- **Route Guards (protección de rutas):** lógica del lado del cliente que verifica el rol del usuario antes de renderizar componentes sensibles. Ejemplo normativo: el Panel de Moderación (Sección 4.3) solo se renderiza si el rol en el JWT es estrictamente `Administrativo` o `Docente/Moderador`. Cualquier otro rol debe ser redirigido o ver un estado de acceso denegado, nunca el panel parcialmente cargado.
- **Actualizaciones optimistas (Optimistic Updates):** al dar "Like" a un post o al reportar contenido, el frontend debe asumir éxito inmediato y reflejar el cambio visual al instante, revirtiendo el estado visual únicamente si el servidor responde con un código de error.

---

## 6. Reglas Específicas de Codificación para la IA (SDD Compliance)

Estas reglas son de cumplimiento obligatorio en todo el código generado para este proyecto:

1. **Código en inglés:** nombres de componentes, interfaces, funciones, hooks personalizados y variables de estado deben escribirse 100% en inglés (ej. `ProductCard`, `useUserCredits`, `isModerator`).
2. **Texto visible en español peruano neutro:** todo texto estático, etiquetas de botones, mensajes informativos y flujos conversacionales que el usuario final vea en pantalla deben estar redactados en español peruano neutro y claro — ni demasiado formal/técnico, ni con jerga regional excesiva. Los ejemplos dados en las Secciones 3 y 4 (ej. "Vaya, parece que nadie ha subido exámenes aquí todavía. 📭") son el tono de referencia.
3. **Reutilización de componentes atómicos:** priorizar siempre componentes atómicos reutilizables (`Button`, `Input`, `Toggle`, `Badge`, etc.) sobre la duplicación de clases de Tailwind. Si un patrón visual se repite dos o más veces en el proyecto, debe extraerse a un componente atómico antes de seguir replicándolo inline.

---

## Checklist rápido antes de entregar cualquier componente

- [ ] ¿Usa exclusivamente los 4 colores del Crimson Heritage Design System (Sección 2), sin tonos aproximados?
- [ ] ¿Usa `rounded-xl`/`rounded-2xl` y `shadow-sm` en contenedores?
- [ ] ¿El código (nombres, props, hooks) está en inglés y el texto visible en español peruano neutro?
- [ ] Si es una tarjeta de Marketplace, ¿incluye los 5 elementos obligatorios (Sección 3.3)?
- [ ] Si maneja una ruta sensible (moderación, admin), ¿implementa el Route Guard correspondiente (Sección 5)?
- [ ] Si es un estado de error/vacío, ¿sigue el patrón didáctico/gamificado descrito en la Sección 4, en vez de un mensaje genérico?
- [ ] ¿Reutiliza componentes atómicos existentes antes de crear estilos nuevos inline?
