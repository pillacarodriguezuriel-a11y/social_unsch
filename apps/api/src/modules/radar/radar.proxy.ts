import { NextFunction, Request, Response, Router } from 'express';
import { RADAR_ERROR_CODES } from '@social-unsch/contracts';
import { RadarModule } from './radar.module';

/**
 * Modo proxy del Radar (desactivado por defecto; RADAR_MODE=proxy).
 *
 * Reenvía /api/v1/radar/* a un servicio de radar cuyo origen se fija solo en la configuración del
 * servidor (RADAR_PROXY_TARGET). Garantías:
 * - Conserva método, ruta, query, cuerpo JSON y las cabeceras necesarias (Authorization incluida).
 * - Un único intento por solicitud: sin reintentos ni respaldo local, para no duplicar escrituras.
 * - Límite de tiempo configurable; al vencer responde 504 y al fallar la conexión, 502.
 * - Ningún dato de la solicitud puede cambiar el destino: solo se toman la ruta y la query.
 */

export type FetchLike = (input: string, init: RequestInit) => Promise<globalThis.Response>;

export interface RadarProxyOptions {
  target: URL;
  timeoutMs: number;
  fetchImpl?: FetchLike;
}

const FORWARDED_REQUEST_HEADERS = ['authorization', 'content-type', 'accept', 'accept-language', 'x-request-id'];
const FORWARDED_RESPONSE_HEADERS = ['content-type', 'cache-control', 'x-request-id'];
const METHODS_WITHOUT_BODY = new Set(['GET', 'HEAD']);

function joinPaths(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

/** URL de destino: origen y prefijo de la configuración + ruta y query de la solicitud. */
export function buildUpstreamUrl(target: URL, req: Pick<Request, 'baseUrl' | 'path' | 'originalUrl'>): string {
  const url = new URL(target.href);
  url.pathname = joinPaths(target.pathname, `${req.baseUrl}${req.path}`);
  const queryIndex = req.originalUrl.indexOf('?');
  url.search = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : '';
  url.hash = '';
  return url.toString();
}

function sendProxyError(res: Response, code: 'ERR_RADAR_UPSTREAM_UNAVAILABLE' | 'ERR_RADAR_UPSTREAM_TIMEOUT') {
  const message =
    code === 'ERR_RADAR_UPSTREAM_TIMEOUT'
      ? 'El servicio de radar no respondió a tiempo. Inténtelo más tarde.'
      : 'El servicio de radar no está disponible. Inténtelo más tarde.';
  res.status(RADAR_ERROR_CODES[code]).json({ error: true, message, code });
}

export function createRadarProxyModule({ target, timeoutMs, fetchImpl = fetch }: RadarProxyOptions): RadarModule {
  const router = Router();

  router.all('*', async (req: Request, res: Response, next: NextFunction) => {
    const headers: Record<string, string> = {};
    for (const name of FORWARDED_REQUEST_HEADERS) {
      const value = req.headers[name];
      if (typeof value === 'string') headers[name] = value;
    }
    if (req.ip) headers['x-forwarded-for'] = req.ip;
    headers['x-forwarded-proto'] = req.protocol;

    let body: string | undefined;
    if (!METHODS_WITHOUT_BODY.has(req.method) && req.body !== undefined) {
      body = JSON.stringify(req.body);
      headers['content-type'] = 'application/json';
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const upstream = await fetchImpl(buildUpstreamUrl(target, req), {
        method: req.method,
        headers,
        body,
        signal: controller.signal,
        redirect: 'manual',
      });
      const payload = Buffer.from(await upstream.arrayBuffer());
      for (const name of FORWARDED_RESPONSE_HEADERS) {
        const value = upstream.headers.get(name);
        if (value) res.setHeader(name, value);
      }
      res.status(upstream.status).send(payload);
    } catch (error) {
      if (res.headersSent) return next(error);
      if (controller.signal.aborted) return sendProxyError(res, 'ERR_RADAR_UPSTREAM_TIMEOUT');
      return sendProxyError(res, 'ERR_RADAR_UPSTREAM_UNAVAILABLE');
    } finally {
      clearTimeout(timer);
    }
  });

  return {
    mode: 'proxy',
    router,
    async checkReady() {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetchImpl(new URL('/health/live', target).toString(), {
          method: 'GET',
          signal: controller.signal,
        });
        return res.ok;
      } catch {
        return false;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

