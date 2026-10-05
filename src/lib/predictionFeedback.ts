import {db} from './db';
import {inferCanonicalClosingLine} from './marketMovementLearning';

export type PredictionFeedbackResult={
 eventId:string;
 marketKey?:string;
 selectionKey:string;
 result:'win'|'loss'|'push';
 offeredOdds?:number;
 closingOdds?:number;
 settledAt?:string;
};

export async function recordPredictionFeedback(results:PredictionFeedbackResult[]){
 const sql=db();
 if(!sql)return {written:0,matchedRuns:0,mode:'dry-run' as const};
 let written=0;
 let matchedRuns=0;

 for(const result of results){
  if(result.result==='push')continue;
  const runs=await sql`
   select mr.id,mr.model_version as "modelVersion",mr.market_key as "marketKey",mr.selection_key as "selectionKey",mr.model_probability::float as "modelProbability",
    mr.feature_snapshot as "featureSnapshot",e.sport,e.start_time as "startTime",
    (
     select ms.american_odds
     from market_snapshots ms
     where ms.event_id=mr.event_id and ms.market_key=mr.market_key and ms.selection_key=mr.selection_key
     order by ms.pulled_at desc limit 1
    ) as "storedOdds"
   from model_runs mr
   left join events e on e.id=mr.event_id
   where mr.event_id=${result.eventId}
    and (${result.marketKey??null}::text is null or lower(mr.market_key)=lower(${result.marketKey??''}))
    and lower(mr.selection_key)=lower(${result.selectionKey})
   order by mr.created_at desc
   limit 1
  `;
  if(!runs.length)continue;
  matchedRuns++;
  const run=runs[0] as any;
  const sport=String(run.sport||'Unknown');
  const marketKey=String(result.marketKey||run.marketKey||'Unknown');
  const offeredOdds=Number(result.offeredOdds??run.featureSnapshot?.offeredOdds??run.storedOdds);
  if(!Number.isFinite(offeredOdds)||offeredOdds===0)continue;
  const inferredClose=result.closingOdds===undefined
   ?await inferCanonicalClosingLine(result.eventId,marketKey,result.selectionKey||String(run.selectionKey||'')).catch(()=>null)
   :null;
  const closingOdds=Number.isFinite(Number(result.closingOdds))?Number(result.closingOdds):Number(inferredClose?.odds);
  const effectiveClosingOdds=Number.isFinite(closingOdds)&&closingOdds!==0?closingOdds:undefined;
  const occurredAt=run.startTime?new Date(run.startTime).toISOString():(result.settledAt||new Date().toISOString());
  const outcome=result.result==='win'?1:0;
  const votes=Array.isArray(run.featureSnapshot?.modelVotes)?run.featureSnapshot.modelVotes:[];
  const predictions=[
   {name:'Model Council',prob:Number(run.modelProbability)},
   ...votes.map((v:any)=>({name:String(v.name||'Unknown'),prob:Number(v.prob)}))
  ].filter((x:{name:string;prob:number})=>Number.isFinite(x.prob)&&x.prob>0&&x.prob<1);

  for(const prediction of predictions){
   const sourceKey=[result.eventId,marketKey,result.selectionKey,run.modelVersion,prediction.name].join('|');
   const inserted=await sql`
    insert into historical_predictions(
     occurred_at,sport,market_key,selection_key,model_name,model_version,
     predicted_probability,offered_odds,closing_odds,outcome,features,source_key
    ) values(
     ${occurredAt},${sport},${marketKey},${result.selectionKey},${prediction.name},
     ${run.modelVersion},${prediction.prob},${offeredOdds},${effectiveClosingOdds??null},
     ${outcome},${sql.json({
      ...(run.featureSnapshot&&typeof run.featureSnapshot==='object'?run.featureSnapshot:{}),
      modelRunId:Number(run.id),
      source:'settled-model-run',
      simProbability:Number(run.featureSnapshot?.rawSimProbability??run.modelProbability),
      modelProbability:Number(run.modelProbability),
      closingLineSource:result.closingOdds!==undefined?'results-provider':effectiveClosingOdds!==undefined?'canonical-market-snapshots':'missing'
     })},${sourceKey}
    )
    on conflict do nothing
    returning id
   `;
   written+=inserted.length;
  }
 }
 return {written,matchedRuns,mode:'database' as const};
}
