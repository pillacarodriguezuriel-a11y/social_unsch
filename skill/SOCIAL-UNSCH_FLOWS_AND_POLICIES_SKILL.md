---
name: social-unsch-flows-and-policies
description: >
  Única Fuente de Verdad (Single Source of Truth) para las Máquinas de Estado, Flujos de Usuario
  Extremo a Extremo, Matriz de Moderación y Sanciones, Política de Privacidad (Ley N° 29733) y
  Casos de Borde Económicos del sistema SOCIAL-UNSCH. Usa esta skill SIEMPRE que el agente deba
  implementar o diseñar: el flujo de matchmaking académico (estados DISCOVERABLE → PENDING_MATCH
  → MATCHED), la lógica de la Ruta Sancristobalina (ROUTE_PUBLISHED → SEAT_CONFIRMED →
  ROUTE_COMPLETED), la aprobación de archivos del wiki-banco (FILE_PENDING_REVIEW → FILE_PUBLISHED
  / FILE_REJECTED), el sistema de sanciones por faltas Leve / Grave / Muy Grave, el control de
  créditos en edge cases (penalización por fraude, descargas duplicadas), la anonimización de
  datos de contacto en carpooling, o el modal de consentimiento de términos (campo
  has_accepted_terms). Dispara también cuando el usuario mencione: "estado de una solicitud",
  "baneo", "suspensión de cuenta", "créditos negativos", "privacidad", "Ley 29733", "términos
  y condiciones", "descarga gratuita", "suplantación de identidad", o cualquier flujo de
  moderación de SOCIAL-UNSCH. Esta skill es la autoridad máxima para el Agente Frontend
  (modales, pantallas de bloqueo, alertas) y el Agente Backend (controladores de estado,
  validaciones de baneo, lógica de créditos).
---

# SOCIAL-UNSCH — Flujos, Políticas y Moderación (SSoT)

Eres el **Lead Product Manager, Analista de Negocios y Compliance Officer** de SOCIAL-UNSCH.
Todo flujo de usuario, máquina de estado, sanción y política de privacidad implementada debe
respetar este documento como autoridad máxima.

> **PRINCIPIO RECTOR**: Los estados de módulos y las sanciones son atómicos e irreversibles
> excepto donde esta skill indique explícitamente lo contrario. Las transiciones de estado
> se ejecutan siempre en el backend dentro de transacciones de base de datos.

---

## Índice de Secciones

| Sección | Contenido | Archivo de Referencia |
|---------|-----------|----------------------|
| 1 | Máquinas de Estado — Flujos Críticos | `references/state_machines.md` |
| 2 | Matriz de Moderación y Sanciones | `references/moderation_matrix.md` |
| 3 | Casos de Borde — Economía de Créditos | (en este archivo, Sección 3) |
| 4 | Políticas de Privacidad y Cumplimiento | (en este archivo, Sección 4) |
| 5 | Directrices para Agentes de IA | (en este archivo, Sección 5) |

---

## 1. Máquinas de Estado

> 📄 Lee el archivo completo: `references/state_machines.md`
>
> Contiene los diagramas de transición de estado para:
> - **Flujo A**: Ciclo de Conexión Académica (Matchmaking)
> - **Flujo B**: Ruta Sancristobalina (Carpooling)
> - **Flujo C**: Aprobación de Archivos en el Wiki-Banco

**Resumen de estados canónicos:**

```
MATCHMAKING:   DISCOVERABLE → PENDING_MATCH → MATCHED
                                           → DISCOVERABLE (rechazo, cooldown 30 días)

CARPOOLING:    ROUTE_PUBLISHED → SEAT_REQUESTED → SEAT_CONFIRMED
                                               → ROUTE_PUBLISHED (rechazo)
               SEAT_CONFIRMED → ROUTE_COMPLETED (auto, +2h tras hora de salida)

WIKI-ARCHIVO:  FILE_PENDING_REVIEW → FILE_PUBLISHED (+2 créditos atómicos al autor)
                                  → FILE_REJECTED  (notificación + purga en 7 días)
```

---

## 2. Moderación y Sanciones

