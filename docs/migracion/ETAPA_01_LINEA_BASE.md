# Etapa 1 — Línea base de SOCIAL-UNSCH

Fecha: 2026-10-10. **Resultado: Cierre local completado.** La estabilización de la línea base local (instalación reproducible, suite de pruebas, tipado estricto, verificación de Radar en Redis aislado y documentación) está finalizada. La recuperación de la infraestructura remota permanece como pendiente del propietario en los paneles de Supabase, Render, Upstash y Vercel.

Documentos complementarios: [INVENTARIO_CONFIGURACION.md](INVENTARIO_CONFIGURACION.md) (qué hay y estado de componentes) y [RESULTADOS_VERIFICACION.md](RESULTADOS_VERIFICACION.md) (comandos ejecutados, salidas y evidencias).

## 1. Referencia

| Dato | Valor |
|---|---|
| Carpeta | `D:\social_unsch` |
| Remoto | `https://github.com/pillacarodriguezuriel-a11y/social_unsch.git` |
| Rama de referencia | `main` = `origin/main` |
| SHA inicial | `a3813b0e7750855433c8c297cd1831e637531798` |
| Rama de trabajo | `chore/etapa-1-linea-base` |
| Respaldo del estado inicial | `refs/backup/etapa-1/estado-inicial` → `97e26c9d511eca9cae36de68665e9f672f12e97c` |

La referencia de respaldo `refs/backup/etapa-1/estado-inicial` se conserva de forma permanente en Git local. Representa el árbol completo antes de iniciar las modificaciones de la etapa 1.

## 2. Comparación local ↔ remoto

Tras `git fetch`: `HEAD` y `origin/main` compartían el commit base `a3813b0`.
Los cambios locales se han clasificado y ordenado para este cierre:

| Elemento | Clasificación | Destino en Cierre Etapa 1 |
|---|---|---|
| `package.json` | Configuración: scripts `test*`, dev/migration flags, Jest devDependencies | Incluido en commit |
| `package-lock.json` | Sincronización exacta de lockfile para dependencias opcionales WASM | Incluido en commit |
| `tsconfig.jest.json` | Configuración TS de pruebas (`rootDir: "."`, modo estricto) | Incluido en commit |
| `jest.config.ts` | Configuración del harness Jest | Incluido en commit |
| `tests/` (18 archivos) | Suite completa de pruebas unitarias y de integración (con dobles) | Incluido en commit |
| `.gitignore` | Reglas añadidas para ignorar `/coverage`, `__pycache__/`, `*.pyc` | Incluido en commit |
| `.env.example` | Plantilla de variables de entorno seguras con valores dummy | Incluido en commit |
| `scripts/diagnostico-conexiones.js` | Script de diagnóstico seguro de solo lectura | Incluido en commit |
| `docs/migracion/*.md` | Documentación técnica de la línea base y resultados | Incluido en commit |
| `src/database/migrations/migrate_all.ts` | Corrección preexistente de flag de compilador en orquestador | **Excluido del commit** (tratado por separado) |
| Archivos generados / externos (`documento_qa/`, `skill/`, `*.docx`, `*.md` de reporte anterior) | Informes externos y artefactos previos | Fuera de seguimiento |

## 3. Componentes

- **Frontend**: Next.js 14.2.35 (App Router), React 18, Tailwind 4. 11 pantallas. Autenticación, términos, radar, feed y matchmaking consumen la API; el resto en `localStorage`.
- **Backend**: Express 4 en TypeScript, 6 módulos, 14 rutas bajo `/api/v1`, JWT RS256.
- **Datos**: PostgreSQL (16 tablas) y Redis (radar, TTL de 15 minutos con consenso de 3 votos).
- **Paquete único** para frontend y backend; sin CI remoto previo.

## 4. Estado de los proveedores remotos

| Proveedor | Estado observado | Detalle / Hipótesis |
|---|---|---|
| Vercel | En línea | Producción desplegada desde `a3813b0`, HTTP 200 en `/login`; apunta a Render |
| Render | En ejecución | CORS funcional hacia Vercel; respuesta inicial ~32 s (hibernación de instancia gratuita) |
| Supabase | **Pausado** | Hipótesis: la inaccesibilidad de la base causa el HTTP 500 en `/api/v1/auth/login`. Fecha de reanudación disponible hasta el **31 de agosto de 2027** según captura oficial de panel |
| Upstash | **No verificado** | Registros visuales previos indicaban "DELETED". Pendiente comprobación en consola |

