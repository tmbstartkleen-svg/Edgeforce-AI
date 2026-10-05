import {db} from './db';
import {fetchInjuryContext} from './providers/context';
import type {FailoverResult} from './providers/failover';

type AnyRow=Record<string,unknown>;
const obj=(v:unknown):AnyRow=>v&&typeof v==='object'&&!Array.isArray(v)?v as AnyRow:{};
const rows=(payload:unknown)=>{
 if(Array.isArray(payload))return payload;
 const root=obj(payload);
 for(const key of ['data','results','events','rows','items'])if(Array.isArray(root[key]))return root[key] as unknown[];
 return [];
};

export async function refreshLiveInjuryTracking(){
 const result=await fetchInjuryContext(true);
 const sql=db();
 if(result.ok&&result.data!==undefined&&sql){
  const observedAt=new Date();
  const ttl=Math.max(5,Number(process.env.INJURY_SNAPSHOT_TTL_MIN)||30);
  const expiresAt=new Date(observedAt.getTime()+ttl*60000);
  await sql`
   insert into injury_context_snapshots(provider_id,quality_score,payload,row_count,observed_at,expires_at)
   values(
    ${result.providerId||null},${result.quality?.qualityScore??null},${sql.json(result.data as any)},
    ${rows(result.data).length},${observedAt.toISOString()},${expiresAt.toISOString()}
   )
  `;
 }
 return {
  ...result,
  snapshotRows:result.data===undefined?0:rows(result.data).length,
  refreshedAt:new Date().toISOString()
 };
}

export async function fetchTrackedInjuryContext():Promise<FailoverResult<unknown>>{
 const live=await fetchInjuryContext(false);
 if(live.ok)return live;
 const sql=db();
 if(!sql)return live;
 const stored=await sql`
  select provider_id as "providerId",quality_score::float as "qualityScore",payload,observed_at as "observedAt"
  from injury_context_snapshots
  where expires_at>now()
  order by observed_at desc
  limit 1
 `;
 const row=(stored as any[])[0];
 if(!row)return live;
 return {
  ok:true,capability:'INJURIES',providerId:String(row.providerId||'stored-injury-snapshot'),
  providerName:'Edgeforce Injury Snapshot',data:row.payload,
  quality:{ok:true,grade:'CAUTION',qualityScore:Number(row.qualityScore||.65),rowCount:rows(row.payload).length,reasons:['live injury provider unavailable; using fresh persisted snapshot']} as any,
  attempts:live.attempts,error:live.error,degraded:true
 };
}
