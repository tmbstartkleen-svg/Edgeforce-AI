import {db} from './db';
import {RELEASE} from './releaseManifest';
import type {Market} from './types';

export type TrainingHistoryRow={
 occurredAt:string;
 sport:string;
 marketKey:string;
 predicted:number;
 odds:number;
 outcome:0|1;
 features?:Record<string,unknown>;
};

export type TrainedSportArtifact={
 id?:number;
 sport:string;
 marketKey:string;
 algorithm:'EDGEFORCE_LOGISTIC_L2_CALIBRATED';
 artifactVersion:string;
 featureNames:string[];
 coefficients:number[];
 intercept:number;
 scalerMeans:number[];
 scalerScales:number[];
 calibrationA:number;
 calibrationB:number;
 sampleSize:number;
 trainSize:number;
 calibrationSize:number;
 holdoutSize:number;
 trainBrier:number;
 holdoutBrier:number;
 holdoutLogLoss:number;
 holdoutAccuracy:number;
 marketBaselineBrier:number;
 marketBaselineLogLoss:number;
 brierSkillScore:number;
 calibrationError:number;
 promoted:boolean;
 promotionReason:string;
 featureImportance:Record<string,number>;
 trainStart?:string;
 trainEnd?:string;
 holdoutStart?:string;
 holdoutEnd?:string;
 modelVersion:string;
};

export type TrainedPrediction={
 probability:number;
 confidence:number;
 featureCoverage:number;
 artifactId?:number;
 sport:string;
 marketKey:string;
 algorithm:string;
 artifactVersion:string;
};

type Example={x:number[];y:0|1;marketProbability:number;occurredAt:string};

const BASE_FEATURES=[
 'marketImplied','consensusProbability','consensusAgreement','consensusDispersion',
 'sharpProbability','publicProbability','sharpPublicGap',
 'contextScore','contextCoverage','contextCriticalCoverage'
];

const SPORT_FEATURES:Record<string,string[]>={
 NFL:['home','injury','quarterback','offenseDefense','rest','weather','trenches','turnover','efficiency','form','travel'],
 NCAAF:['home','quarterback','injury','efficiency','trenches','tempo','weather','travel','turnover','form'],
 MLB:['home','starter','bullpen','offenseHandedness','park','weather','rest','defense','lineup','form'],
 NBA:['home','injury','usage','pace','rest','matchup','shooting','travel','efficiency','form','lineup'],
 WNBA:['home','injury','usage','pace','rest','matchup','shooting','travel','efficiency','form','lineup'],
 NCAAB:['home','injury','tempo','efficiency','rebounding','turnover','travel','experience','form','lineup'],
 NHL:['home','goalie','injury','shotQuality','specialTeams','rest','travel','pace','form','lineup'],
 Soccer:['home','xg','injury','keeper','rest','travel','form','tactical','setPieces','weather','lineup'],
 Tennis:['surface','serve','return','form','fatigue','injury','headToHead','travel'],
 'Table Tennis':['serve','return','form','matchup','fatigue','style','travel','headToHead'],
 UFC:['striking','grappling','takedownDefense','cardio','reach','ageCurve','form','finishRisk','weightCut','recentForm'],
 Boxing:['striking','defense','reach','cardio','form','ageCurve','weightCut','finishRisk'],
 Golf:['courseFit','approach','offTee','putting','recentForm','weather','fieldStrength','travel'],
 Motorsports:['trackFit','qualifying','teamPace','reliability','weather','recentForm','grid'],
 Cricket:['batting','bowling','venue','weather','form','lineup','toss','travel'],
 Rugby:['home','injury','form','pack','kicking','discipline','rest','travel'],
 Volleyball:['serve','receive','attack','block','form','injury','home','travel'],
 Lacrosse:['home','goalie','faceoff','offenseDefense','form','injury','rest','pace'],
 Esports:['mapPool','form','roster','matchup','patch','travel','experience']
};

