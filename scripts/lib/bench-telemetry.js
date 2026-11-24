'use strict';
// Precarga exclusiva del benchmark: no modifica el código ni la configuración de producción.
const { monitorEventLoopDelay, performance } = require('perf_hooks');
const dc = require('diagnostics_channel');
const histogram = monitorEventLoopDelay({ resolution: 10 });
histogram.enable();
let connections = 0;
dc.channel('undici:client:connected').subscribe(() => { connections++; });
dc.channel('net.client.socket').subscribe(() => { connections++; });
let cpu = process.cpuUsage();
let at = performance.now();
setInterval(() => {
  const now = performance.now();
  const current = process.cpuUsage();
  console.log(JSON.stringify({ type: 'bench-resource', at: Date.now(), cpuPct: ((current.user-cpu.user)+(current.system-cpu.system))/(now-at)/10, rssMb: process.memoryUsage().rss/1048576, eventLoopP95Ms: histogram.percentile(95)/1e6, eventLoopMaxMs: histogram.max/1e6, httpConnections: connections }));
  cpu = current; at = now; histogram.reset();
}, 1000).unref();
