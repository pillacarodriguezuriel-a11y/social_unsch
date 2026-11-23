'use strict';
function percentile(sorted, p) {
  return sorted.length ? sorted[Math.max(0, Math.min(sorted.length - 1, Math.ceil(p / 100 * sorted.length) - 1))] : null;
}
function median(values) {
  const s=values.filter(Number.isFinite).sort((a,b)=>a-b), n=s.length;
  return n ? (s[Math.floor((n-1)/2)]+s[Math.floor(n/2)])/2 : null;
}
module.exports={percentile,median};
