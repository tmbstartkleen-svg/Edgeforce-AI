/** Offline validation of source-attributed D1 observation history.
 * Excludes payloads, does not mutate storage, and never certifies betting odds.
 */
export function auditObservationHistory(rows=[],{now=Date.now(),maxAgeMs=86400000}={}){
 if(!Array.isArray(rows)||rows.length>1000||!Number.isFinite(now))throw Error('INVALID_HISTORY_AUDIT');
 const sources=new Map(),keys=new Set();
 let accepted=0,duplicates=0,invalid=0,stale=0;
 for(const row of rows){
  const source=row?.source_id,upstream=row?.upstream_id,event=row?.event_id;
  const kind=row?.observation_kind,hash=row?.payload_hash;
  const time=Date.parse(row?.observed_at??'');
  if(![source,upstream,event,kind,hash].every(x=>typeof x==='string'&&x.length>0)||
   !Number.isFinite(time)||time>now+30000){invalid++;continue;}
  const key=JSON.stringify([source,upstream,event,row.market_id??null,kind,row.observed_at,hash]);
  if(keys.has(key)){duplicates++;continue;}keys.add(key);
  if(now-time>maxAgeMs){stale++;continue;}
  accepted++;
  const item=sources.get(source)||{sourceId:source,upstreamId:upstream,records:0,oldestObservedAt:row.observed_at,newestObservedAt:row.observed_at};
  if(item.upstreamId!==upstream){invalid++;accepted--;continue;}
  item.records++;if(row.observed_at<item.oldestObservedAt)item.oldestObservedAt=row.observed_at;
  if(row.observed_at>item.newestObservedAt)item.newestObservedAt=row.observed_at;
  sources.set(source,item);
 }
 return {audited:rows.length,accepted,duplicates,invalid,stale,sources:[...sources.values()],
  sourceIdentityAuthenticated:false,oddsOfficiallyVerified:false,betRecommendationAuthorized:false,readOnly:true};
}