const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));
const sigmoid=(x:number)=>x>=0?1/(1+Math.exp(-x)):Math.exp(x)/(1+Math.exp(x));
const logit=(p:number)=>Math.log(clamp(p,.001,.999)/(1-clamp(p,.001,.999)));
const decimal=(odds:number)=>odds>0?1+odds/100:1+100/Math.max(1,Math.abs(odds));
const implied=(odds:number)=>clamp(1/decimal(odds),.001,.999);
const num=(v:unknown)=>{
 const n=Number(v);
 return Number.isFinite(n)?n:undefined;
};
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};

export function canonicalTrainingSport(raw:string){
 const s=raw.toUpperCase();
 if(s.includes('NFL'))return 'NFL';
 if(s.includes('NCAAF')||s.includes('COLLEGE FOOTBALL'))return 'NCAAF';
 if(s.includes('MLB')||s.includes('BASEBALL'))return 'MLB';
 if(s.includes('WNBA'))return 'WNBA';
 if(s.includes('NBA'))return 'NBA';
 if(s.includes('NCAAB')||s.includes('COLLEGE BASKETBALL'))return 'NCAAB';
 if(s.includes('NHL')||s.includes('HOCKEY'))return 'NHL';
 if(s.includes('TABLE TENNIS')||s.includes('PING PONG'))return 'Table Tennis';
 if(s.includes('TENNIS')||s.includes('ATP')||s.includes('WTA'))return 'Tennis';
 if(s.includes('UFC')||s.includes('MMA'))return 'UFC';
 if(s.includes('BOXING'))return 'Boxing';
 if(s.includes('SOCCER')||s.includes('EPL')||s.includes('MLS')||s.includes('CHAMPIONS'))return 'Soccer';
 if(s.includes('GOLF')||s.includes('PGA'))return 'Golf';
 if(s.includes('NASCAR')||s.includes('FORMULA')||s.includes('MOTORSPORT'))return 'Motorsports';
 if(s.includes('CRICKET'))return 'Cricket';
 if(s.includes('RUGBY'))return 'Rugby';
 if(s.includes('VOLLEYBALL'))return 'Volleyball';
 if(s.includes('LACROSSE'))return 'Lacrosse';
 if(s.includes('ESPORT')||s.includes('LEAGUE OF LEGENDS')||s.includes('COUNTER-STRIKE')||s.includes('DOTA'))return 'Esports';
 return raw;
}

export function trainingFeatureNames(sport:string){
 const canonical=canonicalTrainingSport(sport);
 return [...BASE_FEATURES,...(SPORT_FEATURES[canonical]||['home','injury','form','matchup','rest','travel'])];
}

function historicalFeatureValue(row:TrainingHistoryRow,name:string){
 const f=obj(row.features);
 const sportFeatures=obj(f.sportFeatures);
 const consensus=obj(f.consensus);
 const quality=obj(f.contextQuality);
 const market=implied(row.odds);
 if(name==='marketImplied')return market;
 if(name==='consensusProbability')return num(consensus.consensusProbability)??market;
 if(name==='consensusAgreement')return num(consensus.agreement)??.5;
 if(name==='consensusDispersion')return num(consensus.dispersion)??.05;
 if(name==='sharpProbability')return num(consensus.sharpProbability)??market;
 if(name==='publicProbability')return num(consensus.publicProbability)??market;
 if(name==='sharpPublicGap')return num(consensus.sharpPublicGap)??0;
 if(name==='contextScore')return num(quality.score)??0;
 if(name==='contextCoverage')return num(quality.coverage)??0;
 if(name==='contextCriticalCoverage')return num(quality.criticalCoverage)??0;
 return num(sportFeatures[name])??0;
}

function currentFeatureValue(m:Market,name:string){
 const sf=m.sportFeatures||{};
 const consensus=m.consensus;
 const quality=m.contextQuality;
 const market=m.marketProb||implied(m.odds);
 if(name==='marketImplied')return market;
 if(name==='consensusProbability')return consensus?.consensusProbability??market;
 if(name==='consensusAgreement')return consensus?.agreement??.5;
 if(name==='consensusDispersion')return consensus?.dispersion??.05;
 if(name==='sharpProbability')return consensus?.sharpProbability??market;
 if(name==='publicProbability')return consensus?.publicProbability??market;
 if(name==='sharpPublicGap')return consensus?.sharpPublicGap??0;
 if(name==='contextScore')return quality?.score??0;
 if(name==='contextCoverage')return quality?.coverage??0;
 if(name==='contextCriticalCoverage')return quality?.criticalCoverage??0;
 return num(sf[name])??0;
}

