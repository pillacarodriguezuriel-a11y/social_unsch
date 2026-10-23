import { Request, Response, Router } from 'express';

/**
 * Comprobaciones de salud.
 *
 * GET /health/live  → 200 si el proceso atiende solicitudes. No consulta dependencias.
 * GET /health/ready → estado de las dependencias:
 *   - 200 "ready"     todas responden;
 *   - 200 "degraded"  falla una dependencia no crítica (Redis/radar): el resto de la API funciona;
 *   - 503 "unavailable" falla una dependencia crítica (PostgreSQL).
 * Las respuestas solo indican "up"/"down": sin mensajes de error, URLs ni credenciales.
 */

export interface DependencyCheck {
  name: string;
  /** Crítica: sin ella la mayoría de las rutas fallan. */
  critical: boolean;
  check: () => Promise<boolean>;
}

export const DEFAULT_CHECK_TIMEOUT_MS = 2000;

async function runCheck(dep: DependencyCheck, timeoutMs: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  try {
    return await Promise.race([dep.check().catch(() => false), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function createHealthRouter(checks: DependencyCheck[], timeoutMs = DEFAULT_CHECK_TIMEOUT_MS): Router {
  const router = Router();

  router.get('/live', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  router.get('/ready', async (_req: Request, res: Response) => {
    const results = await Promise.all(checks.map(async (dep) => ({ dep, up: await runCheck(dep, timeoutMs) })));
    const criticalDown = results.some((r) => r.dep.critical && !r.up);
    const anyDown = results.some((r) => !r.up);
    const status = criticalDown ? 'unavailable' : anyDown ? 'degraded' : 'ready';
    res
      .status(criticalDown ? 503 : 200)
      .set('Cache-Control', 'no-store')
      .json({
        status,
        checks: Object.fromEntries(results.map((r) => [r.dep.name, r.up ? 'up' : 'down'])),
      });
  });

  return router;
}
