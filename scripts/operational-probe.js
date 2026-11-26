'use strict';
// Una sola ronda GET. No cron, escrituras, cuerpos de negocio ni tokens en la evidencia.
const fs = require('fs');
const { execFileSync } = require('child_process');
const { RadarStatusResponseSchema, FeedListResponseSchema } = require('@social-unsch/contracts');

async function probe(base, route, token) {
  const url = new URL(base);
  if (url.username || url.password || url.search || url.hash || !['https:', 'http:'].includes(url.protocol)) throw new Error('Origen inválido');
  const started = performance.now();
  const row = { at: new Date().toISOString(), origin: url.origin, route };
  try {
    const res = await fetch(new URL(route, url), {
      headers: token ? { authorization: `Bearer ${token}` } : {},
      redirect: 'manual', signal: AbortSignal.timeout(45000),
    });
    const body = await res.json().catch(() => null);
    row.http = res.status;
    if (route.startsWith('/health/')) {
      row.status = ['ok', 'ready', 'degraded', 'unavailable'].includes(body?.status) ? body.status : null;
      row.checks = Object.fromEntries(Object.entries(body?.checks || {}).filter(([k,v]) => ['database','radar','redis','feed'].includes(k) && ['up','down'].includes(v)));
    }
    if (route.endsWith('/radar/status') && token) row.contract = RadarStatusResponseSchema.safeParse(body).success;
    if (route.endsWith('/feed') && token) row.contract = FeedListResponseSchema.safeParse(body).success;
    if (res.status === 401) row.authRejected = true;
  } catch (e) { row.error = e.name === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK_ERROR'; }
  row.durationMs = Math.round((performance.now() - started) * 100) / 100;
  return row;
}

async function main() {
  if (!process.env.PROBE_API) throw new Error('Defina PROBE_API; no hay destino por defecto');
  const rows = [];
  const authenticated = new Set(['/api/v1/radar/status', '/api/v1/feed']);
  for (const route of ['/health/live','/health/ready','/api/v1/catalogs','/api/v1/radar/status','/api/v1/feed']) rows.push(await probe(process.env.PROBE_API, route, authenticated.has(route) ? process.env.PROBE_TOKEN : undefined));
  if (process.env.PROBE_RADAR) for (const route of ['/health/live','/health/ready','/api/v1/radar/status']) rows.push(await probe(process.env.PROBE_RADAR, route));
  // Sin token: comprueba que el servicio Feed exige autenticación por sí mismo y no confía en la API.
  if (process.env.PROBE_FEED) for (const route of ['/health/live','/health/ready','/api/v1/feed']) rows.push(await probe(process.env.PROBE_FEED, route));
  const out = { collectedAt: new Date().toISOString(), collectorCommit: execFileSync('git',['rev-parse','HEAD']).toString().trim(), deployedCommit: process.env.PROBE_DEPLOYED_COMMIT || null, environment: process.env.PROBE_ENV || 'unspecified', method: 'single GET round; 45s observation timeout, not application timeout', rows };
  if (process.env.PROBE_OUT) fs.writeFileSync(process.env.PROBE_OUT, JSON.stringify(out,null,2)+'\n', { flag: 'wx' });
  console.log(JSON.stringify(out,null,2));
}
if (require.main === module) main().catch(() => { console.error('Sonda fallida; revise configuración y archivo de salida (no se sobrescribe).'); process.exitCode=1; });
module.exports = { probe };