function examples(rows:TrainingHistoryRow[],featureNames:string[]):Example[]{
 return rows.map(row=>({
  x:featureNames.map(name=>historicalFeatureValue(row,name)),
  y:row.outcome,
  marketProbability:implied(row.odds),
  occurredAt:row.occurredAt
 }));
}

function standardizer(rows:Example[],width:number){
 const means=Array(width).fill(0) as number[];
 const scales=Array(width).fill(1) as number[];
 if(!rows.length)return {means,scales};
 for(const row of rows)for(let j=0;j<width;j++)means[j]+=row.x[j]/rows.length;
 for(let j=0;j<width;j++){
  let variance=0;
  for(const row of rows)variance+=(row.x[j]-means[j])**2/rows.length;
  scales[j]=Math.sqrt(variance);
  if(scales[j]<1e-6)scales[j]=1;
 }
 return {means,scales};
}

function standardized(x:number[],means:number[],scales:number[]){
 return x.map((v,i)=>(v-means[i])/scales[i]);
}

function fitLogistic(rows:Example[],means:number[],scales:number[]){
 const width=means.length;
 const weights=Array(width).fill(0) as number[];
 let intercept=0;
 const l2=Math.max(.0001,Number(process.env.TRAINED_MODEL_L2||.015));
 const steps=Math.max(250,Number(process.env.TRAINED_MODEL_STEPS||700));
 const baseLr=Math.max(.002,Number(process.env.TRAINED_MODEL_LR||.035));
 for(let step=0;step<steps;step++){
  const grad=Array(width).fill(0) as number[];
  let gradB=0;
  const lr=baseLr/Math.sqrt(1+step/140);
  const batchSize=Math.min(rows.length,Math.max(32,Number(process.env.TRAINED_MODEL_BATCH_SIZE||256)));
  const start=rows.length?((step*batchSize)%rows.length):0;
  for(let k=0;k<batchSize;k++){
   const row=rows[(start+k)%rows.length];
   const z=standardized(row.x,means,scales);
   let score=intercept;
   for(let j=0;j<width;j++)score+=weights[j]*z[j];
   const error=sigmoid(score)-row.y;
   gradB+=error;
   for(let j=0;j<width;j++)grad[j]+=error*z[j];
  }
  const n=Math.max(1,batchSize);
  intercept-=lr*gradB/n;
  for(let j=0;j<width;j++)weights[j]-=lr*(grad[j]/n+l2*weights[j]);
 }
 return {weights,intercept};
}

function rawProbability(x:number[],weights:number[],intercept:number,means:number[],scales:number[]){
 const z=standardized(x,means,scales);
 let score=intercept;
 for(let j=0;j<weights.length;j++)score+=weights[j]*z[j];
 return clamp(sigmoid(score),.001,.999);
}

function fitCalibration(rows:Example[],predict:(x:number[])=>number){
 if(rows.length<10)return {a:1,b:0};
 let a=1,b=0;
 const lr=.025;
 for(let step=0;step<350;step++){
  let ga=0,gb=0;
  const batchSize=Math.min(rows.length,Math.max(24,Number(process.env.TRAINED_MODEL_BATCH_SIZE||256)));
  const start=rows.length?((step*batchSize)%rows.length):0;
  for(let k=0;k<batchSize;k++){
   const row=rows[(start+k)%rows.length];
   const score=logit(predict(row.x));
   const p=sigmoid(a*score+b);
   const e=p-row.y;
   ga+=e*score;
   gb+=e;
  }
  const n=Math.max(1,batchSize);
  a-=lr*(ga/n+.002*(a-1));
  b-=lr*gb/n;
 }
 return {a:Math.max(.20,Math.min(2.5,a)),b:Math.max(-1.5,Math.min(1.5,b))};
}

function applyCalibration(p:number,a:number,b:number){
 return clamp(sigmoid(a*logit(p)+b),.001,.999);
}

