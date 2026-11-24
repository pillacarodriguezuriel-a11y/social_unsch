'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path');
const {percentile,median}=require('./lib/measurement');
const {summarize}=require('./operation-summary');
test('nearest rank y medianas pares/impares; ausencia no es cero',()=>{
  assert.equal(percentile(Array.from({length:100},(_,i)=>i+1),95),95);
  assert.equal(percentile([],99),null);assert.equal(median([1,7,4]),4);assert.equal(median([2,4]),3);assert.equal(median([null]),null);
});
test('resumen separa servicio, ruta y ventana; incluye errores y descarta secretos y líneas inválidas',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'radar-summary-')),file=path.join(dir,'input.jsonl');
  const record={timestamp:'2026-11-23T00:01:00Z',service:'social-unsch-api',method:'GET',path:'/api/v1/radar/status',statusCode:200,durationMs:10,authorization:'secret-token'};
  fs.writeFileSync(file,[record,{...record,statusCode:504,durationMs:5000},{...record,timestamp:'2026-11-23T00:06:00Z'},{...record,path:'/private/user-id'},{...record,timestamp:'2026-11-24T00:00:00Z'}].map(JSON.stringify).join('\n'));
  try {const r=await summarize(file,'2026-11-23T00:00:00Z','2026-11-23T01:00:00Z');assert.equal(r.buckets.length,2);assert.equal(r.buckets[0].p95,5000);assert.equal(r.buckets[0].timeouts504,1);assert.equal(r.ignored,2);assert.equal(JSON.stringify(r).includes('secret-token'),false);assert.match(r.availability,/unknown/);}finally{fs.rmSync(dir,{recursive:true});}
});
