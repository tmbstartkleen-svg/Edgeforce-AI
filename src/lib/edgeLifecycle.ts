import {db} from './db';
import type {MasterEdgeOpportunity} from './masterEdge';

export type EdgeLifecycleState='NEW'|'STRENGTHENING'|'STABLE'|'WEAKENING'|'DECAYED'|'EXIT';

export type EdgeLifecycleRow=MasterEdgeOpportunity & {
 lifecycleState:EdgeLifecycleState;
 priorMasterScore:number|null;
 priorEdge:number|null;
 scoreDelta:number|null;
 edgeDelta:number|null;
 ageMinutes:number|null;
 actionLabel:'WATCH'|'HOLD'|'RECHECK'|'REMOVE';
 reason:string;
};

type PriorRow={
 opportunity_id:string;
 master_score:number;
 edge:number;
 generated_at:string;
};

function classify(current:MasterEdgeOpportunity,prior:PriorRow|null):EdgeLifecycleRow{
 if(!prior){
  return {...current,lifecycleState:'NEW',priorMasterScore:null,priorEdge:null,scoreDelta:null,edgeDelta:null,ageMinutes:null,actionLabel:'WATCH',reason:'Newly surfaced opportunity with no recent comparable snapshot.'};
 }
 const scoreDelta=current.masterScore-Number(prior.master_score);
 const edgeDelta=current.edge-Number(prior.edge);
 const ageMinutes=Math.max(0,(Date.now()-new Date(prior.generated_at).getTime())/60000);
 let lifecycleState:EdgeLifecycleState='STABLE';
 let actionLabel:EdgeLifecycleRow['actionLabel']='WATCH';
 let reason='Opportunity remains broadly stable versus the prior snapshot.';
 if(current.masterScore<.50||Math.abs(current.edge)<.01){
  lifecycleState='DECAYED'; actionLabel='REMOVE'; reason='Master score or model-market edge fell below the lifecycle floor.';
 }else if(scoreDelta>=.035||Math.abs(current.edge)>=Math.abs(Number(prior.edge))+.02){
  lifecycleState='STRENGTHENING'; actionLabel='RECHECK'; reason='Master score or model-market gap improved materially since the prior snapshot.';
 }else if(scoreDelta<=-.035||Math.abs(current.edge)+.02<=Math.abs(Number(prior.edge))){
  lifecycleState='WEAKENING'; actionLabel='HOLD'; reason='Master score or model-market gap weakened materially since the prior snapshot.';
 }
 return {...current,lifecycleState,priorMasterScore:Number(prior.master_score),priorEdge:Number(prior.edge),scoreDelta,edgeDelta,ageMinutes,actionLabel,reason};
}

export async function analyzeOpportunityLifecycle(board:MasterEdgeOpportunity[]){
 const sql=db();
 if(!sql){
  return {generatedAt:new Date().toISOString(),configured:false,rows:board.map(x=>classify(x,null)),exits:[] as EdgeLifecycleRow[],persisted:false};
 }
 const ids=board.map(x=>x.id);
 const prior=ids.length?await sql`
  select distinct on (opportunity_id)
   opportunity_id,master_score::float8,edge::float8,generated_at
  from master_edge_snapshots
  where opportunity_id = any(${ids})
   and generated_at >= now() - interval '24 hours'
  order by opportunity_id,generated_at desc
 `:[];
 const priorMap=new Map((prior as any[]).map(x=>[String(x.opportunity_id),x as PriorRow]));
 const rows=board.map(x=>classify(x,priorMap.get(x.id)||null));

 const priorTop=await sql`
  select distinct on (opportunity_id)
   opportunity_id,domain,category,venue,title,model_probability::float8,market_probability::float8,
   edge::float8,confidence::float8,router_weight::float8,liquidity_score::float8,
   freshness_score::float8,master_score::float8,tier,metadata,generated_at
  from master_edge_snapshots
  where generated_at >= now() - interval '6 hours'
  order by opportunity_id,generated_at desc
  limit 500
 `;
 const currentIds=new Set(ids);
 const exits:EdgeLifecycleRow[]=(priorTop as any[])
  .filter(x=>!currentIds.has(String(x.opportunity_id)))
  .filter(x=>Number(x.master_score)>=.58)
  .slice(0,40)
  .map(x=>({
   id:String(x.opportunity_id),domain:String(x.domain)==='MARKETS'?'MARKETS':'SPORTS',category:String(x.category),venue:String(x.venue||''),title:String(x.title),
   modelProbability:Number(x.model_probability),marketProbability:Number(x.market_probability),edge:Number(x.edge),confidence:Number(x.confidence),
   routerWeight:Number(x.router_weight),liquidityScore:Number(x.liquidity_score),freshnessScore:Number(x.freshness_score),masterScore:Number(x.master_score),
   tier:String(x.tier) as MasterEdgeOpportunity['tier'],sourceType:String(x.domain)==='MARKETS'?'PREDICTION_MARKET':'SPORTSBOOK',
   metadata:(x.metadata||{}) as Record<string,unknown>,lifecycleState:'EXIT',priorMasterScore:Number(x.master_score),priorEdge:Number(x.edge),
   scoreDelta:null,edgeDelta:null,ageMinutes:Math.max(0,(Date.now()-new Date(x.generated_at).getTime())/60000),actionLabel:'REMOVE',
   reason:'Previously qualified opportunity no longer appears on the current Master Edge board.'
  }));

 const latestWrite=await sql`select max(generated_at) as latest from master_edge_snapshots`;
 const latest=latestWrite[0]?.latest?new Date(latestWrite[0].latest as string).getTime():0;
 const shouldWrite=!latest||Date.now()-latest>=5*60000;
 if(shouldWrite&&board.length){
  for(const x of board){
   await sql`
    insert into master_edge_snapshots(
     generated_at,opportunity_id,domain,category,venue,title,model_probability,market_probability,edge,confidence,router_weight,liquidity_score,freshness_score,master_score,tier,metadata
    ) values(
     now(),${x.id},${x.domain},${x.category},${x.venue},${x.title},${x.modelProbability},${x.marketProbability},${x.edge},${x.confidence},${x.routerWeight},${x.liquidityScore},${x.freshnessScore},${x.masterScore},${x.tier},${sql.json(x.metadata as any)}
    )
   `;
  }
  for(const x of [...rows,...exits].filter(y=>y.lifecycleState!=='STABLE')){
   await sql`
    insert into edge_lifecycle_events(
     observed_at,opportunity_id,domain,category,venue,lifecycle_state,action_label,master_score,prior_master_score,edge,prior_edge,score_delta,edge_delta,reason,metadata
    ) values(
     now(),${x.id},${x.domain},${x.category},${x.venue},${x.lifecycleState},${x.actionLabel},${x.masterScore},${x.priorMasterScore},${x.edge},${x.priorEdge},${x.scoreDelta},${x.edgeDelta},${x.reason},${sql.json(x.metadata as any)}
    )
   `;
  }
 }
 return {generatedAt:new Date().toISOString(),configured:true,rows,exits,persisted:shouldWrite&&board.length>0};
}