function metrics(rows:Example[],predict:(x:number[])=>number){
 if(!rows.length)return {brier:0,logLoss:0,accuracy:0,calibrationError:0};
 let brier=0,logLoss=0,correct=0;
 const bins=Array.from({length:5},()=>({p:0,y:0,n:0}));
 for(const row of rows){
  const p=clamp(predict(row.x),.001,.999);
  brier+=(p-row.y)**2;
  logLoss+=-(row.y*Math.log(p)+(1-row.y)*Math.log(1-p));
  correct+=((p>=.5?1:0)===row.y)?1:0;
  const bin=bins[Math.min(4,Math.floor(p*5))];
  bin.p+=p;bin.y+=row.y;bin.n++;
 }
 const calibrationError=rows.length?bins.reduce((s,b)=>b.n?s+Math.abs(b.p/b.n-b.y/b.n)*b.n:s,0)/rows.length:0;
 return {brier:brier/rows.length,logLoss:logLoss/rows.length,accuracy:correct/rows.length,calibrationError};
}

function baselineMetrics(rows:Example[]){
 return metrics(rows,x=>x[0]);
}

export function trainSportArtifact(
 rows:TrainingHistoryRow[],
 sport:string,
 marketKey='*',
 options:{minSample?:number;minHoldout?:number}={}
):TrainedSportArtifact{
 const canonical=canonicalTrainingSport(sport);
 const featureNames=trainingFeatureNames(canonical);
 const sorted=[...rows].filter(r=>r.outcome===0||r.outcome===1)
  .sort((a,b)=>new Date(a.occurredAt).getTime()-new Date(b.occurredAt).getTime());
 const minSample=Math.max(40,options.minSample??Number(process.env.TRAINED_MODEL_MIN_SAMPLE||80));
 const minHoldout=Math.max(12,options.minHoldout??Number(process.env.TRAINED_MODEL_MIN_HOLDOUT||20));
 const all=examples(sorted,featureNames);
 const trainEnd=Math.max(1,Math.floor(all.length*.70));
 const calibrationEnd=Math.max(trainEnd+1,Math.floor(all.length*.85));
 const train=all.slice(0,trainEnd);
 const calibration=all.slice(trainEnd,calibrationEnd);
 const holdout=all.slice(calibrationEnd);
 const {means,scales}=standardizer(train,featureNames.length);
 const fitted=fitLogistic(train,means,scales);
 const raw=(x:number[])=>rawProbability(x,fitted.weights,fitted.intercept,means,scales);
 const calibrationFit=fitCalibration(calibration,raw);
 const predict=(x:number[])=>applyCalibration(raw(x),calibrationFit.a,calibrationFit.b);
 const trainMetrics=metrics(train,predict);
 const holdoutMetrics=metrics(holdout,predict);
 const marketBaseline=baselineMetrics(holdout);
 const brierSkillScore=marketBaseline.brier>0?1-holdoutMetrics.brier/marketBaseline.brier:0;
 const importance=Object.fromEntries(featureNames.map((name,i)=>[name,Math.abs(fitted.weights[i])])
  .sort((a,b)=>b[1]-a[1]));
 const enough=sorted.length>=minSample&&holdout.length>=minHoldout;
 const promoted=enough&&brierSkillScore>=.01&&holdoutMetrics.logLoss<=marketBaseline.logLoss+.005&&holdoutMetrics.calibrationError<=.12;
 let promotionReason='Promoted: chronological holdout beat market baseline with acceptable calibration';
 if(!enough)promotionReason=`Held: sample ${sorted.length}/${minSample}, holdout ${holdout.length}/${minHoldout}`;
 else if(brierSkillScore<.01)promotionReason=`Held: Brier skill ${brierSkillScore.toFixed(3)} < 0.010 versus market baseline`;
 else if(holdoutMetrics.logLoss>marketBaseline.logLoss+.005)promotionReason=`Held: holdout log loss ${holdoutMetrics.logLoss.toFixed(3)} did not beat market baseline ${marketBaseline.logLoss.toFixed(3)}`;
 else if(holdoutMetrics.calibrationError>.12)promotionReason=`Held: calibration error ${holdoutMetrics.calibrationError.toFixed(3)} > 0.120`;

 return {
  sport:canonical,marketKey,algorithm:'EDGEFORCE_LOGISTIC_L2_CALIBRATED',
  artifactVersion:`v54-${canonical.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${marketKey.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`,
  featureNames,coefficients:fitted.weights,intercept:fitted.intercept,
  scalerMeans:means,scalerScales:scales,calibrationA:calibrationFit.a,calibrationB:calibrationFit.b,
  sampleSize:all.length,trainSize:train.length,calibrationSize:calibration.length,holdoutSize:holdout.length,
  trainBrier:trainMetrics.brier,holdoutBrier:holdoutMetrics.brier,holdoutLogLoss:holdoutMetrics.logLoss,
  holdoutAccuracy:holdoutMetrics.accuracy,marketBaselineBrier:marketBaseline.brier,
  marketBaselineLogLoss:marketBaseline.logLoss,brierSkillScore,calibrationError:holdoutMetrics.calibrationError,
  promoted,promotionReason,featureImportance:importance,
  trainStart:train[0]?.occurredAt,trainEnd:train.at(-1)?.occurredAt,
  holdoutStart:holdout[0]?.occurredAt,holdoutEnd:holdout.at(-1)?.occurredAt,
  modelVersion:RELEASE.modelVersion
 };
}

