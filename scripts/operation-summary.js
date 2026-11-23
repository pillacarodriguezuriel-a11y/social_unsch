'use strict';
// Agregación offline: nunca contacta servicios ni reproduce líneas/cuerpos de los registros.
const fs=require('fs');
const readline=require('readline');
const {percentile}=require('./lib/measurement');
const routes=new Set(['/health/live','/health/ready','/api/v1/radar/status','/api/v1/radar/report','/api/v1/catalogs','/api/v1/auth/login','/api/v1/auth/profile-me','/api/v1/feed','/api/v1/feed/']);
async function summarize(file,since,until) {
  const start=Date.parse(since), end=Date.parse(until);
  if (!Number.isFinite(start)||!Number.isFinite(end)||end<=start) throw new Error('Ventana inválida');
  const buckets=new Map(); let ignored=0;
  for await (const line of readline.createInterface({input:fs.createReadStream(file),crlfDelay:Infinity})) {
    let x; try{x=JSON.parse(line);}catch{ignored++;continue;}
    const at=Date.parse(x.timestamp);
    if (!(at>=start&&at<end) || !['social-unsch-api','social-unsch-radar'].includes(x.service) || !routes.has(x.path) || !Number.isFinite(x.durationMs) || x.durationMs<0 || !Number.isInteger(x.statusCode) || x.statusCode<100 || x.statusCode>599) {ignored++;continue;}
    const key=[x.service,x.path,new Date(Math.floor(at/300000)*300000).toISOString()].join('|');
    const b=buckets.get(key)||{service:x.service,route:x.path,windowStart:new Date(Math.floor(at/300000)*300000).toISOString(),latencies:[],errors5xx:0,timeouts504:0,success2xx:0};
    b.latencies.push(x.durationMs); b.errors5xx+=Number(x.statusCode>=500); b.timeouts504+=Number(x.statusCode===504);b.success2xx+=Number(x.statusCode>=200&&x.statusCode<300);buckets.set(key,b);
  }
  return {since,until,ignored,availability:'unknown: request logs do not prove continuous availability; absent windows are missing data',buckets:[...buckets.values()].map(b=>{const {latencies,...rest}=b;latencies.sort((a,b)=>a-b);return {...rest,requests:latencies.length,p50:percentile(latencies,50),p95:percentile(latencies,95),p99:percentile(latencies,99)};})};
}
if(require.main===module) summarize(process.env.LOG_INPUT,process.env.OBS_SINCE,process.env.OBS_UNTIL).then(r=>console.log(JSON.stringify(r,null,2))).catch(()=>{console.error('No se pudo resumir: revise LOG_INPUT y ventana UTC OBS_SINCE/OBS_UNTIL.');process.exitCode=1;});
module.exports={summarize};
