/**
 * Pure model settlement calibration audit. No sportsbook/score data is fetched.
 * All forecast/outcome pairs must be supplied by a separately authorized,
 * verifiable settlement pipeline. This evaluates measured skill; it cannot
 * authenticate their provenance or approve a model for live deployment.
 */
export type SettledForecast={
 eventId:string;marketId:string;outcomeId:string;modelId:string;modelVersion:string;
 forecastAt:string;settledAt:string;probability:number;result:0|1;
};
export function auditHeldOutProbabilityCalibration(
 input:SettledForecast[],now=Date.now(),bins=10
){
 if(!Array.isArray(input)||input.length>50000||!Number.isFinite(now)||
    !Number.isSafeInteger(bins)||bins<2||bins>20)throw Error('INVALID_CALIBRATION_BATCH');
 const rejects:Record<string,number>={};
 const reject=(s:string)=>{rejects[s]=(rejects[s]||0)+1};
 const unique=new Set<string>();
 const accepted:SettledForecast[]=[];
 let modelKey='';
 for(const x of input){
  if(!x||![x.eventId,x.marketId,x.outcomeId,x.modelId,x.modelVersion].every(v=>typeof v==='string'&&v.trim())||
   typeof x.probability!=='number'||!Number.isFinite(x.probability)||x.probability<=0||x.probability>=1||
   (x.result!==0&&x.result!==1)){reject('INVALID_SETTLEMENT');continue}
  const prediction=Date.parse(x.forecastAt),settlement=Date.parse(x.settledAt);
  if(!Number.isFinite(prediction)||!Number.isFinite(settlement)||prediction>=settlement||settlement>now){
   reject('INVALID_TEMPORAL_ORDER');continue;
  }
  const model=x.modelId+'@'+x.modelVersion;
  if(modelKey&&model!==modelKey){reject('MIXED_MODEL_VERSIONS');continue}
  const id=JSON.stringify([x.eventId,x.marketId,x.outcomeId,model]);
  if(unique.has(id)){reject('DUPLICATE_SETTLEMENT');continue}
  modelKey=model;
  unique.add(id);accepted.push(x);
 }
 const groups=Array.from({length:bins},(_,index)=>({index,count:0,sumProbability:0,sumResult:0,
  meanProbability:0,observedFrequency:0,absoluteError:0}));
 let squared=0,logLoss=0;
 for(const x of accepted){
  const g=groups[Math.min(bins-1,Math.floor(x.probability*bins))];
  g.count++;g.sumProbability+=x.probability;g.sumResult+=x.result;
  squared+=(x.probability-x.result)**2;
  logLoss-=x.result?Math.log(x.probability):Math.log1p(-x.probability);
 }
 let ece=0,maximumGap=0;
 for(const g of groups){
  if(g.count){
   g.meanProbability=g.sumProbability/g.count;
   g.observedFrequency=g.sumResult/g.count;
   g.absoluteError=Math.abs(g.meanProbability-g.observedFrequency);
   ece+=g.count*g.absoluteError;
   maximumGap=Math.max(maximumGap,g.absoluteError);
  }
 }
 const n=accepted.length;
 return {mode:'HELD_OUT_CALIBRATION_AUDIT' as const,
  modelKey:modelKey||null,sampleSize:n,
  brierScore:n?squared/n:null,logLoss:n?logLoss/n:null,
  expectedCalibrationError:n?ece/n:null,maxBinCalibrationGap:n?maximumGap:null,
  binCount:bins,bins:groups.filter(g=>g.count>0).map(({index,count,meanProbability,observedFrequency,absoluteError})=>
   ({index,count,meanProbability,observedFrequency,absoluteError})),
  rejected:rejects,
  minimumSampleMet:n>=100,
  sourceProvenanceVerified:false,holdoutPartitionVerified:false,
  independentModelVerified:false,certified:false,
  warning:'Settlements and true held-out partitions must be audited independently. Metrics do not themselves establish calibration certification.'};
}