> [!IMPORTANT]
> El origen del error 500 al iniciar sesión en producción se mantiene formalmente como una **hipótesis técnica** hasta que se examinen los registros (*runtime logs*) en el panel de Render. Asimismo, el plazo para reanudar Supabase no se infiere de fechas de despliegue: la interfaz de Supabase especifica explícitamente disponibilidad de reactivación hasta el 31 de agosto de 2027.

## 5. Cambios consolidados en el cierre local

1. **Instalación reproducible (`npm ci`)**:
   - Se resolvió la desincronización de `package-lock.json` mediante `npm install --package-lock-only`, manteniendo estrictamente las versiones fijadas de las dependencias.
   - Se verificó mediante una ejecución limpia de `npm ci` en un directorio temporal aislado sin secretos (585 paquetes instalados, código de salida 0).
2. **Suite de pruebas y TypeScript**:
   - Se ajustó `"rootDir": "."` en `tsconfig.jest.json` permitiendo incluir `tests/` y `src/` sin debilitar la rigurosidad del tipado estricto.
   - `tsc -p tsconfig.jest.json` pasa con 0 errores.
   - `npm test`: 18 suites de prueba y 363 pruebas pasan al 100%.
   - Cobertura global: Sentencias 95.25%, Ramas 92.85%, Funciones 98.41%, Líneas 95.38% (supera el umbral del 90%).
   - **Naturaleza de las pruebas**: Todas las 18 suites actuales emplean **dobles de prueba** (`jest.mock` para PostgreSQL, Redis, JWT y bcrypt). Ninguna prueba automatizada actual ataca servicios reales.
3. **Verificación local del Radar y aislamiento de puertos**:
   - Se ejecutó un contenedor efímero de Redis (`social_unsch_disposable_redis_etapa1`) en el puerto libre `127.0.0.1:56379`.
   - Se completó el ciclo real de votación: voto 1 (1/3), voto 2 (2/3), rechazo de voto duplicado, y voto 3 (consenso 3/3 alcanzado, `updated: true`).
   - Se verificó la lectura mediante `RadarService.getStatus()` y directamente en Redis: `radar:comedor:status` almacenó el estado con `TTL` de 900 segundos.
   - Se ejecutó el servidor HTTP en el puerto libre `43000`, confirmando la respuesta de `POST /api/v1/radar/report` y `GET /api/v1/radar/status`.
   - El contenedor efímero fue destruido inmediatamente después de la prueba. Los contenedores ajenos al proyecto (`buzon-comedor-unsch-*`, `agrocontrol-*`) y los contenedores previos (`social_unsch_postgres`, `social_unsch_redis`) permanecen en ejecución sin alteración en sus políticas de reinicio.

## 6. Tratamiento por separado de `migrate_all.ts`

El archivo `src/database/migrations/migrate_all.ts` presenta una modificación de una sola línea:
```diff
- execSync(`npx ts-node "${resolvedPath}"`, { stdio: 'inherit' });
+ execSync(`npx ts-node --project tsconfig.backend.json "${resolvedPath}"`, { stdio: 'inherit' });
```
- **Propósito**: Asegurar que al orquestar los pasos de migración, los subprocesos de `ts-node` utilicen la configuración de compilador de Node16 (`tsconfig.backend.json`) en lugar de adoptar el `tsconfig.json` del frontend por omisión.
- **Tratamiento**: Corresponde al subsistema de migraciones de base de datos. Para no mezclarlo silenciosamente con el commit de infraestructura y pruebas de la Etapa 1, queda documentado aquí y se reserva para ser integrado en la **Etapa 2**, donde se abordará la reestructuración completa del pipeline de migraciones.

## 7. Lista de comprobaciones de infraestructura para el propietario

Guía de verificación en paneles externos sin compartir credenciales ni contraseñas:

