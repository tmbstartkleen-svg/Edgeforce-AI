/**
 * ESPN public game-log observations are a source input, not a betting forecast.
 * A fetch timestamp is recorded as a fetch timestamp, never game completion time.
 * Completion and source URL must be explicitly present in the upstream event.
 */
export function normalizeEspnGameLogEvidence({ athleteId, payload, observedAt } = {}) {
 if (typeof athleteId !== 'string' || !athleteId.trim() ||
     typeof observedAt !== 'string' || !Number.isFinite(Date.parse(observedAt)) ||
     !payload || typeof payload !== 'object') throw new TypeError('INVALID_ESPN_EVIDENCE_INPUT');
 const names=Array.isArray(payload.names)?payload.names:[];
 const meta=payload.events && typeof payload.events==='object' && !Array.isArray(payload.events) ?payload.events:{};
 const rows=[];
 const excluded=[];
 const collections=Array.isArray(payload.seasonTypes)
  ? payload.seasonTypes.flatMap(s=>Array.isArray(s?.categories)?s.categories:[])
      .flatMap(c=>Array.isArray(c?.events)?c.events:[])
  : Array.isArray(payload.events)?payload.events:[];
 const seen=new Set();
 for(const row of collections) {
  const eventId=String(row?.eventId??row?.id??'').trim();
  const detail=meta[eventId]??{};
  const date=detail.gameDate??detail.date??row?.date;
  const completed=detail?.status?.type?.completed===true || row?.status?.type?.completed===true;
  const links=[...(Array.isArray(detail.links)?detail.links:[]),...(Array.isArray(row?.links)?row.links:[])];
  const sourceUrl=links.map(l=>l?.href).find(h=>typeof h==='string'&&/^https:\/\/(?:www\.)?espn\.com\//i.test(h))??null;
  const stats={};
  const values=Array.isArray(row?.stats)?row.stats:[];
  names.forEach((name,i)=>{
   const v=values[i];
   const n=typeof v==='number'?v:typeof v==='string'&&v.trim()!==''?Number(v):NaN;
   if(typeof name==='string'&&name.trim()&&Number.isFinite(n)&&n>=0) stats[name]=n;
  });
  let reason=null;
  if(!eventId||seen.has(eventId)) reason='MISSING_OR_DUPLICATE_EVENT';
  else if(!Number.isFinite(Date.parse(date??''))) reason='MISSING_GAME_DATE';
  else if(!completed) reason='COMPLETION_UNVERIFIED';
  else if(!sourceUrl) reason='SOURCE_URL_UNVERIFIED';
  else if(!Object.keys(stats).length) reason='STATS_UNAVAILABLE';
  if(reason){excluded.push({eventId:eventId||null,reason});continue;}
  seen.add(eventId);
  rows.push({playerId:athleteId,eventId,upstreamId:'espn-public-gamelog',
    date:new Date(date).toISOString(),completed:true,stats,observedAt,sourceUrl});
 }
 return {rows,excluded,modelProbability:null,approvedForBetting:false};
}
