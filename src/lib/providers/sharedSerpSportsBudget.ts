import {createHash,randomUUID} from 'node:crypto';
import {db} from '../db';
import type {SerpSportsGame,SerpSportsTarget} from './serpGoogleSports';

/** Global quota shared across Cloudflare isolates and Vercel.
 * Charge attempts before network requests; fail closed without shared DB.
 */
export const SERP_GOOGLE_RESEARCH_INTERVAL_MS=8*60*60*1000;
export const SERP_GOOGLE_MAX_MONTHLY=90;
export const SERP_GOOGLE_CACHE_MS=48*60*60*1000;
export type ResearchSnapshot={schema:1;target:SerpSportsTarget;games:SerpSportsGame[];observedAt:string;fetchedAt:string};
export type SerpSportsLease=
 |{kind:'fetch';hash:string;token:string;target:SerpSportsTarget;remaining:number}
 |{kind:'cached';value:ResearchSnapshot;remaining:number}
 |{kind:'hold';reason:'COOLDOWN'|'MONTHLY_BUDGET';remaining:number;retryAfterMs:number};

function snapshot(raw:unknown):ResearchSnapshot|null{
 if(!raw||typeof raw!=='object')return null;
 const v=raw as Partial<ResearchSnapshot>;
 return v.schema===1&&v.target&&Array.isArray(v.games)&&v.games.length<=300&&
  typeof v.observedAt==='string'&&Number.isFinite(Date.parse(v.observedAt))&&
  typeof v.fetchedAt==='string'&&Number.isFinite(Date.parse(v.fetchedAt))
  ?v as ResearchSnapshot:null;
}
export async function acquireSerpSportsLease(apiKey:string,targets:SerpSportsTarget[]):Promise<SerpSportsLease>{
 const sql=db();
 if(!sql)throw new Error('SerpApi research requires shared PostgreSQL quota storage');
 if(!targets.length)throw new Error('SerpApi league targets are not configured');
 const hash=createHash('sha256').update('google-sports-v1:'+apiKey).digest('hex'),token=randomUUID();
 return sql.begin(async tx=>{
  await tx`select pg_advisory_xact_lock(hashtextextended('edgeforce-serp-google-schema-v1',0))`;
  await tx`create table if not exists public.edgeforce_serp_google_v1(
    credential_hash text primary key,month_key text not null default '',
    used_in_month integer not null default 0,
    next_fetch_at timestamptz not null default 'epoch',
    lease_until timestamptz not null default 'epoch',lease_token text,
    cached_at timestamptz,payload jsonb
  )`;
  await tx`insert into public.edgeforce_serp_google_v1(credential_hash) values(${hash}) on conflict do nothing`;
  const items=await tx`select month_key,used_in_month,
   to_char(clock_timestamp() at time zone 'UTC','YYYY-MM') as month_now,
   extract(epoch from clock_timestamp())*1000 as now_ms,
   extract(epoch from next_fetch_at)*1000 as next_ms,
   extract(epoch from lease_until)*1000 as lease_ms,
   extract(epoch from cached_at)*1000 as cache_ms,payload
   from public.edgeforce_serp_google_v1 where credential_hash=${hash} for update`;
  const row=items[0];
  if(!row)throw new Error('SerpApi shared budget missing');
  const now=Number(row.now_ms),next=Number(row.next_ms),lease=Number(row.lease_ms);
  if(![now,next,lease].every(Number.isFinite))throw new Error('SerpApi shared clock invalid');
  const month=String(row.month_now),used=String(row.month_key)===month?Math.max(0,Number(row.used_in_month)):0;
  const remaining=Math.max(0,SERP_GOOGLE_MAX_MONTHLY-used);
  const cached=snapshot(row.payload),cachedAt=row.cache_ms===null?NaN:Number(row.cache_ms);
  if(cached&&Number.isFinite(cachedAt)&&now>=cachedAt&&now-cachedAt<SERP_GOOGLE_CACHE_MS)
   return {kind:'cached',value:cached,remaining} as SerpSportsLease;
  if(!remaining)return {kind:'hold',reason:'MONTHLY_BUDGET',remaining:0,retryAfterMs:SERP_GOOGLE_RESEARCH_INTERVAL_MS} as SerpSportsLease;
  if(next>now||lease>now)return {kind:'hold',reason:'COOLDOWN',remaining,retryAfterMs:Math.ceil(Math.max(next,lease)-now)} as SerpSportsLease;
  const target=targets[used%targets.length];
  // Count each attempted search, even on HTTP errors, for conservative budget protection.
  await tx`update public.edgeforce_serp_google_v1 set month_key=${month},
   used_in_month=${used+1},
   next_fetch_at=clock_timestamp()+${SERP_GOOGLE_RESEARCH_INTERVAL_MS}*interval '1 millisecond',
   lease_until=clock_timestamp()+interval '20 seconds',lease_token=${token}
   where credential_hash=${hash}`;
  return {kind:'fetch',hash,token,target,remaining:remaining-1} as SerpSportsLease;
 });
}
export async function finishSerpSportsLease(lease:Extract<SerpSportsLease,{kind:'fetch'}>,value:ResearchSnapshot|null){
 const sql=db();if(!sql)throw new Error('SerpApi shared budget unavailable');
 const payload=value?sql.json(JSON.parse(JSON.stringify(value))):null;
 const result=await sql`update public.edgeforce_serp_google_v1 set
  payload=case when ${value!==null} then ${payload} else payload end,
  cached_at=case when ${value!==null} then clock_timestamp() else cached_at end,
  lease_until='epoch',lease_token=null
  where credential_hash=${lease.hash} and lease_token=${lease.token}
    and lease_until>clock_timestamp() returning credential_hash`;
 if(result.length!==1)throw new Error('SerpApi shared quota lease expired');
}
