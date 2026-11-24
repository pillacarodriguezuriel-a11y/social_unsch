'use strict';
// Agregación offline: nunca contacta servicios ni reproduce líneas/cuerpos de registros.
const fs = require('fs');
const readline = require('readline');
const { percentile } = require('./lib/measurement');
const ROUTES = new Set([
  '/health/live', '/health/ready', '/api/v1/radar/status', '/api/v1/radar/report',
  '/api/v1/catalogs', '/api/v1/auth/login', '/api/v1/auth/profile-me',
  '/api/v1/feed', '/api/v1/feed/',
]);
const SERVICES = new Set(['social-unsch-api', 'social-unsch-radar']);
const METHODS = new Set(['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS', 'HEAD']);

async function summarize(file, since, until) {
  const start = Date.parse(since);
  const end = Date.parse(until);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new Error('Ventana inválida');
  }
  const buckets = new Map();
  let ignored = 0;
  const input = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  for await (const line of input) {
    let record;
    try { record = JSON.parse(line); } catch { ignored++; continue; }
    const at = Date.parse(record?.timestamp);
    if (!(at >= start && at < end) || !SERVICES.has(record.service)
      || !ROUTES.has(record.path) || !METHODS.has(record.method)
      || !Number.isFinite(record.durationMs) || record.durationMs < 0
      || !Number.isInteger(record.statusCode) || record.statusCode < 100 || record.statusCode > 599) {
      ignored++;
      continue;
    }
    const windowStart = new Date(Math.floor(at / 300000) * 300000).toISOString();
    const key = [record.service, record.method, record.path, windowStart].join('|');
    const bucket = buckets.get(key) || {
      service: record.service, method: record.method, route: record.path, windowStart,
      latencies: [], errors5xx: 0, timeouts504: 0, success2xx: 0,
    };
    bucket.latencies.push(record.durationMs);
    bucket.errors5xx += Number(record.statusCode >= 500);
    bucket.timeouts504 += Number(record.statusCode === 504);
    bucket.success2xx += Number(record.statusCode >= 200 && record.statusCode < 300);
    buckets.set(key, bucket);
  }
  return {
    since, until, ignored,
    availability: 'unknown: request logs do not prove continuous availability; absent windows are missing data',
    buckets: [...buckets.values()].map(({ latencies, ...rest }) => {
      latencies.sort((a, b) => a - b);
      return {
        ...rest, requests: latencies.length,
        p50: percentile(latencies, 50), p95: percentile(latencies, 95), p99: percentile(latencies, 99),
      };
    }),
  };
}
if (require.main === module) {
  summarize(process.env.LOG_INPUT, process.env.OBS_SINCE, process.env.OBS_UNTIL)
    .then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(() => {
      console.error('No se pudo resumir: revise LOG_INPUT y ventana UTC OBS_SINCE/OBS_UNTIL.');
      process.exitCode = 1;
    });
}
module.exports = { summarize };