export function predictWithArtifact(m:Market,artifact:TrainedSportArtifact):TrainedPrediction{
 const values=artifact.featureNames.map(name=>currentFeatureValue(m,name));
 let present=0;
 for(const name of artifact.featureNames){
  if(BASE_FEATURES.includes(name)||Object.prototype.hasOwnProperty.call(m.sportFeatures||{},name))present++;
 }
 const raw=rawProbability(values,artifact.coefficients,artifact.intercept,artifact.scalerMeans,artifact.scalerScales);
 const probability=applyCalibration(raw,artifact.calibrationA,artifact.calibrationB);
 const featureCoverage=present/Math.max(1,artifact.featureNames.length);
 const sampleConfidence=Math.min(1,Math.log10(Math.max(10,artifact.sampleSize))/3);
 const validationConfidence=clamp(.45+Math.max(-.10,artifact.brierSkillScore)*1.8-artifact.calibrationError*.8,.20,.95);
 const confidence=clamp(sampleConfidence*.45+validationConfidence*.45+featureCoverage*.10,.20,.95);
 return {
  probability,confidence,featureCoverage,artifactId:artifact.id,sport:artifact.sport,marketKey:artifact.marketKey,
  algorithm:artifact.algorithm,artifactVersion:artifact.artifactVersion
 };
}

function parseArtifact(row:any):TrainedSportArtifact{
 return {
  id:Number(row.id),sport:String(row.sport),marketKey:String(row.marketKey),algorithm:'EDGEFORCE_LOGISTIC_L2_CALIBRATED',
  artifactVersion:String(row.artifactVersion),featureNames:Array.isArray(row.featureNames)?row.featureNames.map(String):[],
  coefficients:Array.isArray(row.coefficients)?row.coefficients.map(Number):[],intercept:Number(row.intercept)||0,
  scalerMeans:Array.isArray(row.scalerMeans)?row.scalerMeans.map(Number):[],scalerScales:Array.isArray(row.scalerScales)?row.scalerScales.map(Number):[],
  calibrationA:Number(row.calibrationA)||1,calibrationB:Number(row.calibrationB)||0,
  sampleSize:Number(row.sampleSize)||0,trainSize:Number(row.trainSize)||0,calibrationSize:Number(row.calibrationSize)||0,holdoutSize:Number(row.holdoutSize)||0,
  trainBrier:Number(row.trainBrier)||0,holdoutBrier:Number(row.holdoutBrier)||0,holdoutLogLoss:Number(row.holdoutLogLoss)||0,
  holdoutAccuracy:Number(row.holdoutAccuracy)||0,marketBaselineBrier:Number(row.marketBaselineBrier)||0,
  marketBaselineLogLoss:Number(row.marketBaselineLogLoss)||0,brierSkillScore:Number(row.brierSkillScore)||0,
  calibrationError:Number(row.calibrationError)||0,promoted:Boolean(row.promoted),promotionReason:String(row.promotionReason||''),
  featureImportance:obj(row.featureImportance) as Record<string,number>,
  trainStart:row.trainStart?String(row.trainStart):undefined,trainEnd:row.trainEnd?String(row.trainEnd):undefined,
  holdoutStart:row.holdoutStart?String(row.holdoutStart):undefined,holdoutEnd:row.holdoutEnd?String(row.holdoutEnd):undefined,
  modelVersion:String(row.modelVersion||RELEASE.modelVersion)
 };
}