> 📄 Lee el archivo completo: `references/moderation_matrix.md`
>
> Contiene: regla de supresión automática (>= 3 reportes), clasificación de infracciones,
> escalas de consecuencias, protocolo de derivación al Tribunal de Honor UNSCH.

**Resumen de gravedad:**

| Nivel | Ejemplos | Consecuencia inmediata |
|-------|----------|----------------------|
| **Leve** | Spam, off-topic | Ocultar post. 3 faltas/mes → suspensión 48 h |
| **Grave** | Estafa, insultos, venta de exámenes | Supresión + suspensión 7 días + créditos congelados |
| **Muy Grave** | Acoso sexual, suplantación, difamación | Bloqueo permanente + exportación PDF al Tribunal de Honor |

**Regla automática invariante:**
```
Si reportes_coincidentes(post_id, motivo) >= 3:
    post.is_visible = false   ← inmediato, atómico
    → enrutar a cola administrativa
```

---

## 3. Casos de Borde — Economía de Créditos (Wiki)

Estas reglas rompen excepcionalmente los límites normales del sistema de créditos. El backend
debe manejarlos con transacciones explícitas y registros en `wiki_credits_log`.

### 3.1 Penalización por Contenido Fraudulento
```
DISPARADOR: Moderador elimina un archivo que ya estaba en estado FILE_PUBLISHED
            por ser falso o fraudulento.

ACCIÓN OBLIGATORIA (atómica):
  1. UPDATE wiki_files SET status = 'rejected' WHERE id = file_id
  2. UPDATE users SET wiki_credits = wiki_credits - 2 WHERE id = uploader_id
     → El saldo puede quedar en negativo (excepción controlada a la regla general)
  3. INSERT INTO wiki_credits_log (user_id, delta, reason, file_id)
     VALUES (uploader_id, -2, 'penalty_fraudulent_content', file_id)
  4. Notificar al infractor con mensaje en español indicando el motivo

NOTA: La restricción CHECK (wiki_credits >= 0) debe estar deshabilitada o manejada
con una función de BD que permita valores negativos solo en este flujo específico.
Usar columna separada 'wiki_credits_penalty' si se prefiere evitar romper el constraint.
```

### 3.2 Descargas Duplicadas (Mismo Semestre)
```
DISPARADOR: Usuario intenta descargar un archivo que ya descargó previamente.

LÓGICA DE VERIFICACIÓN (antes de descontar créditos):
  1. Buscar en wiki_credits_log:
     SELECT * FROM wiki_credits_log
     WHERE user_id = req.user_id
       AND file_id = requested_file_id
       AND reason = 'file_downloaded'
       AND created_at >= [inicio_semestre_vigente]

  2. Si existe registro → permitir descarga SIN descontar crédito
                        → registrar en log con delta = 0, reason = 'redownload_free'
  3. Si NO existe      → descontar -1 crédito (flujo normal)

DEFINICIÓN DE SEMESTRE VIGENTE:
  2026-I: 01-Mar-2026 al 31-Jul-2026
  2026-II: 01-Ago-2026 al 31-Ene-2027
  (Ajustar según calendario académico oficial UNSCH)
```

---

## 4. Políticas de Privacidad y Cumplimiento (Ley N° 29733)

Estas reglas implementan las obligaciones de la **Ley de Protección de Datos Personales del
Perú (Ley N° 29733)** en el contexto de la plataforma SOCIAL-UNSCH.

### 4.1 Consentimiento Obligatorio de Términos y Condiciones
```
REGLA: Ningún endpoint de la API (excepto /auth/register y /auth/login) debe responder
con éxito si el campo has_accepted_terms del usuario es FALSE.

FLUJO DE ENFORCEMENT:
  En authMiddleware (ejecutar DESPUÉS de validar el JWT):
    IF req.user.has_accepted_terms == false:
        RETURN 403 {
          "error": true,
          "message": "Debes aceptar los Términos y Condiciones para continuar.",
          "code": "ERR_TERMS_NOT_ACCEPTED"
        }

FLUJO DE ACEPTACIÓN:
  POST /api/v1/users/accept-terms
    → Verificar JWT válido
    → UPDATE users SET has_accepted_terms = true,
                       terms_accepted_at = NOW()
      WHERE id = req.user.user_id
    → Retornar nuevo JWT con claim has_accepted_terms: true (opcional)

FRONTEND (Agente UI):
  Al recibir ERR_TERMS_NOT_ACCEPTED, mostrar modal de Términos y Condiciones.
  El modal NO puede cerrarse sin aceptar. El botón "Rechazar" cierra la sesión.
```

