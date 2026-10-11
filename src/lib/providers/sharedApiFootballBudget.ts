import {createHash,randomUUID} from 'node:crypto';
import {db} from '../db';
import type {ApiFootballFixture,ApiFootballTarget} from './apiFootballResearch';

/** Daily, cross-isolate and cross-deployment quota governor. Shared DB is mandatory.
 * Reserve BEFORE HTTP, including failed calls. Keep ample headroom below 100 free/day.
 */
export const API_FOOTBALL_MAX_DAILY=48;
export const API_FOOTBALL_INTERVAL_MS=30*60*1000;
export type ApiFootballSnapshot={
 schema:1;target:ApiFootballTarget;date:string;games:ApiFootballFixture[];
 fetchedAt:string;truncated:boolean;sourceResponseCount:number;remainingReported:number|null
};
export type ApiFootballLease=
 |{kind:'fetch';credentialHash:string;token:string;target:ApiFootballTarget;remaining:number}
 |{kind:'cached';snapshot:ApiFootballSnapshot;remaining:number}
 |{kind:'hold';reason:'DAILY_LIMIT'|'COOLDOWN';retryAfterMs:number;remaining:number};

function isSnapshot(v:unknown):v is ApiFootballSnapshot{
 if(!v||typeof v!=='object')return false;
 const s=v as Partial<ApiFootballSnapshot>;
 return s.schema===1&&Boolean(s.target)&&Array.isArray(s.games)&&s.games.length<=200&&
  typeof s.fetchedAt==='string'&&Number.isFinite(Date.parse(s.fetchedAt))&&
  typeof s.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s.date);
}

export async function acquireApiFootballLease(key:string,targets:ApiFootballTarget[]):Promise<ApiFootballLease>{
 const sql=db();
 if(!sql)throw new Error('API-Football requires shared PostgreSQL daily budget');
 if(!targets.length)throw new Error('API-Football research leagues are not configured');
 const credentialHash=createHash('sha256').update('api-football-v3:'+key).digest('hex');
 const token=randomUUID();
 return sql.begin(async tx=>{
  await tx`select pg_advisory_xact_lock(hashtextextended('edgeforce-api-football-schema-v1',0))`;
  await tx`create table if not exists public.edgeforce_api_football_budget_v1(
   credential_hash text primary key,
   day_key text not null default '',
   used_today integer not null default 0,
   next_fetch_at timestamptz not null default 'epoch',
   lease_until timestamptz not null default 'epoch',
   lease_token text,
   cached_at timestamptz,
   payload jsonb
  )`;
  await tx`insert into public.edgeforce_api_football_budget_v1(credential_hash)
   values(${credentialHash}) on conflict do nothing`;
  const rows=await tx`select day_key,used_today,
   to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD') as day_now,
   extract(epoch from clock_timestamp())*1000 as now_ms,
   extract(epoch from next_fetch_at)*1000 as next_ms,
   extract(epoch from lease_until)*1000 as lease_ms,
   extract(epoch from cached_at)*1000 as cache_ms,
   payload from public.edgeforce_api_football_budget_v1
   where credential_hash=${credentialHash} for update`;
  const row=rows[0];
  if(!row)throw new Error('API-Football daily budget row not found');
  const now=Number(row.now_ms),next=Number(row.next_ms),leaseUntil=Number(row.lease_ms);
  if(![now,next,leaseUntil].every(Number.isFinite))throw new Error('API-Football quota clock invalid');
  const day=String(row.day_now);
  const used=day===String(row.day_key)?Math.max(0,Number(row.used_today)):0;
  const remaining=Math.max(0,API_FOOTBALL_MAX_DAILY-used);
  const snap=isSnapshot(row.payload)?row.payload:null;
  const cachedAt=row.cache_ms===null?NaN:Number(row.cache_ms);
  if(snap&&Number.isFinite(cachedAt)&&now>=cachedAt&&now-cachedAt<API_FOOTBALL_INTERVAL_MS)
   return {kind:'cached',snapshot:snap,remaining} as ApiFootballLease;
  if(!remaining)return {kind:'hold',reason:'DAILY_LIMIT',remaining:0,retryAfterMs:API_FOOTBALL_INTERVAL_MS} as ApiFootballLease;
  if(next>now||leaseUntil>now)return {kind:'hold',reason:'COOLDOWN',remaining,retryAfterMs:Math.ceil(Math.max(next,leaseUntil)-now)} as ApiFootballLease;
  const target=targets[used%targets.length];
  await tx`update public.edgeforce_api_football_budget_v1
   set day_key=${day},used_today=${used+1},
   next_fetch_at=clock_timestamp()+${API_FOOTBALL_INTERVAL_MS}*interval '1 millisecond',
   lease_until=clock_timestamp()+interval '20 seconds',lease_token=${token}
   where credential_hash=${credentialHash}`;
  return {kind:'fetch',credentialHash,token,target,remaining:remaining-1} as ApiFootballLease;
 });
}
export async function finishApiFootballLease(lease:Extract<ApiFootballLease,{kind:'fetch'}>,value:ApiFootballSnapshot|null){
 const sql=db();
 if(!sql)throw new Error('API-Football shared budget unavailable');
 const payload=value?sql.json(JSON.parse(JSON.stringify(value))):null;
 const result=await sql`update public.edgeforce_api_football_budget_v1 set
  payload=case when ${value!==null} then ${payload} else payload end,
  cached_at=case when ${value!==null} then clock_timestamp() else cached_at end,
  lease_until='epoch',lease_token=null
  where credential_hash=${lease.credentialHash} and lease_token=${lease.token}
   and lease_until>clock_timestamp() returning credential_hash`;
 if(result.length!==1)throw new Error('API-Football daily quota lease expired');
}