export async function loadPromotedTrainedModels(){
 const sql=db();
 if(!sql)return [] as TrainedSportArtifact[];
 try{
  const rows=await sql`
   select distinct on (sport,market_key)
    id,sport,market_key as "marketKey",algorithm,artifact_version as "artifactVersion",
    feature_names as "featureNames",coefficients,intercept::float,
    scaler_means as "scalerMeans",scaler_scales as "scalerScales",
    calibration_a::float as "calibrationA",calibration_b::float as "calibrationB",
    sample_size as "sampleSize",train_size as "trainSize",calibration_size as "calibrationSize",holdout_size as "holdoutSize",
    train_brier::float as "trainBrier",holdout_brier::float as "holdoutBrier",holdout_log_loss::float as "holdoutLogLoss",
    holdout_accuracy::float as "holdoutAccuracy",market_baseline_brier::float as "marketBaselineBrier",
    market_baseline_log_loss::float as "marketBaselineLogLoss",brier_skill_score::float as "brierSkillScore",
    calibration_error::float as "calibrationError",promoted,promotion_reason as "promotionReason",
    feature_importance as "featureImportance",train_start as "trainStart",train_end as "trainEnd",
    holdout_start as "holdoutStart",holdout_end as "holdoutEnd",model_version as "modelVersion"
   from trained_model_artifacts
   where promoted=true
   order by sport,market_key,created_at desc
  `;
  return (rows as any[]).map(parseArtifact);
 }catch{
  return [] as TrainedSportArtifact[];
 }
}

export async function enrichMarketsWithTrainedSportModels(markets:Market[]){
 const artifacts=await loadPromotedTrainedModels();
 if(!artifacts.length)return {
  markets,diagnostics:{configured:true,activeArtifacts:0,matchedMarkets:0,sports:[] as string[]}
 };
 const exact=new Map(artifacts.map(a=>[`${a.sport}|${a.marketKey.toLowerCase()}`,a]));
 const broad=new Map(artifacts.filter(a=>a.marketKey==='*').map(a=>[a.sport,a]));
 let matchedMarkets=0;
 const enriched=markets.map(m=>{
  const sport=canonicalTrainingSport(m.sport||m.league);
  const artifact=exact.get(`${sport}|${m.market.toLowerCase()}`)||broad.get(sport);
  if(!artifact)return m;
  const prediction=predictWithArtifact(m,artifact);
  matchedMarkets++;
  return {
   ...m,
   sportFeatures:{
    ...(m.sportFeatures||{}),
    trainedSportMlProbability:prediction.probability,
    trainedSportMlConfidence:prediction.confidence,
    trainedSportMlCoverage:prediction.featureCoverage,
    trainedSportMlArtifactId:prediction.artifactId??0
   }
  };
 });
 return {
  markets:enriched,
  diagnostics:{configured:true,activeArtifacts:artifacts.length,matchedMarkets,sports:[...new Set(artifacts.map(x=>x.sport))].sort()}
 };
}

function trainingGroups(rows:TrainingHistoryRow[],minSample:number){
 const supported=rows.filter(x=>Boolean(SPORT_FEATURES[canonicalTrainingSport(x.sport)]));
 const groups=new Map<string,TrainingHistoryRow[]>();
 for(const row of supported){
  const sport=canonicalTrainingSport(row.sport);
  const sportKey=`${sport}|*`;
  groups.set(sportKey,[...(groups.get(sportKey)||[]),row]);
  const marketKey=`${sport}|${row.marketKey}`;
  groups.set(marketKey,[...(groups.get(marketKey)||[]),row]);
 }
 return [...groups.entries()]
  .map(([key,list])=>({key,list,sport:key.split('|')[0],marketKey:key.split('|').slice(1).join('|')}))
  .filter(g=>g.list.length>=(g.marketKey==='*'?minSample:Math.max(minSample,100)));
}

