import {db} from './db';
import type {MasterEdgeOpportunity} from './masterEdge';

export type EntryWindowState='EARLY'|'WAIT'|'ENTRY_WINDOW'|'LATE'|'CLOSED';

export type EntryWindowRow=MasterEdgeOpportunity & {
 timingState:EntryWindowState;
 timingScore:number;
 timingConfidence:number;
 hoursRemaining:number|null;
 scoreVelocityPerHour:number;
 edgeVelocityPerHour:number;
 scoreVolatility:number;
 edgeVolatility:number;
 historyPoints:number;
 historyHours:number;
 actionLabel:'MONITOR'|'WAIT'|'RECHECK'|'LATE'|'CLOSED';
 reason:string;
};

type Hist={opportunity_id:string;generated_at:string;master_score:number;edge:number};

const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));
const mean=(xs:number[])=>xs.length?xs.reduce((s,x)=>s+x,0)/xs.length:0;
const sd=(xs:number[])=>{if(xs.length<2)return 0;const m=mean(xs);return Math.sqrt(mean(xs.map(x=>(x-m)**2)));};

function hoursRemaining(row:MasterEdgeOpportunity){
 if(!row.startOrExpiry)return null;
 const ms=new Date(row.startOrExpiry).getTime()-Date.now();
 return Number.isFinite(ms)?ms/3600000:null;
}

function timingFromHistory(row:MasterEdgeOpportunity,history:Hist[]):EntryWindowRow{
 const ordered=[...history].sort((a,b)=>new Date(a.generated_at).getTime()-new Date(b.generated_at).getTime());
 const hours=hoursRemaining(row);
 let scoreVelocityPerHour=0;
 let edgeVelocityPerHour=0;
 let historyHours=0;
 if(ordered.length>=2){
  const first=ordered[0],last=ordered[ordered.length-1];
  historyHours=Math.max(.05,(new Date(last.generated_at).getTime()-new Date(first.generated_at).getTime())/3600000);
  scoreVelocityPerHour=(Number(last.master_score)-Number(first.master_score))/historyHours;
  edgeVelocityPerHour=(Number(last.edge)-Number(first.edge))/historyHours;
 }
 const scoreVolatility=sd(ordered.map(x=>Number(x.master_score)));
 const edgeVolatility=sd(ordered.map(x=>Number(x.edge)));
 const absEdge=Math.abs(row.edge);
 const momentum=clamp(.5+scoreVelocityPerHour*5+Math.sign(row.edge)*edgeVelocityPerHour*3);
 const stability=clamp(1-scoreVolatility/.08-edgeVolatility/.10);
 const urgency=hours===null?.45:hours<=0?1:hours<=1?.95:hours<=3?.80:hours<=8?.60:hours<=24?.35:.15;
 const quality=clamp(row.masterScore*.45+row.confidence*.20+clamp(absEdge/.12)*.20+stability*.15);
 const timingScore=clamp(quality*.56+momentum*.24+urgency*.20);
 const historyConfidence=clamp(ordered.length/12);
 const timingConfidence=clamp(.35+historyConfidence*.35+stability*.20+row.freshnessScore*.10);
 let timingState:EntryWindowState='WAIT';
 let actionLabel:EntryWindowRow['actionLabel']='WAIT';
 let reason='Opportunity is valid, but the timing profile is not yet compelling enough to prioritize.';
 if(hours!==null&&hours<=0){timingState='CLOSED';actionLabel='CLOSED';reason='The event or contract deadline has arrived or passed.';}
 else if(row.masterScore<.50||absEdge<.01){timingState='CLOSED';actionLabel='CLOSED';reason='The current edge no longer clears the minimum timing floor.';}
 else if(hours!==null&&hours<=1){timingState='LATE';actionLabel='LATE';reason='Very little time remains; price movement and stale-data risk are elevated.';}
 else if(hours!==null&&hours>18&&ordered.length<3){timingState='EARLY';actionLabel='MONITOR';reason='There is substantial time remaining and insufficient history to call an entry window.';}
 else if(timingScore>=.68&&stability>=.45&&(hours===null||hours<=12)){timingState='ENTRY_WINDOW';actionLabel='RECHECK';reason='Current score, edge quality, stability, momentum and time remaining align for a high-priority re-check.';}
 else if(scoreVelocityPerHour<-.025||Math.sign(row.edge)*edgeVelocityPerHour<-.02){timingState='WAIT';actionLabel='WAIT';reason='The opportunity is weakening fast enough that waiting for stabilization is preferable to chasing the move.';}
 else if(hours!==null&&hours>12){timingState='EARLY';actionLabel='MONITOR';reason='The opportunity is still early relative to its start/expiry; monitor for confirmation and better price development.';}
 else if(hours!==null&&hours<=3){timingState='LATE';actionLabel='LATE';reason='The opportunity remains valid but has moved into a late decision window.';}
 return {...row,timingState,timingScore,timingConfidence,hoursRemaining:hours,scoreVelocityPerHour,edgeVelocityPerHour,scoreVolatility,edgeVolatility,historyPoints:ordered.length,historyHours,actionLabel,reason};
}

export async function analyzeEntryWindows(board:MasterEdgeOpportunity[]){
 const sql=db();
 if(!sql)return {configured:false,generatedAt:new Date().toISOString(),rows:board.map(x=>timingFromHistory(x,[])),persisted:false};
 const ids=board.map(x=>x.id);
 const history=ids.length?await sql`
  select opportunity_id,generated_at,master_score::float8,edge::float8
  from master_edge_snapshots
  where opportunity_id = any(${ids})
    and generated_at >= now() - interval '24 hours'
  order by opportunity_id,generated_at asc
 `:[];
 const grouped=new Map<string,Hist[]>();
 for(const raw of history as any[]){const id=String(raw.opportunity_id);grouped.set(id,[...(grouped.get(id)||[]),raw as Hist]);}
 const rows=board.map(x=>timingFromHistory(x,grouped.get(x.id)||[]));
 const latest=await sql`select max(observed_at) as latest from entry_window_snapshots`;
 const latestMs=latest[0]?.latest?new Date(latest[0].latest as string).getTime():0;
 const shouldWrite=!latestMs||Date.now()-latestMs>=5*60000;
 if(shouldWrite){
  for(const x of rows){
   await sql`
    insert into entry_window_snapshots(
     observed_at,opportunity_id,domain,category,venue,timing_state,timing_score,timing_confidence,hours_remaining,score_velocity_per_hour,edge_velocity_per_hour,score_volatility,edge_volatility,history_points,action_label,master_score,edge,reason,metadata
    ) values(
     now(),${x.id},${x.domain},${x.category},${x.venue},${x.timingState},${x.timingScore},${x.timingConfidence},${x.hoursRemaining},${x.scoreVelocityPerHour},${x.edgeVelocityPerHour},${x.scoreVolatility},${x.edgeVolatility},${x.historyPoints},${x.actionLabel},${x.masterScore},${x.edge},${x.reason},${sql.json(x.metadata as any)}
    )
   `;
  }
 }
 return {configured:true,generatedAt:new Date().toISOString(),rows,persisted:shouldWrite};
}