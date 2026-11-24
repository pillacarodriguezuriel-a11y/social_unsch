import http from 'http';
import https from 'https';
import { NextFunction, Request, Response, Router } from 'express';

/**
 * Modo proxy del dominio Feed (desactivado por defecto; FEED_MODE=proxy).
 *
 * Reenvía /api/v1/feed/* a un servicio de Feed cuyo origen se fija solo en
 * la configuración del servidor (FEED_PROXY_TARGET). Garantías:
 * - Conserva método, ruta, query, cuerpo JSON y cabeceras necesarias.
 * - Un único intento: sin reintentos ni respaldo local (un timeout no
 *   demuestra que la escritura falló; puede haberse confirmado antes de
 *   perder la respuesta).
 * - Límite de tiempo configurable; al vencer responde 504, al fallar la
 *   conexión responde 502.
 * - El destino no puede ser controlado por el cliente: solo se toman la
 *   ruta y la query de la solicitud original.
 */

const FORWARDED_REQUEST_HEADERS = ['authorization', 'content-type', 'accept', 'accept-language', 'x-request-id'];
const FORWARDED_RESPONSE_HEADERS = ['content-type', 'cache-control', 'x-request-id', 'content-length'];
const METHODS_WITHOUT_BODY = new Set(['GET', 'HEAD']);

export interface FeedProxyOptions {
  target: URL;
  timeoutMs: number;
  healthPath?: string;
}

export interface FeedProxyModule {
  router: Router;
  checkReady(): Promise<boolean>;
  close?(): void;
}

function joinPaths(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

export function buildUpstreamPath(targetPathname: string, req: Pick<Request, 'baseUrl' | 'path' | 'originalUrl'>): string {
  const pathname = joinPaths(targetPathname, `${req.baseUrl}${req.path}`);
  const queryIndex = req.originalUrl.indexOf('?');
  const search = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : '';
  return `${pathname}${search}`;
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

function sendProxyError(res: Response, code: 'ERR_FEED_UPSTREAM_UNAVAILABLE' | 'ERR_FEED_UPSTREAM_TIMEOUT') {
  const message =
    code === 'ERR_FEED_UPSTREAM_TIMEOUT'
      ? 'El servicio de Feed no respondió a tiempo. Inténtelo más tarde.'
      : 'El servicio de Feed no está disponible. Inténtelo más tarde.';
  res.locals.errorCode = code;
  res.status(code === 'ERR_FEED_UPSTREAM_TIMEOUT' ? 504 : 502).json({ error: true, message, code });
}

export function createFeedProxyModule({
  target,
  timeoutMs,
  healthPath = '/health/ready',
}: FeedProxyOptions): FeedProxyModule {
  const router = Router();
  const isHttps = target.protocol === 'https:';
  const transport = isHttps ? https : http;
  const agent = new transport.Agent({
    keepAlive: true,
    keepAliveMsecs: 30000,
    maxSockets: 64,
    maxFreeSockets: 32,
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
      sendProxyError(res, timedOut ? 'ERR_FEED_UPSTREAM_TIMEOUT' : 'ERR_FEED_UPSTREAM_UNAVAILABLE');
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
        upstreamRes.once('end', () => { settled = true; clearTimeout(timer); });
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
          { protocol: target.protocol, hostname, port, path: healthRequestPath, method: 'GET', agent },
          (upstreamRes) => {
            const code = upstreamRes.statusCode as number;
            upstreamRes.resume();
            upstreamRes.once('end', () => finish(code >= 200 && code < 300));
            upstreamRes.once('error', () => finish(false));
          }
        );
        const timer = setTimeout(() => { upstreamReq.destroy(); finish(false); }, timeoutMs);
        upstreamReq.once('error', () => finish(false));
        upstreamReq.end();
      });
    },
    close() {
      agent.destroy();
    },
  };
}