export async function recordTrainedModelPredictionSnapshots(markets:Market[]){
 const sql=db();
 if(!sql)return 0;
 let written=0;
 for(const m of markets){
  const probability=num(m.sportFeatures?.trainedSportMlProbability);
  const confidence=num(m.sportFeatures?.trainedSportMlConfidence);
  const coverage=num(m.sportFeatures?.trainedSportMlCoverage);
  const artifactId=num(m.sportFeatures?.trainedSportMlArtifactId);
  if(probability===undefined||probability<=0||probability>=1)continue;
  await sql`
   insert into trained_model_prediction_snapshots(
    market_id,sport,market_key,artifact_id,algorithm,probability,confidence,feature_coverage,observed_at,metadata
   ) values(
    ${m.id},${canonicalTrainingSport(m.sport||m.league)},${m.market},${artifactId??null},
    'EDGEFORCE_LOGISTIC_L2_CALIBRATED',${probability},${confidence??0},${coverage??0},now(),
    ${sql.json({selection:m.selection,event:m.event,odds:m.odds,marketProbability:m.marketProb,modelVersion:RELEASE.modelVersion})}
   )
  `;
  written++;
 }
 return written;
}

export async function trainAndPersistSportModels(){
 const sql=db();
 if(!sql)return {ok:true,mode:'dry-run' as const,rows:0,artifacts:[],promoted:0};
 const minSample=Math.max(40,Number(process.env.TRAINED_MODEL_MIN_SAMPLE||80));
 const minHoldout=Math.max(12,Number(process.env.TRAINED_MODEL_MIN_HOLDOUT||20));
 const lookback=Math.max(500,Number(process.env.TRAINED_MODEL_LOOKBACK_ROWS||30000));
 const maxGroupRows=Math.max(minSample,Number(process.env.TRAINED_MODEL_MAX_GROUP_ROWS||4000));
 const [run]=await sql`
  insert into trained_model_runs(model_version,status,started_at)
  values(${RELEASE.modelVersion},'running',now())
  returning id
 `;
 try{
  const rows=await sql`
   select occurred_at as "occurredAt",sport,market_key as "marketKey",
    predicted_probability::float as predicted,offered_odds as odds,outcome,features
   from historical_predictions
   where outcome is not null and model_name='Model Council'
   order by occurred_at desc
   limit ${lookback}
  `;
  const history=(rows as any[]).map(r=>({
   occurredAt:new Date(r.occurredAt).toISOString(),sport:String(r.sport),marketKey:String(r.marketKey),
   predicted:Number(r.predicted),odds:Number(r.odds),outcome:Number(r.outcome) as 0|1,
   features:obj(r.features)
  })) as TrainingHistoryRow[];
  const groups=trainingGroups(history,minSample);
  const artifacts=groups.map(g=>trainSportArtifact(g.list.slice(0,maxGroupRows),g.sport,g.marketKey,{minSample,minHoldout}));

  for(const a of artifacts){
   await sql`
    insert into trained_model_artifacts(
     sport,market_key,algorithm,artifact_version,feature_names,coefficients,intercept,
     scaler_means,scaler_scales,calibration_a,calibration_b,
     sample_size,train_size,calibration_size,holdout_size,train_brier,holdout_brier,
     holdout_log_loss,holdout_accuracy,market_baseline_brier,market_baseline_log_loss,
     brier_skill_score,calibration_error,promoted,promotion_reason,feature_importance,
     train_start,train_end,holdout_start,holdout_end,model_version,created_at
    ) values(
     ${a.sport},${a.marketKey},${a.algorithm},${a.artifactVersion},
     ${sql.json(a.featureNames)},${sql.json(a.coefficients)},${a.intercept},
     ${sql.json(a.scalerMeans)},${sql.json(a.scalerScales)},${a.calibrationA},${a.calibrationB},
     ${a.sampleSize},${a.trainSize},${a.calibrationSize},${a.holdoutSize},${a.trainBrier},${a.holdoutBrier},
     ${a.holdoutLogLoss},${a.holdoutAccuracy},${a.marketBaselineBrier},${a.marketBaselineLogLoss},
     ${a.brierSkillScore},${a.calibrationError},${a.promoted},${a.promotionReason},${sql.json(a.featureImportance)},
     ${a.trainStart??null},${a.trainEnd??null},${a.holdoutStart??null},${a.holdoutEnd??null},
     ${RELEASE.modelVersion},now()
    )
   `;
  }

  const promoted=artifacts.filter(x=>x.promoted).length;
  const sports=[...new Set(artifacts.map(x=>x.sport))].sort();
  await sql`
   update trained_model_runs set completed_at=now(),status='completed',
    rows_seen=${history.length},groups_evaluated=${groups.length},
    artifacts_trained=${artifacts.length},artifacts_promoted=${promoted},
    sports=${sql.json(sports)},metrics=${sql.json({
     minSample,minHoldout,lookback,maxGroupRows,
     top:artifacts.sort((a,b)=>b.brierSkillScore-a.brierSkillScore).slice(0,30).map(a=>({
      sport:a.sport,marketKey:a.marketKey,sampleSize:a.sampleSize,holdoutSize:a.holdoutSize,
      brierSkillScore:a.brierSkillScore,holdoutBrier:a.holdoutBrier,marketBaselineBrier:a.marketBaselineBrier,
      calibrationError:a.calibrationError,promoted:a.promoted,promotionReason:a.promotionReason
     }))
    })}
   where id=${run.id}
  `;
  return {ok:true,mode:'database' as const,runId:Number(run.id),rows:history.length,groups:groups.length,artifacts,promoted,sports};
 }catch(error){
  await sql`
   update trained_model_runs set completed_at=now(),status='failed',
    error_text=${error instanceof Error?error.message:'trained model run failed'}
   where id=${run.id}
  `.catch(()=>undefined);
  throw error;
 }
}

