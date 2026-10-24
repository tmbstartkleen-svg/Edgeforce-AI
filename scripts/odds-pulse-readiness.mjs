// Read-only live sportsbook visibility probe. Never sends authentication tokens.
import {pathToFileURL} from 'node:url';

export function evaluatePulse(body, httpStatus, now=Date.now()) {
 const rows=Array.isArray(body?.rows)?body.rows:[];
 const valid=rows.filter(r=>typeof r?.sport==='string'&&typeof r?.fixture==='string'&&
  Array.isArray(r?.prices)&&r.prices.some(p=>Number.isFinite(p?.american)&&p.american!==0));
 const generatedMs=Date.parse(body?.generatedAt||'');
 const ageMs=Number.isFinite(generatedMs)?now-generatedMs:null;
 const fresh=body?.fresh===true&&ageMs!==null&&ageMs>=-30000&&ageMs<=120000;
 const reasons=[];
 if(httpStatus!==200||body?.ok!==true)reasons.push('SOURCE_UNAVAILABLE');
 if(!fresh)reasons.push('SNAPSHOT_STALE_OR_UNTIMESTAMPED');
 if(!valid.length)reasons.push('NO_USABLE_AMERICAN_ODDS');
 return {
  verdict:reasons.length?'NOT_READY':'LIVE_SNAPSHOT_OBSERVED',
  reasons, source:body?.source||null,mode:body?.mode||null,
  snapshotAgeMs:ageMs,receivedRows:rows.length,pricedRows:valid.length,
  sports:[...new Set(valid.map(r=>r.sport))].sort(),
  // This endpoint is FanDuel-labelled. It never demonstrates DraftKings or an independent odds source.
  draftKingsVerified:false,independentUpstreamsVerified:0,crossBookEdgesCertified:false,
  caveat:'FanDuel-labelled public snapshot only. Not an authenticated DraftKings catalog, independent model, or cross-book verification.'
 };
}

export async function probe(url,fetcher=fetch,now=Date.now()) {
 const endpoint=new URL('/api/odds-pulse',url);
 if(!['http:','https:'].includes(endpoint.protocol))throw new Error('Only HTTP(S) origins supported');
 if(endpoint.username||endpoint.password)throw new Error('Credentials in URLs are prohibited');
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),8000);
 try {
  const response=await fetcher(endpoint,{signal:controller.signal,headers:{Accept:'application/json'},redirect:'error',cache:'no-store'});
  const body=await response.json();
  return evaluatePulse(body,response.status,now);
 } finally {clearTimeout(timer)}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
 const url=process.argv[2];
 if(!url){console.error('Usage: node scripts/odds-pulse-readiness.mjs https://your-deployed-origin');process.exitCode=2}
 else probe(url).then(result=>{
  console.log(JSON.stringify(result,null,2));
  if(result.verdict!=='LIVE_SNAPSHOT_OBSERVED')process.exitCode=1;
 }).catch(error=>{console.error(JSON.stringify({verdict:'PROBE_FAILED',reason:error.message}));process.exitCode=1});
}