### 4.2 Anonimización en la Ruta Sancristobalina (Carpooling)
```
REGLA CRÍTICA (Ley N° 29733, Art. 13 — Consentimiento):
  Los datos de contacto directos (número telefónico, enlace WhatsApp, nombre completo)
  de los participantes de una ruta de carpooling son datos personales sensibles.

REGLAS DE VISIBILIDAD:

  En el FEED PÚBLICO de rutas (GET /api/v1/carpooling):
    → Retornar SOLO: {route_id, origin_district, destination, departure_time,
                      available_seats, price_soles, driver_alias}
    → NUNCA retornar: phone_number, whatsapp_link, full_name, email

  Al SOLICITAR UN ASIENTO (POST /api/v1/carpooling/{route_id}/request):
    → El pasajero ve datos del conductor: SOLO driver_alias + available_seats
    → El conductor ve del pasajero: SOLO nombre de pila + carrera + ciclo

  Al CONFIRMAR LA SOLICITUD (PATCH /api/v1/carpooling/{route_id}/confirm):
    → SOLO en este momento se desenmascaran los datos de contacto
    → El pasajero recibe: phone_number O whatsapp_link del conductor
    → El conductor recibe: phone_number O whatsapp_link del pasajero
    → Este dato se transmite UNA SOLA VEZ y no se almacena en el feed

IMPLEMENTACIÓN BACKEND:
  Nunca incluir campos de contacto en las queries de listado público.
  Usar una función separada get_contact_details(route_id, requesting_user_id)
  que verifique que existe un registro SEAT_CONFIRMED antes de retornar datos.
```

### 4.3 Retención y Eliminación de Datos
```
- Archivos rechazados en el wiki: purgar de almacenamiento tras 7 días
- Datos de rutas completadas: anonimizar tras 30 días (eliminar contactos, mantener estadísticas)
- Logs de moderación: retener 1 año para auditoría, luego anonimizar user_id
- Usuarios baneados permanentemente: mantener email en blocklist (no eliminar) para impedir
  reregistro con la misma cuenta @unsch.edu.pe
```

---

## 5. Directrices de Alineación para Agentes de IA

### Agente Frontend (UI/UX)
- Mostrar modal de Términos al recibir `ERR_TERMS_NOT_ACCEPTED` — no puede ser omitido
- Mostrar pantalla de suspensión temporal con contador de tiempo restante al recibir
  `ERR_ACCOUNT_SUSPENDED` (incluir horas restantes en el payload del error)
- En el feed de carpooling, nunca renderizar campos de contacto aunque lleguen en la respuesta
- En matchmaking: ocultar el perfil rechazado de la cola por 30 días (lógica en frontend
  complementaria a la del backend)
- Indicar visualmente el estado actual de cada módulo (badge de estado en UI)

### Agente Backend (Servidor / Controladores)
- Validar `has_accepted_terms` en el middleware DESPUÉS de validar el JWT, en cada request
- Verificar estado de cuenta (`is_suspended`, `suspension_until`, `is_permanently_banned`)
  antes de emitir cualquier JWT, incluso en login exitoso
- Todas las transiciones de estado de máquinas de estado deben ejecutarse en transacciones
  (`BEGIN / COMMIT / ROLLBACK`) — nunca actualizaciones parciales
- El log `wiki_credits_log` es inmutable: solo INSERT, nunca UPDATE ni DELETE
- Al exportar casos Muy Graves al Tribunal de Honor: generar PDF con campos
  {user_id, email, infraction_type, evidence_post_id, timestamp, reporter_count}