### A. Panel de Supabase
- [ ] Acceder al proyecto de `social_unsch` y confirmar el estado actual ("Paused").
- [ ] Verificar la fecha de gracia para reanudación que muestra el panel (indicada hasta el 31 de agosto de 2027).
- [ ] Pulsar la opción "Restore project" / "Resume project" para reactivar la base de datos PostgreSQL.
- [ ] En *Settings -> Database*, revisar la cadena del Connection Pooler (modo Session o Transaction) y verificar que el host y puerto coincidan con los esperados por Render.
- [ ] Descargar una copia de respaldo manual (*Database -> Backups*) una vez el servicio esté activo.

### B. Panel de Render
- [ ] En el servicio web `social-unsch`, abrir la pestaña **Logs** y filtrar por los errores recientes (HTTP 500 en `/api/v1/auth/login`) para confirmar si la causa raíz es efectivamente `Connection timeout` / `ECONNREFUSED` hacia Supabase.
- [ ] En **Environment**, validar la existencia de las variables esenciales: `DATABASE_URL`, `REDIS_URL`, `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `ALLOWED_ORIGINS`, `NODE_ENV=production`.
- [ ] En **Settings**, constatar la rama de despliegue (`main`), Start Command (`npm start`) y Build Command (`npm run build`).

### C. Panel de Upstash (Redis)
- [ ] Comprobar el estado de la base de datos de Redis: si está marcada como "DELETED", revisar si el botón "Restore" sigue habilitado.
- [ ] Si la base está activa o restaurada, verificar si existen llaves almacenadas para determinar si existía información de sesión o persistente (evitando suponer que todo es descartable sin comprobarlo).
- [ ] Si se reactiva o se aprovisiona una nueva base, verificar que la URL use el protocolo seguro TLS (`rediss://...`) y que coincida con `REDIS_URL` en Render.

### D. Panel de Vercel
- [ ] En el proyecto frontend, confirmar que el último despliegue provenga de `main`.
- [ ] En **Settings -> Environment Variables**, confirmar que `NEXT_PUBLIC_API_URL` apunte a `https://social-unsch.onrender.com/api/v1`.

## 8. Preparación para la Etapa 2 (Plan Priorizado)

Las correcciones de la Etapa 2 se desarrollarán a nivel local en la base de código y suites de pruebas sin necesidad de esperar a que la infraestructura de producción esté recuperada. Las pruebas remotas y despliegues requerirán la previa validación de la infraestructura externa.

Listado priorizado para la Etapa 2:
1. **Separar migraciones de seeds**: Desacoplar la creación de esquema de la inserción de datos de prueba (`seed.sql`).
2. **Evitar cargas destructivas sobre datos existentes**: Reemplazar sentencias `DELETE FROM professional_schools; DELETE FROM faculties;` en `add_canonical_data.sql` por cláusulas idempotentes no destructivas (`INSERT ... ON CONFLICT DO NOTHING / UPDATE`).
3. **Propagar fallos con códigos de salida correctos**: Modificar los scripts ejecutores de migración para que ante cualquier error de consulta SQL emitan un `process.exit(1)`, impidiendo que `migrate_all` reporte falso éxito.
4. **Revisar la asignación de roles en el registro**: Auditar el controlador y servicio de autenticación para asegurar que los usuarios comunes no puedan autoasignarse roles administrativos ni saltar validaciones de dominio universitario.
5. **Corregir inconsistencias entre consultas y esquema**: Sincronizar discrepancias entre columnas de base de datos y repositorios de `carpooling`, `matchmaking` y `feed`.
6. **Incorporar pruebas con PostgreSQL y Redis reales para los flujos críticos**: Configurar un arnés de pruebas de integración con contenedores Docker reales (o base de pruebas local) para verificar el SQL real, transacciones y el script Lua de Redis sin dobles.

## 9. Instrucciones para revertir cambios locales

Si en algún momento se desea restaurar el estado inicial exacto de la Etapa 1:
```bash
git diff refs/backup/etapa-1/estado-inicial
git checkout refs/backup/etapa-1/estado-inicial -- <ruta>
```
La referencia `refs/backup/etapa-1/estado-inicial` garantiza la preservación inalterada del estado original.
