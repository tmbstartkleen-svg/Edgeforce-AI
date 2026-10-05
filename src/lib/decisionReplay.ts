import {db} from './db';

export type ReplayDecisionState='PRIME'|'READY'|'WATCH'|'HOLD'|'REMOVE';
export type ReplayRow={
 opportunityId:string;
 observedAt:string;
 state:ReplayDecisionState;
 actionabilityScore:number;
 forwardHours:number;
 forwardScoreDelta:number|null;
 forwardEdgeDelta:number|null;
 capturedValuePoints:number|null;
 terminalDecay:boolean;
 utility:number|null;
 positive:boolean|null;
};
export type ReplaySummaryRow={
 state:ReplayDecisionState;
 samples:number;
 gradedSamples:number;
 positiveRate:number;
 averageUtility:number;
 averageScoreDelta:number;
 averageEdgeDelta:number;
 averageCapturedValue:number;
 decayRate:number;
 confidence:number;
};

const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));
const mean=(xs:number[])=>xs.length?xs.reduce((s,x)=>s+x,0)/xs.length:0;

function hourlyKey(id:string,at:string,state:string){
 const d=new Date(at);
 return [id,state,d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate(),d.getUTCHours()].join('|');
}

export async function buildDecisionReplay(){
 const sql=db();
 if(!sql)return {configured:false,rows:[] as ReplayRow[],summary:[] as ReplaySummaryRow[],ordering:{status:'INSUFFICIENT',score:0}};
 const [decisions,master,capture,lifecycle]=await Promise.all([
  sql`select opportunity_id,observed_at,decision_state,actionability_score::float8 from final_decision_snapshots where observed_at>=now()-interval '30 days' order by observed_at asc limit 30000`,
  sql`select opportunity_id,generated_at,master_score::float8,edge::float8 from master_edge_snapshots where generated_at>=now()-interval '31 days' order by generated_at asc limit 50000`,
  sql`select opportunity_id,observed_at,captured_value_points::float8 from price_capture_benchmarks where observed_at>=now()-interval '31 days' and captured_value_points is not null order by observed_at asc limit 30000`,
  sql`select opportunity_id,observed_at,lifecycle_state from edge_lifecycle_events where observed_at>=now()-interval '31 days' order by observed_at asc limit 30000`
 ]);

 const unique=new Map<string,any>();
 for(const raw of decisions as any[]){
  const id=String(raw.opportunity_id);
  const at=String(raw.observed_at);
  const state=String(raw.decision_state) as ReplayDecisionState;
  const k=hourlyKey(id,at,state);
  if(!unique.has(k))unique.set(k,{id,at,state,score:Number(raw.actionability_score)});
 }

 const masterMap=new Map<string,any[]>();
 for(const raw of master as any[]){const id=String(raw.opportunity_id);masterMap.set(id,[...(masterMap.get(id)||[]),{at:String(raw.generated_at),score:Number(raw.master_score),edge:Number(raw.edge)}]);}
 const capMap=new Map<string,any[]>();
 for(const raw of capture as any[]){const id=String(raw.opportunity_id);capMap.set(id,[...(capMap.get(id)||[]),{at:String(raw.observed_at),value:Number(raw.captured_value_points)}]);}
 const lifeMap=new Map<string,any[]>();
 for(const raw of lifecycle as any[]){const id=String(raw.opportunity_id);lifeMap.set(id,[...(lifeMap.get(id)||[]),{at:String(raw.observed_at),state:String(raw.lifecycle_state)}]);}

 const rows:ReplayRow[]=[];
 for(const d of unique.values()){
  const t=new Date(d.at).getTime();
  const horizon=t+6*3600000;
  const series=(masterMap.get(d.id)||[]).filter(x=>{const ts=new Date(x.at).getTime();return ts>=t&&ts<=horizon;});
  const start=series[0];
  const end=series.at(-1);
  const forwardScoreDelta=start&&end?end.score-start.score:null;
  const forwardEdgeDelta=start&&end?Math.abs(end.edge)-Math.abs(start.edge):null;
  const cap=(capMap.get(d.id)||[]).filter(x=>{const ts=new Date(x.at).getTime();return ts>=t&&ts<=horizon;});
  const capturedValuePoints=cap.length?mean(cap.map(x=>x.value)):null;
  const terminalDecay=(lifeMap.get(d.id)||[]).some(x=>{const ts=new Date(x.at).getTime();return ts>=t&&ts<=horizon&&(x.state==='DECAYED'||x.state==='EXIT');});
  let utility:number|null=null;
  if(forwardScoreDelta!==null||capturedValuePoints!==null){
   const scoreComp=forwardScoreDelta===null?.5:clamp(.5+forwardScoreDelta*3);
   const edgeComp=forwardEdgeDelta===null?.5:clamp(.5+forwardEdgeDelta*2);
   const capComp=capturedValuePoints===null?.5:clamp(.5+capturedValuePoints/8);
   const sustain=terminalDecay?0:1;
   if(d.state==='PRIME'||d.state==='READY')utility=clamp(scoreComp*.35+edgeComp*.20+capComp*.25+sustain*.20);
   else if(d.state==='HOLD'||d.state==='REMOVE')utility=clamp((1-scoreComp)*.30+(1-edgeComp)*.20+(1-capComp)*.20+(terminalDecay?1:0)*.30);
   else utility=clamp(scoreComp*.25+(1-Math.abs(scoreComp-.5)*2)*.25+capComp*.25+sustain*.25);
  }
  rows.push({opportunityId:d.id,observedAt:d.at,state:d.state,actionabilityScore:d.score,forwardHours:6,forwardScoreDelta,forwardEdgeDelta,capturedValuePoints,terminalDecay,utility,positive:utility===null?null:utility>=.60});
 }

 const states=['PRIME','READY','WATCH','HOLD','REMOVE'] as const;
 const summary:ReplaySummaryRow[]=states.map(state=>{
  const group=rows.filter(x=>x.state===state);
  const graded=group.filter(x=>x.utility!==null);
  return {
   state,samples:group.length,gradedSamples:graded.length,positiveRate:graded.length?graded.filter(x=>x.positive).length/graded.length:0,
   averageUtility:mean(graded.map(x=>x.utility as number)),
   averageScoreDelta:mean(group.map(x=>x.forwardScoreDelta).filter((x):x is number=>x!==null)),
   averageEdgeDelta:mean(group.map(x=>x.forwardEdgeDelta).filter((x):x is number=>x!==null)),
   averageCapturedValue:mean(group.map(x=>x.capturedValuePoints).filter((x):x is number=>x!==null)),
   decayRate:group.length?group.filter(x=>x.terminalDecay).length/group.length:0,
   confidence:clamp(graded.length/100)
  };
 });

 const m=new Map(summary.map(x=>[x.state,x]));
 const prime=m.get('PRIME')!,ready=m.get('READY')!,watch=m.get('WATCH')!;
 const enough=[prime,ready,watch].every(x=>x.gradedSamples>=20);
 const ordered=enough&&prime.averageUtility>=ready.averageUtility&&ready.averageUtility>=watch.averageUtility;
 const separation=enough?Math.max(0,prime.averageUtility-watch.averageUtility):0;
 const ordering={status:!enough?'INSUFFICIENT':ordered?'ORDERED':'MISORDERED',score:clamp(separation/.20)};
 return {configured:true,rows:rows.sort((a,b)=>(b.utility??-1)-(a.utility??-1)),summary,ordering};
}

export async function persistDecisionReplay(summary:ReplaySummaryRow[],ordering:{status:string;score:number}){
 const sql=db();
 if(!sql||!summary.length)return {persisted:false};
 const latest=await sql`select max(observed_at) as latest from decision_replay_snapshots`;
 const latestMs=latest[0]?.latest?new Date(latest[0].latest as string).getTime():0;
 if(latestMs&&Date.now()-latestMs<60*60000)return {persisted:false};
 for(const x of summary){
  await sql`insert into decision_replay_snapshots(observed_at,decision_state,samples,graded_samples,positive_rate,average_utility,average_score_delta,average_edge_delta,average_captured_value,decay_rate,confidence,ordering_status,ordering_score) values(now(),${x.state},${x.samples},${x.gradedSamples},${x.positiveRate},${x.averageUtility},${x.averageScoreDelta},${x.averageEdgeDelta},${x.averageCapturedValue},${x.decayRate},${x.confidence},${ordering.status},${ordering.score})`;
 }
 return {persisted:true};
}