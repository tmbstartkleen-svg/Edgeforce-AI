const fresh=(value,now,age)=>Number.isFinite(Date.parse(value))&&Date.parse(value)<=now&&now-Date.parse(value)<=age;
const key=x=>JSON.stringify([x.source_id,x.upstream_id,x.event_id,x.payload_hash,x.observed_at]);
/** Stored trial counts, never implied odds or a generic model_probability. */
export function monteCarloForQuote(quote,runs,evidence,now=Date.now()){
 const available=new Set(evidence.filter(x=>fresh(x.observed_at,now,86400000)).map(key));
 for(const run of runs){
  if(run.event_id!==quote.source_event_id||run.market_key!==quote.market_key||run.selection_key!==quote.selection_key||!fresh(run.created_at,now,1200000))continue;
  let snapshot;try{snapshot=JSON.parse(run.feature_snapshot)}catch{continue}
  const mc=snapshot?.monteCarlo,inputs=snapshot?.inputEvidence;
  if(snapshot?.quotePayloadSha256!==quote.payload_sha256||!/^[a-f0-9]{64}$/.test(quote.payload_sha256||'')||!run.model_version)continue;
  if(!mc||!Number.isSafeInteger(mc.runs)||mc.runs<100||mc.runs>10000000||mc.runs!==run.run_count||!Number.isSafeInteger(mc.hits)||mc.hits<0||mc.hits>mc.runs)continue;
  if(!Array.isArray(inputs)||!inputs.length||inputs.length>100||!inputs.every(x=>available.has(key(x))&&Date.parse(x.observed_at)<=Date.parse(run.created_at)))continue;
  const p=mc.hits/mc.runs,z=1.96,n=mc.runs,den=1+z*z/n;
  const center=(p+z*z/(2*n))/den,half=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/den;
  return {percent:p*100,low:Math.max(0,center-half)*100,high:Math.min(1,center+half)*100,runs:n,modelVersion:run.model_version,createdAt:run.created_at,status:'STORED_MONTE_CARLO',calibrated:false};
 }
 return null;
}
export function buildSportsCoverage(registry,sourceRows,now=Date.now()){
 const aliases={'ncaab':'ncaam-basketball'};
 const rows=registry.map(s=>({id:s.id,label:s.label,family:s.family,observations:0,latest:null,status:'NO_STORED_SCORES',sources:[]}));
 for(const source of sourceRows){
  let id=String(source.source_id).replace(/^espn-scoreboard-/,'').replace(/^soccer-/,'');id=aliases[id]||id;
  let row=rows.find(x=>x.id===id);
  if(!row){row={id:source.source_id,label:source.source_id,family:'Unmapped source',observations:0,latest:null,status:'NO_STORED_SCORES',sources:[]};rows.push(row)}
  row.observations+=Number(source.total)||0;row.sources.push(source.source_id);
  if(Number.isFinite(Date.parse(source.latest))&&(!row.latest||Date.parse(source.latest)>Date.parse(row.latest)))row.latest=source.latest;
  row.status=row.observations?(fresh(row.latest,now,86400000)?'RECENT_STORED_SCORES':'STALE_STORED_SCORES'):'NO_STORED_SCORES';
 }
 return rows;
}
