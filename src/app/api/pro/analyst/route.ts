import {createHash,timingSafeEqual} from 'node:crypto';
import {db} from '@/lib/db';
import {priceResearch} from '@/lib/proQuant';

export const dynamic='force-dynamic';
const noStore={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const respond=(body:Record<string,unknown>,status=200)=>Response.json(body,{status,headers:noStore});
const validOdds=(v:unknown)=>typeof v==='number'&&Number.isInteger(v)&&Math.abs(v)>=100&&Math.abs(v)<=100000;
function sameToken(a:string,b:string){
 if(a.length<32||b.length<32||a.length!==b.length)return false;
 return timingSafeEqual(Buffer.from(a),Buffer.from(b));
}
/** Cross-instance spend gate. Charge attempted model calls before invoking the vendor. */
async function reserveAnalystCall(){
 const sql=db();
 if(!sql)throw new Error('ANALYST_SHARED_BUDGET_UNAVAILABLE');
 return sql.begin(async tx=>{
  await tx`select pg_advisory_xact_lock(hashtextextended('edgeforce-ai-analyst-v203',0))`;
  await tx`create table if not exists public.edgeforce_ai_analyst_budget_v203(
   budget_id text primary key,day_key text not null default '',used integer not null default 0,
   next_allowed_at timestamptz not null default 'epoch'
  )`;
  await tx`insert into public.edgeforce_ai_analyst_budget_v203(budget_id)
   values('analyst') on conflict do nothing`;
  const rows=await tx`select day_key,used,extract(epoch from clock_timestamp())*1000 as now_ms,
   to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD') as day_now,
   extract(epoch from next_allowed_at)*1000 as next_ms
   from public.edgeforce_ai_analyst_budget_v203 where budget_id='analyst' for update`;
  const row=rows[0];
  if(!row)throw new Error('ANALYST_SHARED_BUDGET_UNAVAILABLE');
  const used=String(row.day_key)===String(row.day_now)?Number(row.used):0;
  const now=Number(row.now_ms),next=Number(row.next_ms);
  if(!Number.isFinite(used)||!Number.isFinite(now)||!Number.isFinite(next))
   throw new Error('ANALYST_SHARED_BUDGET_UNAVAILABLE');
  if(used>=12)return {allowed:false,reason:'DAILY_BUDGET',remaining:0};
  if(next>now)return {allowed:false,reason:'COOLDOWN',remaining:12-used};
  await tx`update public.edgeforce_ai_analyst_budget_v203
    set day_key=${String(row.day_now)},used=${used+1},
    next_allowed_at=clock_timestamp()+interval '90 seconds' where budget_id='analyst'`;
  return {allowed:true,reason:'OK',remaining:11-used};
 });
}

export async function POST(request:Request){
 const secret=process.env.EDGEFORCE_ANALYST_ACCESS_TOKEN||'';
 const given=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_\-]{32,160})$/)?.[1]||'';
 if(!sameToken(given,secret))return respond({ok:false,status:'UNAUTHORIZED',message:'Operator access token required.'},401);
 const key=process.env.AI_GATEWAY_API_KEY?.trim();
 const model=process.env.AI_GATEWAY_MODEL?.trim();
 if(!key||!model||!/^([a-z0-9-]+\/[a-zA-Z0-9._-]+|vmc\/[a-zA-Z0-9._-]+)$/.test(model))
  return respond({ok:false,status:'NOT_CONFIGURED',message:'AI Gateway key or verified model ID not configured.'},503);
 const len=Number(request.headers.get('content-length')||0);
 if(len>2048)return respond({ok:false,status:'INVALID_REQUEST'},413);
 let body:unknown;
 try{const text=await request.text();if(text.length>2048)throw new Error('Too large');body=JSON.parse(text)}
 catch{return respond({ok:false,status:'INVALID_REQUEST'},400)}
 if(!body||typeof body!=='object'||Array.isArray(body))return respond({ok:false,status:'INVALID_REQUEST'},400);
 const v=body as Record<string,unknown>;
 if(!validOdds(v.referenceA)||!validOdds(v.referenceB)||!validOdds(v.offered)||
  typeof v.books!=='number'||!Number.isInteger(v.books)||v.books<0||v.books>50||
  typeof v.quoteAgeMin!=='number'||!Number.isFinite(v.quoteAgeMin)||v.quoteAgeMin<0||v.quoteAgeMin>10000||
  !(v.estimate===null||v.estimate===undefined||
   typeof v.estimate==='number'&&Number.isFinite(v.estimate)&&v.estimate>0&&v.estimate<1))
  return respond({ok:false,status:'INVALID_REQUEST',message:'Enter valid, matched market price inputs.'},400);
 const evidence=priceResearch({referenceA:v.referenceA as number,
  referenceB:v.referenceB as number,offered:v.offered as number,
  estimate:v.estimate as number|null|undefined,books:v.books as number,quoteAgeMin:v.quoteAgeMin as number});
 let budget:{allowed:boolean;reason:string;remaining:number};
 try{budget=await reserveAnalystCall()}
 catch{return respond({ok:false,status:'SHARED_BUDGET_UNAVAILABLE',message:'Model not called because the shared cost governor is unavailable.'},503)}
 if(!budget.allowed)return respond({ok:false,status:budget.reason,message:'AI call quota or cooldown reached; try again after reset.',remainingToday:budget.remaining},429);
 try{
  const res=await fetch('https://ai-gateway.vercel.sh/v1/chat/completions',{
   method:'POST',signal:AbortSignal.timeout(14000),cache:'no-store',
   headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
   body:JSON.stringify({
    model,stream:false,max_tokens:550,temperature:0.2,
    messages:[
     {role:'system',content:'You are the EdgeForce quantitative research analyst. Use ONLY the provided deterministic price math. Treat all inputs as manual and unverified. Do not invent games, injuries, actual bookmaker prices, live sources, historical results, access permissions or expected returns. Explain potential price advantage, what the reference assumes, failure points, risks of correlation and why entry cannot be verified without timely sourced odds. Never guarantee profit or instruct placing a bet. Answer in under 230 words.'},
     {role:'user',content:JSON.stringify({input:{referenceA:v.referenceA,referenceB:v.referenceB,offered:v.offered,
      books:v.books,quoteAgeMin:v.quoteAgeMin,estimate:v.estimate??null},
      deterministicPriceResearch:evidence,source:'MANUALLY_ENTERED_UNVERIFIED'})}
    ]
   })
  });
  if(!res.ok){await res.body?.cancel();return respond({ok:false,status:'GATEWAY_UNAVAILABLE',message:'Gateway request failed; no repeated calls are scheduled.',remainingToday:budget.remaining},503)}
  const bodyText=await res.text();
  if(bodyText.length>30000)return respond({ok:false,status:'INVALID_GATEWAY_RESPONSE'},502);
  const data=JSON.parse(bodyText) as {choices?:Array<{message?:{content?:unknown}}>}
  const reply=data.choices?.[0]?.message?.content;
  if(typeof reply!=='string'||!reply.trim())return respond({ok:false,status:'EMPTY_GATEWAY_RESPONSE'},502);
  return respond({ok:true,analysis:reply.slice(0,3400),remainingToday:budget.remaining,
   evidenceStatus:'MANUALLY_ENTERED_UNVERIFIED',source:'Vercel AI Gateway'});
 }catch{
  return respond({ok:false,status:'GATEWAY_TIMEOUT',message:'Model explanation timed out; no automatic retry.',remainingToday:budget.remaining},503);
 }
}
