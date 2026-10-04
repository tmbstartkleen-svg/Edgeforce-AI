import type {Market} from './types';
import {canonicalTrainingSport,trainingFeatureNames,trainingFeatureVectorFromMarket} from './trainedSportModels';
import {mlServiceCircuitAllows,recordMlServiceFailure,recordMlServiceSuccess} from './mlServiceHealth';

type ExternalPrediction={
 marketId:string;
 probability:number;
 confidence?:number;
 model?:string;
 version?:string;
};

type ExternalResponse={
 predictions?:ExternalPrediction[];
 modelVersion?:string;
 warnings?:string[];
};

function clamp(n:number,min=0,max=1){return Math.max(min,Math.min(max,n))}

export async function enrichMarketsWithExternalExpertModels(markets:Market[]){
 const tournamentUrl=String(process.env.ML_PREDICTION_SERVICE_URL||'').trim();
 const legacyUrl=String(process.env.EXPERT_MODEL_SERVICE_URL||'').trim();
 const url=tournamentUrl||legacyUrl;
 const key=String(process.env.ML_PREDICTION_SERVICE_KEY||process.env.EXPERT_MODEL_SERVICE_KEY||'').trim();
 if(!url)return {
  markets,
  diagnostics:{configured:false,ok:false,rows:0,models:[],warnings:['No external ML prediction service is configured']}
 };
 if(tournamentUrl&&!mlServiceCircuitAllows())return {
  markets,
  diagnostics:{configured:true,ok:false,mode:'V56_CIRCUIT_OPEN',rows:0,models:[],warnings:['External ML circuit breaker is open; native EdgeForce models remain active']}
 };

 const controller=new AbortController();
 const timeoutMs=Math.max(1500,Number(process.env.EXPERT_MODEL_SERVICE_TIMEOUT_MS||7000));
 const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const tournamentMode=Boolean(tournamentUrl);
  const payload=tournamentMode?{
   schemaVersion:'edgeforce-ml-predict-v1',
   markets:markets.slice(0,500).map(m=>{
    const sport=canonicalTrainingSport(m.sport||m.league);
    const featureNames=trainingFeatureNames(sport);
    return {
     id:m.id,sport,market:m.market,featureNames,
     features:trainingFeatureVectorFromMarket(m,featureNames)
    };
   })
  }:{
   schemaVersion:'edgeforce-expert-v1',
   generatedAt:new Date().toISOString(),
   markets:markets.slice(0,500).map(m=>({
    id:m.id,sport:m.sport,league:m.league,event:m.event,selection:m.selection,market:m.market,
    startTime:m.startTime,home:m.home,away:m.away,odds:m.odds,marketProb:m.marketProb,
    modelProb:m.modelProb,confidence:m.confidence,period:m.period,
    sportFeatures:m.sportFeatures||{},playerContext:m.playerContext||null,
    consensus:m.consensus||null,contextQuality:m.contextQuality||null
   }))
  };
  const res=await fetch(url,{
   method:'POST',
   headers:{
    'content-type':'application/json',
    accept:'application/json',
    ...(key?{authorization:`Bearer ${key}`}:{})
   },
   body:JSON.stringify(payload),
   cache:'no-store',
   signal:controller.signal
  });
  if(!res.ok)throw new Error(`HTTP ${res.status}`);
  const body=await res.json() as ExternalResponse;
  const predictions=Array.isArray(body.predictions)?body.predictions:[];
  const groups=new Map<string,ExternalPrediction[]>();
  for(const row of predictions){
   if(!row||typeof row.marketId!=='string')continue;
   const probability=Number(row.probability);
   if(!Number.isFinite(probability)||probability<=0||probability>=1)continue;
   groups.set(row.marketId,[...(groups.get(row.marketId)||[]),{...row,probability}]);
  }
  const models=new Set<string>();
  const enriched=markets.map(m=>{
   const rows=groups.get(m.id)||[];
   if(!rows.length)return m;
   for(const row of rows)if(row.model)models.add(row.model);
   const weighted=rows.map(row=>{
    const confidence=clamp(Number(row.confidence??.70),.05,.99);
    return {probability:row.probability,confidence};
   });
   const weight=weighted.reduce((s,x)=>s+x.confidence,0);
   const probability=weighted.reduce((s,x)=>s+x.probability*x.confidence,0)/Math.max(.0001,weight);
   const confidence=weighted.reduce((s,x)=>s+x.confidence,0)/Math.max(1,weighted.length);
   return {
    ...m,
    sportFeatures:{
     ...(m.sportFeatures||{}),
     externalExpertProbability:clamp(probability,.001,.999),
     externalExpertConfidence:clamp(confidence,.05,.99),
     externalExpertModelCount:rows.length
    }
   };
  });
  if(tournamentMode)await recordMlServiceSuccess({serviceVersion:body.modelVersion||null});
  return {
   markets:enriched,
   diagnostics:{
    configured:true,ok:true,mode:tournamentMode?'V55_TOURNAMENT':'LEGACY',
    rows:groups.size,models:[...models].sort(),
    modelVersion:body.modelVersion||null,warnings:body.warnings||[]
   }
  };
 }catch(error){
  if(tournamentUrl)await recordMlServiceFailure(error);
  return {
   markets,
   diagnostics:{
    configured:true,ok:false,mode:tournamentUrl?'V55_TOURNAMENT':'LEGACY',
    rows:0,models:[],
    warnings:[error instanceof Error?error.message:'external expert model service failed']
   }
  };
 }finally{
  clearTimeout(timer);
 }
}