export async function trainedModelStatus(){
 const sql=db();
 if(!sql)return {ok:true,source:'none' as const,latestRun:null,artifacts:[],summary:{promoted:0,held:0,sports:0,averageBrierSkill:0}};
 try{
  const [latestRun]=await sql`
   select id,model_version as "modelVersion",status,rows_seen as "rowsSeen",groups_evaluated as "groupsEvaluated",
    artifacts_trained as "artifactsTrained",artifacts_promoted as "artifactsPromoted",sports,metrics,
    started_at as "startedAt",completed_at as "completedAt",error_text as error
   from trained_model_runs order by started_at desc limit 1
  `;
  const rows=await sql`
   select distinct on (sport,market_key)
    id,sport,market_key as "marketKey",algorithm,artifact_version as "artifactVersion",
    sample_size as "sampleSize",train_size as "trainSize",calibration_size as "calibrationSize",holdout_size as "holdoutSize",
    holdout_brier::float as "holdoutBrier",holdout_log_loss::float as "holdoutLogLoss",
    holdout_accuracy::float as "holdoutAccuracy",market_baseline_brier::float as "marketBaselineBrier",
    market_baseline_log_loss::float as "marketBaselineLogLoss",brier_skill_score::float as "brierSkillScore",
    calibration_error::float as "calibrationError",promoted,promotion_reason as "promotionReason",
    feature_importance as "featureImportance",model_version as "modelVersion",created_at as "createdAt"
   from trained_model_artifacts
   order by sport,market_key,created_at desc
   limit 1000
  `;
  const artifacts=rows as any[];
  return {
   ok:true,source:'database' as const,latestRun:latestRun||null,artifacts,
   summary:{
    promoted:artifacts.filter(x=>x.promoted).length,
    held:artifacts.filter(x=>!x.promoted).length,
    sports:new Set(artifacts.map(x=>x.sport)).size,
    averageBrierSkill:artifacts.length?artifacts.reduce((s,x)=>s+Number(x.brierSkillScore||0),0)/artifacts.length:0
   }
  };
 }catch(error){
  return {ok:false,source:'database' as const,latestRun:null,artifacts:[],summary:{promoted:0,held:0,sports:0,averageBrierSkill:0},error:error instanceof Error?error.message:'trained model status failed'};
 }
}
