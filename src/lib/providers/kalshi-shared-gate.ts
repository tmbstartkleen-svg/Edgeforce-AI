// Shared Kalshi request gate. D1 updates are atomic across Worker isolates.
// If no D1 binding is available, callers retain their local cooldown fallback.
export type KalshiGateDb={
 prepare(sql:string):{bind(...values:unknown[]):{run():Promise<{meta?:{changes?:number}}> ;first<T>():Promise<T|null>}};
};
const key='kalshi-readonly';
const maxDelay=300000;
export function kalshiRetryMs(header:string|null,now=Date.now()){
 if(!header)return 60000;
 const seconds=Number(header);
 const until=Number.isFinite(seconds)?now+seconds*1000:Date.parse(header);
 return Number.isFinite(until)?Math.max(1000,Math.min(maxDelay,until-now)):60000;
}
async function initialize(db:KalshiGateDb){
 await db.prepare('CREATE TABLE IF NOT EXISTS edgeforce_provider_gate (provider TEXT PRIMARY KEY, blocked_until INTEGER NOT NULL DEFAULT 0)').bind().run();
 await db.prepare('INSERT OR IGNORE INTO edgeforce_provider_gate(provider,blocked_until) VALUES (?,0)').bind(key).run();
}
export async function acquireKalshiSlot(db:KalshiGateDb|undefined,now=Date.now()):Promise<{allowed:boolean;retryAfterMs:number;shared:boolean}>{
 if(!db)return {allowed:true,retryAfterMs:0,shared:false};
 try{
  await initialize(db);
  // One cross-isolate probe every 10s when healthy. An upstream 429 extends this lease.
  const updated=await db.prepare('UPDATE edgeforce_provider_gate SET blocked_until=? WHERE provider=? AND blocked_until<=?').bind(now+10000,key,now).run();
  if(Number(updated.meta?.changes||0)>0)return {allowed:true,retryAfterMs:0,shared:true};
  const row=await db.prepare('SELECT blocked_until FROM edgeforce_provider_gate WHERE provider=?').bind(key).first<{blocked_until:number}>();
  return {allowed:false,retryAfterMs:Math.max(1000,Number(row?.blocked_until||now+1000)-now),shared:true};
 }catch{
  return {allowed:true,retryAfterMs:0,shared:false};
 }
}
export async function blockKalshiUntil(db:KalshiGateDb|undefined,delayMs:number,now=Date.now()){
 if(!db)return;
 try{
  await initialize(db);
  await db.prepare('UPDATE edgeforce_provider_gate SET blocked_until=MAX(blocked_until,?) WHERE provider=?').bind(now+Math.max(1000,Math.min(maxDelay,delayMs)),key).run();
 }catch{ /* local cooldown remains in place */ }
}
