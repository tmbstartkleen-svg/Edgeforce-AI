import {db} from './db';

export type CommandEffectivenessRow={
 commandType:string;
 samples:number;
 gradedSamples:number;
 positiveSamples:number;
 positiveRate:number;
 averageUtility:number;
 confidence:number;
 multiplier:number;
 evidence:'INSUFFICIENT'|'PROVISIONAL'|'QUALIFIED'|'VERIFIED';
 state:'BOOST'|'NEUTRAL'|'REDUCE'|'UNSCORED';
};

type CommandObs={
 observed_at:string;command_id:string;command_type:string;dedupe_key:string;domain:string;category:string;score:number;
};
type EdgeSnap={opportunity_id:string;generated_at:string;master_score:number;edge:number};
type LifeEvent={opportunity_id:string;observed_at:string;lifecycle_state:string};

const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));
const mean=(xs:number[])=>xs.length?xs.reduce((s,x)=>s+x,0)/xs.length:0;
function evidence(n:number){if(n>=250)return 'VERIFIED' as const;if(n>=75)return 'QUALIFIED' as const;if(n>=25)return 'PROVISIONAL' as const;return 'INSUFFICIENT' as const;}

function opportunityId(command:CommandObs){
 const prefix=command.command_type==='PRIME_RECHECK'?'prime:':command.command_type==='READY_RECHECK'?'ready:':command.command_type==='EDGE_WEAKENING'?'weak:':command.command_type==='EDGE_EXIT'?'exit:':'';
 return prefix&&command.command_id.startsWith(prefix)?command.command_id.slice(prefix.length):null;
}

function bucketKey(x:CommandObs){
 const t=new Date(x.observed_at);
 const hour=new Date(t.getFullYear(),t.getMonth(),t.getDate(),t.getHours()).toISOString();
 return x.command_type+'|'+x.dedupe_key+'|'+hour;
}

export async function buildCommandEffectiveness(){
 const sql=db();
 if(!sql)return {configured:false,rows:[] as CommandEffectivenessRow[],multipliers:new Map<string,number>(),ungradedCashout:0};
 const commands=await sql`
  select observed_at,command_id,command_type,dedupe_key,domain,category,score::float8
  from opportunity_command_queue
  where observed_at >= now() - interval '30 days'
  order by observed_at asc
  limit 20000
 `;
 const all=(commands as any[]).map(x=>({
  observed_at:String(x.observed_at),command_id:String(x.command_id),command_type:String(x.command_type),
  dedupe_key:String(x.dedupe_key),domain:String(x.domain),category:String(x.category),score:Number(x.score)
 } as CommandObs));
 const uniqueMap=new Map<string,CommandObs>();
 for(const x of all)if(!uniqueMap.has(bucketKey(x)))uniqueMap.set(bucketKey(x),x);
 const unique=[...uniqueMap.values()];
 const oppIds=[...new Set(unique.map(opportunityId).filter((x):x is string=>Boolean(x)))];
 const snapshots=oppIds.length?await sql`
  select opportunity_id,generated_at,master_score::float8,edge::float8
  from master_edge_snapshots
  where opportunity_id = any(${oppIds})
    and generated_at >= now() - interval '31 days'
  order by opportunity_id,generated_at asc
 `:[];
 const life=oppIds.length?await sql`
  select opportunity_id,observed_at,lifecycle_state
  from edge_lifecycle_events
  where opportunity_id = any(${oppIds})
    and observed_at >= now() - interval '31 days'
  order by opportunity_id,observed_at asc
 `:[];
 const snapMap=new Map<string,EdgeSnap[]>();
 for(const raw of snapshots as any[]){const id=String(raw.opportunity_id);snapMap.set(id,[...(snapMap.get(id)||[]),{opportunity_id:id,generated_at:String(raw.generated_at),master_score:Number(raw.master_score),edge:Number(raw.edge)}]);}
 const lifeMap=new Map<string,LifeEvent[]>();
 for(const raw of life as any[]){const id=String(raw.opportunity_id);lifeMap.set(id,[...(lifeMap.get(id)||[]),{opportunity_id:id,observed_at:String(raw.observed_at),lifecycle_state:String(raw.lifecycle_state)}]);}
 const utilities=new Map<string,number[]>();
 let ungradedCashout=0;
 for(const command of unique){
  if(command.command_type==='CASHOUT_REVIEW'||command.command_type==='FINAL_LEG_REVIEW'){ungradedCashout++;continue;}
  const id=opportunityId(command);
  if(!id)continue;
  const t=new Date(command.observed_at).getTime();
  if(command.command_type==='PRIME_RECHECK'||command.command_type==='READY_RECHECK'){
   const series=(snapMap.get(id)||[]).filter(x=>{const ts=new Date(x.generated_at).getTime();return ts>=t&&ts<=t+6*3600000;});
   if(series.length<2)continue;
   const first=series[0],last=series[series.length-1];
   const scoreDelta=last.master_score-first.master_score;
   const edgeDelta=Math.abs(last.edge)-Math.abs(first.edge);
   const utility=clamp(.5+scoreDelta*3+edgeDelta*2,0,1);
   utilities.set(command.command_type,[...(utilities.get(command.command_type)||[]),utility]);
  }else{
   const events=(lifeMap.get(id)||[]).filter(x=>{const ts=new Date(x.observed_at).getTime();return ts>=t&&ts<=t+6*3600000;});
   if(!events.length)continue;
   const terminal=events.some(x=>x.lifecycle_state==='DECAYED'||x.lifecycle_state==='EXIT');
   const strengthening=events.some(x=>x.lifecycle_state==='STRENGTHENING');
   const utility=command.command_type==='EDGE_EXIT'?(terminal?1:strengthening?.15:.55):(terminal?.90:strengthening?.10:.55);
   utilities.set(command.command_type,[...(utilities.get(command.command_type)||[]),utility]);
  }
 }
 const commandTypes=['PRIME_RECHECK','READY_RECHECK','EDGE_WEAKENING','EDGE_EXIT','CASHOUT_REVIEW','FINAL_LEG_REVIEW'];
 const rows:CommandEffectivenessRow[]=commandTypes.map(commandType=>{
  const values=utilities.get(commandType)||[];
  const gradedSamples=values.length;
  const samples=unique.filter(x=>x.command_type===commandType).length;
  const positiveSamples=values.filter(x=>x>=.60).length;
  const positiveRate=gradedSamples?positiveSamples/gradedSamples:0;
  const averageUtility=mean(values);
  const confidence=clamp(gradedSamples/80);
  if(commandType==='CASHOUT_REVIEW'||commandType==='FINAL_LEG_REVIEW')return {commandType,samples,gradedSamples,positiveSamples,positiveRate,averageUtility,confidence:0,multiplier:1,evidence:'INSUFFICIENT',state:'UNSCORED'};
  const shrink=gradedSamples/(gradedSamples+50);
  const centered=(averageUtility-.5)*2;
  const raw=.5+centered*shrink*.5;
  const multiplier=.94+clamp(raw)*.12;
  const state=gradedSamples<12?'UNSCORED':multiplier>=1.025?'BOOST':multiplier<=.975?'REDUCE':'NEUTRAL';
  return {commandType,samples,gradedSamples,positiveSamples,positiveRate,averageUtility,confidence,multiplier,evidence:evidence(gradedSamples),state};
 });
 const multipliers=new Map(rows.map(x=>[x.commandType,x.multiplier]));
 return {configured:true,rows,multipliers,ungradedCashout};
}