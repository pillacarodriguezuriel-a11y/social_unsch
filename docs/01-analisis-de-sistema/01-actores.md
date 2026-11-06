# Actores

## Actores humanos

El sistema reconoce cuatro roles, definidos como tipo enumerado en la base de datos ([001_base_schema.sql](../../apps/api/src/database/migrations/sql/001_base_schema.sql)) y como constantes en [roles.ts](../../apps/api/src/shared/auth/roles.ts).

| Actor | Rol en el sistema | Cómo obtiene la cuenta | Qué puede hacer hoy |
|---|---|---|---|
| Estudiante | `student` | Registro público | Todo lo que ofrece la API |
| Egresado | `alumnus` | Registro público | Lo mismo que el estudiante |
| Docente | `professor` | Registro público | Lo mismo que el estudiante |
| Administrador | `administrator` | No puede registrarse por la vía pública | En la API, lo mismo que cualquier usuario autenticado |
| Visitante sin sesión | — | — | Registrarse, iniciar sesión y consultar catálogos |

Tres precisiones que conviene tener presentes:

- **Los roles públicos son declarativos.** Quien se registra elige ser estudiante, egresado o docente; el sistema no lo contrasta con ningún padrón. El propio código lo advierte en [roles.ts](../../apps/api/src/shared/auth/roles.ts).
- **La API no diferencia permisos por rol.** El único control de rol en el backend es impedir que alguien se registre como administrador. Todas las rutas protegidas usan el mismo control (`requireAuth`), que solo comprueba que el token sea válido ([auth.middleware.ts](../../apps/api/src/middlewares/auth.middleware.ts)).
- **El administrador solo existe de forma distinta en el frontend.** La consola de moderación comprueba el rol leyendo `localStorage` y trabaja con datos simulados ([ModerationConsole.tsx](../../apps/web/components/ui/ModerationConsole.tsx)). No hay procedimiento versionado para crear una cuenta administradora fuera del seed de demostración local.

## Roles dentro de un flujo

Algunos actores no son roles de cuenta, sino papeles que un usuario asume en un flujo:

| Papel | Flujo | Cómo se determina |
|---|---|---|
| Conductor | Carpooling | Es el `driver_id` de la ruta; solo él puede confirmar asientos |
| Pasajero | Carpooling | Quien solicita un asiento; no puede ser el conductor de esa ruta |
| Emisor y receptor | Matchmaking | Quien envía la interacción y el dueño del perfil que la recibe |
| Reportante | Radar | Cualquier usuario autenticado; su identificador evita votos duplicados |

## Sistemas externos

| Sistema | Papel | Estado |
|---|---|---|
| PostgreSQL | Almacén relacional de usuarios, publicaciones, matchmaking y carpooling | Implementado; proveedor previsto: Supabase |
| Redis | Almacén efímero del radar | Implementado; proveedor previsto: Upstash |
| Vercel | Alojamiento del frontend | Verificado por observación externa |
| Render | Alojamiento de la API | Verificado por observación externa |
| GitHub | Repositorio y origen de los despliegues | Verificado |

El detalle de qué se verificó de cada plataforma está en el [mapa de despliegue](../05-despliegue-y-operacion/01-mapa-de-despliegue.md).

No existen integraciones con correo electrónico, mensajería, pagos ni sistemas académicos de la universidad.

## Actores de operación

| Actor | Responsabilidad | Observación |
|---|---|---|
| Propietario del proyecto | Administra las cuentas de las plataformas, ejecuta migraciones y fusiona cambios | Única persona con acceso a los paneles |
| Desarrollador | Modifica el código y ejecuta las pruebas | Sin acceso a producción por defecto |

[← Índice](../README.md)
