import {createHash,randomUUID} from 'node:crypto';
import {db} from '../db';

export type SharpSnapshot={
 schema:1;rows:unknown[];receivedAt:number;delaySeconds:number;pages:number;truncated:boolean;
};
export const SHARP_BATCH_INTERVAL_MS=65000;
const LEASE_MS=35000;
const CACHE_MS=65000;
const STALE_CACHE_MS=180000;

type Lease={kind:'lease';key:string;token:string};
type Cached={kind:'cached';snapshot:SharpSnapshot;coolingDown:boolean};
type Hold={kind:'hold';retryAfterMs:number};
export type SharpLease=Lease|Cached|Hold;

function snapshot(value:unknown):SharpSnapshot|null{
 if(!value||typeof value!=='object')return null;
 const v=value as Partial<SharpSnapshot>;
 return v.schema===1&&Array.isArray(v.rows)&&v.rows.length<=800&&
  typeof v.receivedAt==='number'&&Number.isFinite(v.receivedAt)&&
  typeof v.delaySeconds==='number'&&Number.isFinite(v.delaySeconds)&&v.delaySeconds>=60&&
  typeof v.pages==='number'&&v.pages>=1&&v.pages<=4&&typeof v.truncated==='boolean'
  ?v as SharpSnapshot:null;
}

/** One budget per API key, shared by Vercel and Workers using the same database.
 * No in-memory fallback: losing the shared store must not multiply upstream calls.
 * The optional additive table is created only after this provider is opted in.
 */
export async function acquireSharpLease(apiKey:string):Promise<SharpLease>{
 const sql=db();
 if(!sql)throw new Error('SharpAPI requires the shared database request budget');
 const key=createHash('sha256').update(apiKey).digest('hex');
 const token=randomUUID();
 return sql.begin(async tx=>{
  // Serialize initial DDL across cold instances; no live network call holds this lock.
  await tx`select pg_advisory_xact_lock(hashtextextended('edgeforce-sharp-feed-schema-v1',0))`;
  await tx`create table if not exists public.edgeforce_sharp_feed_v1(
   credential_hash text primary key,
   next_fetch_at timestamptz not null default 'epoch',
   lease_until timestamptz not null default 'epoch',
   lease_token text,
   cached_at timestamptz,
   payload jsonb
  )`;
  await tx`insert into public.edgeforce_sharp_feed_v1(credential_hash) values(${key}) on conflict do nothing`;
  const rows=await tx`select payload,
   extract(epoch from clock_timestamp())*1000 as now_ms,
   extract(epoch from next_fetch_at)*1000 as next_ms,
   extract(epoch from lease_until)*1000 as lease_ms,
   extract(epoch from cached_at)*1000 as cache_ms
   from public.edgeforce_sharp_feed_v1 where credential_hash=${key} for update`;
  const row=rows[0];
  if(!row)throw new Error('Shared SharpAPI budget row is missing');
  const now=Number(row.now_ms),next=Number(row.next_ms),lease=Number(row.lease_ms);
  if(![now,next,lease].every(Number.isFinite))throw new Error('Invalid shared SharpAPI budget clock');
  const cached=snapshot(row.payload);
  const age=row.cache_ms===null?Infinity:now-Number(row.cache_ms);
  const blocked=Math.max(next,lease)>now;
  if(cached&&age>=0&&(age<CACHE_MS||(blocked&&age<STALE_CACHE_MS))){
   return {kind:'cached',snapshot:cached,coolingDown:age>=CACHE_MS} as Cached;
  }
  if(blocked)return {kind:'hold',retryAfterMs:Math.ceil(Math.max(next,lease)-now)} as Hold;
  await tx`update public.edgeforce_sharp_feed_v1 set
   next_fetch_at=clock_timestamp()+${SHARP_BATCH_INTERVAL_MS}*interval '1 millisecond',
   lease_until=clock_timestamp()+${LEASE_MS}*interval '1 millisecond',lease_token=${token}
   where credential_hash=${key}`;
  return {kind:'lease',key,token} as Lease;
 });
}

/** Fenced completion: an expired/superseded owner cannot overwrite a newer cache. */
export async function finishSharpLease(lease:Lease,value:SharpSnapshot|null,cooldownMs=0){
 const sql=db();
 if(!sql)throw new Error('Shared SharpAPI budget is unavailable');
 if(!Number.isFinite(cooldownMs)||cooldownMs<0)throw new Error('Invalid SharpAPI cooldown');
 const payload=value?sql.json(JSON.parse(JSON.stringify(value))):null;
 const rows=await sql`update public.edgeforce_sharp_feed_v1 set
  payload=case when ${value!==null} then ${payload} else payload end,
  cached_at=case when ${value!==null} then clock_timestamp() else cached_at end,
  next_fetch_at=greatest(next_fetch_at,clock_timestamp()+${cooldownMs}*interval '1 millisecond'),
  lease_until='epoch',lease_token=null
  where credential_hash=${lease.key} and lease_token=${lease.token} and lease_until>clock_timestamp()
  returning credential_hash`;
 if(rows.length!==1)throw new Error('SharpAPI refresh lost its shared-budget lease');
}
