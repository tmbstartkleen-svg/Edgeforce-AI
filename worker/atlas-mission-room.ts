// Build 408: private durable journal for the Founder-led ATLAS mission room.
// The native Cloudflare Durable Object maintains one serialized room state.
// It is intentionally NOT public-routed: only the authenticated Worker gateway
// forwards requests to this class.
export type AtlasJournalItem={
 id:string;createdAt:string;request:string;response:Record<string,unknown>;
};
type RoomStore={
 get<T>(key:string):Promise<T|undefined>;
 put<T>(key:string,value:T):Promise<void>;
 transaction<T>(operation:(txn:RoomStore)=>Promise<T>):Promise<T>;
};
type RoomState={storage:RoomStore};
type Reservation={lastMinute:number[];lastHour:number[]};
const NO_STORE={'Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff'};
const json=(payload:unknown,status=200)=>Response.json(payload,{status,headers:NO_STORE});
const MAX_MISSIONS=30;
const MAX_BODY=100_000;
const MAX_MINUTE=2;
const MAX_HOUR=12;

export class AtlasMissionRoom {
 constructor(private readonly state:RoomState){}
 async fetch(request:Request):Promise<Response>{
  const url=new URL(request.url);
  if(url.hostname!=='atlas.internal')return json({ok:false,error:'INTERNAL_ONLY'},403);
  if(request.method==='GET'&&url.pathname==='/history'){
   const missions=await this.state.storage.get<AtlasJournalItem[]>('missions')||[];
   const max=Math.min(30,Math.max(1,Number(url.searchParams.get('limit')||15)||15));
   return json({ok:true,durable:true,owner:'Founder',director:'ATLAS',missions:missions.slice(-max)});
  }
  if(request.method==='POST'&&url.pathname==='/reserve'){
   const now=Date.now();
   const result=await this.state.storage.transaction(async txn=>{
    const prior=await txn.get<Reservation>('reservations')||{lastMinute:[],lastHour:[]};
    const lastMinute=prior.lastMinute.filter(t=>t>now-60_000);
    const lastHour=prior.lastHour.filter(t=>t>now-3_600_000);
    if(lastMinute.length>=MAX_MINUTE||lastHour.length>=MAX_HOUR){
     return {allowed:false,retryAfterSec:lastMinute.length>=MAX_MINUTE?60:3600};
    }
    lastMinute.push(now);lastHour.push(now);
    await txn.put('reservations',{lastMinute,lastHour});
    return {allowed:true,retryAfterSec:0};
   });
   return json({ok:result.allowed,...result},result.allowed?200:429);
  }
  if(request.method==='POST'&&url.pathname==='/missions'){
   const size=Number(request.headers.get('content-length')||0);
   if(size>MAX_BODY)return json({ok:false,error:'MISSION_TOO_LARGE'},413);
   let entry:AtlasJournalItem;
   try{
    const raw=await request.text();
    if(new TextEncoder().encode(raw).length>MAX_BODY)return json({ok:false,error:'MISSION_TOO_LARGE'},413);
    const value=JSON.parse(raw) as Partial<AtlasJournalItem>;
    if(!value||typeof value!=='object'||!value.id||typeof value.id!=='string'
      ||value.id.length>90||typeof value.request!=='string'||value.request.length>500
      ||typeof value.createdAt!=='string'||!Number.isFinite(Date.parse(value.createdAt))
      ||!value.response||typeof value.response!=='object'||Array.isArray(value.response)
      ||value.response.ok!==true)return json({ok:false,error:'INVALID_MISSION'},400);
    entry={id:value.id,request:value.request,createdAt:value.createdAt,response:value.response};
   }catch{return json({ok:false,error:'INVALID_JSON'},400);}
   const total=await this.state.storage.transaction(async txn=>{
    const previous=await txn.get<AtlasJournalItem[]>('missions')||[];
    if(previous.some(x=>x.id===entry.id))return previous.length;
    const next=[...previous,entry].slice(-MAX_MISSIONS);
    await txn.put('missions',next);
    return next.length;
   });
   return json({ok:true,persisted:true,id:entry.id,recordCount:total});
  }
  return json({ok:false,error:'NOT_FOUND'},404);
 }
}
