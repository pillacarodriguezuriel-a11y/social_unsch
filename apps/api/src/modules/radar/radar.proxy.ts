import http from 'http';
import https from 'https';
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
 * - Por defecto usa transporte nativo http/https con pool keep-alive persistente y streaming directo,
 *   evitando la sobrecarga de Web Fetch (WHATWG Streams/ArrayBuffer) y doble hashing ETag de Express.
 */

export type FetchLike = (input: string, init: RequestInit) => Promise<globalThis.Response>;

export interface RadarProxyOptions {
  target: URL;
  timeoutMs: number;
  fetchImpl?: FetchLike;
  healthPath?: string;
}

const FORWARDED_REQUEST_HEADERS = ['authorization', 'content-type', 'accept', 'accept-language', 'x-request-id'];
const FORWARDED_RESPONSE_HEADERS = ['content-type', 'cache-control', 'x-request-id', 'content-length'];
const METHODS_WITHOUT_BODY = new Set(['GET', 'HEAD']);

function joinPaths(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

/** Ruta y query de destino (sin esquema ni host) fijada al prefijo configurado. */
function buildUpstreamPath(targetPathname: string, req: Pick<Request, 'baseUrl' | 'path' | 'originalUrl'>): string {
  const pathname = joinPaths(targetPathname, `${req.baseUrl}${req.path}`);
  const queryIndex = req.originalUrl.indexOf('?');
  const search = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : '';
  return `${pathname}${search}`;
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
  res.locals.errorCode = code;
  res.status(RADAR_ERROR_CODES[code]).json({ error: true, message, code });
}

function buildForwardHeaders(req: Request): { headers: Record<string, string>; body?: string } {
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
    headers['content-length'] = String(Buffer.byteLength(body));
  }
  return { headers, body };
}

export function createRadarProxyModule({ target, timeoutMs, fetchImpl, healthPath = '/health/live' }: RadarProxyOptions): RadarModule {
  const router = Router();

  if (fetchImpl) {
    router.all('*', async (req: Request, res: Response, next: NextFunction) => {
      const { headers, body } = buildForwardHeaders(req);
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
        res.status(upstream.status).end(payload);
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
          const res = await fetchImpl(new URL(healthPath, target).toString(), {
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

  const isHttps = target.protocol === 'https:';
  const transport = isHttps ? https : http;
  const agent = new transport.Agent({
    keepAlive: true,
    keepAliveMsecs: 30000,
    maxSockets: 128,
    maxFreeSockets: 64,
  });
  const hostname = target.hostname;
  const port = target.port ? Number(target.port) : isHttps ? 443 : 80;
  const healthUrl = new URL(healthPath, target);
  const healthRequestPath = `${healthUrl.pathname}${healthUrl.search}`;

  router.all('*', (req: Request, res: Response, next: NextFunction) => {
    const { headers, body } = buildForwardHeaders(req);
    let settled = false;
    let timedOut = false;

    const handleError = (error: Error) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      if (res.headersSent) return next(error);
      sendProxyError(res, timedOut ? 'ERR_RADAR_UPSTREAM_TIMEOUT' : 'ERR_RADAR_UPSTREAM_UNAVAILABLE');
    };

    const upstreamReq = transport.request(
      {
        protocol: target.protocol,
        hostname,
        port,
        path: buildUpstreamPath(target.pathname, req),
        method: req.method,
        headers,
        agent,
      },
      (upstreamRes) => {
        for (const name of FORWARDED_RESPONSE_HEADERS) {
          const value = upstreamRes.headers[name];
          if (typeof value === 'string') res.setHeader(name, value);
        }
        res.status(upstreamRes.statusCode as number);
        upstreamRes.once('end', () => {
          settled = true;
          clearTimeout(timer);
        });
        upstreamRes.once('error', handleError);
        upstreamRes.pipe(res);
      }
    );

    const timer = setTimeout(() => {
      timedOut = true;
      upstreamReq.destroy();
    }, timeoutMs);

    res.once('close', () => {
      clearTimeout(timer);
      if (!res.writableEnded) upstreamReq.destroy();
    });

    upstreamReq.once('error', handleError);
    upstreamReq.end(body);
  });

  return {
    mode: 'proxy',
    router,
    checkReady() {
      return new Promise<boolean>((resolve) => {
        let done = false;
        const finish = (ok: boolean) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve(ok);
        };
        const upstreamReq = transport.request(
          {
            protocol: target.protocol,
            hostname,
            port,
            path: healthRequestPath,
            method: 'GET',
            agent,
          },
          (upstreamRes) => {
            const code = upstreamRes.statusCode as number;
            upstreamRes.resume();
            upstreamRes.once('end', () => finish(code >= 200 && code < 300));
            upstreamRes.once('error', () => finish(false));
          }
        );
        const timer = setTimeout(() => {
          upstreamReq.destroy();
          finish(false);
        }, timeoutMs);
        upstreamReq.once('error', () => finish(false));
        upstreamReq.end();
      });
    },
    close() {
      agent.destroy();
    },
  };
}

