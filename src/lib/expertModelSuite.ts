import type {Market} from './types';

export type ExpertModelFamily=
 'RATING'|'BAYESIAN'|'SCORE'|'EXPECTED_VALUE'|'PLAYER'|'MARKET'|'MACHINE_LEARNING'|'LIVE'|'MLOPS'|'DATA';

export type ExpertModelOutput={
 id:string;
 name:string;
 family:ExpertModelFamily;
 probability:number;
 weight:number;
 confidence:number;
 source:'NATIVE'|'EXTERNAL';
 inputs:string[];
 explanation:string;
};

export type ExpertCatalogEntry={
 id:string;
 name:string;
 family:ExpertModelFamily;
 kind:'MODEL'|'SOFTWARE'|'DATA_PLATFORM'|'MLOPS';
 integration:'NATIVE'|'EXTERNAL_BRIDGE'|'LICENSED_CONNECTOR'|'WORKFLOW';
 status:'ACTIVE'|'BRIDGE_READY'|'CONFIGURED'|'LICENSE_REQUIRED';
 sports:string[];
 purpose:string;
 requires:string[];
 env?:string[];
};

const clamp=(n:number,min=.01,max=.99)=>Math.max(min,Math.min(max,n));
const raw=(m:Market,key:string)=>{
 const n=Number(m.sportFeatures?.[key]);
 return Number.isFinite(n)?n:undefined;
};
const has=(m:Market,...keys:string[])=>keys.some(k=>raw(m,k)!==undefined);
const logit=(p:number)=>Math.log(clamp(p)/(1-clamp(p)));
const logistic=(x:number)=>1/(1+Math.exp(-x));
const selectionText=(m:Market)=>`${m.selection} ${m.market}`.toLowerCase();
const isHome=(m:Market)=>m.home&&m.home.toLowerCase()!=='home'&&selectionText(m).includes(m.home.toLowerCase());
const isAway=(m:Market)=>m.away&&m.away.toLowerCase()!=='away'&&selectionText(m).includes(m.away.toLowerCase());
const isDraw=(m:Market)=>/\b(draw|tie)\b/.test(selectionText(m));

function relativeDiff(m:Market,diffKey:string,homeKey:string,awayKey:string){
 const direct=raw(m,diffKey);
 if(direct!==undefined)return direct;
 const home=raw(m,homeKey),away=raw(m,awayKey);
 if(home===undefined||away===undefined)return undefined;
 const diff=home-away;
 return isAway(m)?-diff:diff;
}

function parseLine(m:Market){
 const matches=[...`${m.market} ${m.selection}`.matchAll(/([+-]?\d+(?:\.\d+)?)/g)]
  .map(x=>Number(x[1])).filter(Number.isFinite);
 return matches.length?matches[matches.length-1]:undefined;
}

function poissonPmf(k:number,lambda:number){
 if(k<0||!Number.isFinite(lambda)||lambda<=0)return 0;
 let factorial=1;
 for(let i=2;i<=k;i++)factorial*=i;
 return Math.exp(-lambda)*Math.pow(lambda,k)/factorial;
}

function normalCdf(x:number){
 const sign=x<0?-1:1;
 const z=Math.abs(x)/Math.sqrt(2);
 const t=1/(1+.3275911*z);
 const erf=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-z*z);
 return .5*(1+sign*erf);
}

function marketBayes(m:Market):ExpertModelOutput{
 const confidence=Math.max(.1,Math.min(1,m.confidence));
 const priorWeight=.58-.28*confidence;
 const p=clamp(m.marketProb*priorWeight+m.modelProb*(1-priorWeight));
 return {
  id:'bayesian-market-prior',name:'Bayesian Market Prior',family:'BAYESIAN',
  probability:p,weight:.16,confidence:.72+.20*confidence,source:'NATIVE',
  inputs:['marketProb','modelProb','confidence'],
  explanation:'Shrinks the model toward the market prior when evidence confidence is weaker.'
 };
}

function eloModel(m:Market):ExpertModelOutput|null{
 const diff=relativeDiff(m,'eloDiff','homeElo','awayElo');
 if(diff===undefined)return null;
 const p=clamp(1/(1+Math.pow(10,-diff/400)));
 return {
  id:'elo-rating',name:'Elo Rating',family:'RATING',probability:p,weight:.14,confidence:.78,source:'NATIVE',
  inputs:['eloDiff or homeElo/awayElo'],explanation:'Classic rating-difference win probability using the Elo expectation curve.'
 };
}

function glickoModel(m:Market):ExpertModelOutput|null{
 const diff=relativeDiff(m,'glickoDiff','homeGlicko','awayGlicko');
 if(diff===undefined)return null;
 const opponentRd=raw(m,isAway(m)?'homeGlickoRd':'awayGlickoRd')??raw(m,'glickoOpponentRd')??80;
 const q=Math.log(10)/400;
 const g=1/Math.sqrt(1+3*q*q*opponentRd*opponentRd/(Math.PI*Math.PI));
 const p=clamp(1/(1+Math.pow(10,-g*diff/400)));
 const confidence=Math.max(.45,Math.min(.92,1-opponentRd/500));
 return {
  id:'glicko-rating',name:'Glicko Rating',family:'RATING',probability:p,weight:.12,confidence,source:'NATIVE',
  inputs:['glickoDiff','opponent rating deviation'],explanation:'Rating probability adjusted for opponent rating uncertainty.'
 };
}

function bradleyTerry(m:Market):ExpertModelOutput|null{
 const diff=relativeDiff(m,'strengthDiff','homeStrength','awayStrength');
 if(diff===undefined)return null;
 const scale=Math.abs(diff)>8?1/400:1;
 const p=clamp(logistic(diff*scale));
 return {
  id:'bradley-terry',name:'Bradley-Terry Strength',family:'RATING',probability:p,weight:.11,confidence:.74,source:'NATIVE',
  inputs:['strengthDiff or homeStrength/awayStrength'],explanation:'Pairwise strength model converting relative team/player strength to win probability.'
 };
}

function expectedScores(m:Market){
 const home=raw(m,'homeExpectedScore')??raw(m,'homeLambda')??raw(m,'homeXg');
 const away=raw(m,'awayExpectedScore')??raw(m,'awayLambda')??raw(m,'awayXg');
 return home!==undefined&&away!==undefined&&home>=0&&away>=0?{home,away}:null;
}

function poissonOutcome(m:Market):ExpertModelOutput|null{
 const means=expectedScores(m);
 if(!means)return null;
 const line=parseLine(m);
 const text=selectionText(m);
 let probability=0;
 const max=Math.max(12,Math.ceil(Math.max(means.home,means.away)*4+8));
 for(let h=0;h<=max;h++){
  const hp=poissonPmf(h,means.home);
  for(let a=0;a<=max;a++){
   const joint=hp*poissonPmf(a,means.away);
   if(text.includes('over')&&line!==undefined){if(h+a>Math.abs(line))probability+=joint;continue}
   if(text.includes('under')&&line!==undefined){if(h+a<Math.abs(line))probability+=joint;continue}
   if(isDraw(m)){if(h===a)probability+=joint;continue}
   if(isAway(m)){if(a>h)probability+=joint;continue}
   if(isHome(m)){if(h>a)probability+=joint;continue}
   if(h>a)probability+=joint;
  }
 }
 return {
  id:'poisson-score',name:'Poisson Score Model',family:'SCORE',probability:clamp(probability),weight:.13,confidence:.80,source:'NATIVE',
  inputs:['homeExpectedScore/homeLambda/homeXg','awayExpectedScore/awayLambda/awayXg'],
  explanation:'Enumerates independent team score distributions for moneyline, draw, and total outcomes.'
 };
}

function skellamOutcome(m:Market):ExpertModelOutput|null{
 const means=expectedScores(m);
 const line=parseLine(m);
 if(!means||line===undefined)return null;
 const text=selectionText(m);
 if(!/(spread|run line|puck line|handicap|[+-]\d)/.test(text))return null;
 let probability=0;
 const max=Math.max(12,Math.ceil(Math.max(means.home,means.away)*4+8));
 for(let h=0;h<=max;h++){
  const hp=poissonPmf(h,means.home);
  for(let a=0;a<=max;a++){
   const joint=hp*poissonPmf(a,means.away);
   const margin=isAway(m)?a-h:h-a;
   if(margin+line>0)probability+=joint;
  }
 }
 return {
  id:'skellam-margin',name:'Skellam Margin Model',family:'SCORE',probability:clamp(probability),weight:.11,confidence:.78,source:'NATIVE',
  inputs:['expected scoring rates','spread/handicap line'],
  explanation:'Uses the difference of Poisson scoring processes to price spread-style outcomes.'
 };
}

function dixonColes(m:Market):ExpertModelOutput|null{
 const sport=(m.sport||m.league||'').toUpperCase();
 if(!(sport.includes('SOCCER')||sport.includes('FOOTBALL')))return null;
 const means=expectedScores(m);
 if(!means)return null;
 const rho=Math.max(-.20,Math.min(.20,raw(m,'dixonColesRho')??-.08));
 let probability=0,total=0;
 const tau=(h:number,a:number)=>{
  if(h===0&&a===0)return 1-means.home*means.away*rho;
  if(h===0&&a===1)return 1+means.home*rho;
  if(h===1&&a===0)return 1+means.away*rho;
  if(h===1&&a===1)return 1-rho;
  return 1;
 };
 for(let h=0;h<=10;h++)for(let a=0;a<=10;a++){
  const joint=Math.max(0,poissonPmf(h,means.home)*poissonPmf(a,means.away)*tau(h,a));
  total+=joint;
  if(isDraw(m)&&h===a)probability+=joint;
  else if(isAway(m)&&a>h)probability+=joint;
  else if(isHome(m)&&h>a)probability+=joint;
  else if(!isDraw(m)&&!isAway(m)&&!isHome(m)&&h>a)probability+=joint;
 }
 return {
  id:'dixon-coles',name:'Dixon-Coles Soccer',family:'SCORE',
  probability:clamp(probability/Math.max(.0001,total)),weight:.14,confidence:.84,source:'NATIVE',
  inputs:['home/away xG or expected goals','rho low-score correction'],
  explanation:'Soccer score model with low-score dependence correction for 0-0, 1-0, 0-1, and 1-1 outcomes.'
 };
}

function xgModel(m:Market):ExpertModelOutput|null{
 const diff=relativeDiff(m,'xgDiff','homeXg','awayXg');
 if(diff===undefined)return null;
 const p=clamp(logistic(diff*1.15));
 return {
  id:'expected-goals',name:'Expected Goals / Shot Quality',family:'EXPECTED_VALUE',
  probability:p,weight:.12,confidence:.78,source:'NATIVE',
  inputs:['xgDiff or homeXg/awayXg'],explanation:'Transforms expected-goal or shot-quality advantage into a directional outcome probability.'
 };
}

function playerProjection(m:Market):ExpertModelOutput|null{
 const line=parseLine(m);
 const mean=m.playerContext?.projection??raw(m,'projection')??raw(m,'propMean');
 const sd=m.playerContext?.stdDev??raw(m,'projectionStd')??raw(m,'propStd');
 if(line===undefined||mean===undefined||sd===undefined||sd<=0)return null;
 const over=1-normalCdf((Math.abs(line)-mean)/sd);
 const probability=selectionText(m).includes('under')?1-over:over;
 return {
  id:'player-distribution',name:'Player Projection Distribution',family:'PLAYER',
  probability:clamp(probability),weight:.13,confidence:.80,source:'NATIVE',
  inputs:['player projection','projection std dev','prop line'],
  explanation:'Prices player props from a projection mean and uncertainty distribution rather than a point estimate alone.'
 };
}

function sharpConsensus(m:Market):ExpertModelOutput|null{
 const sharp=m.consensus?.sharpProbability;
 if(sharp===undefined)return null;
 const agreement=m.consensus?.agreement??.5;
 const p=clamp(m.marketProb*(1-.55*agreement)+sharp*(.55*agreement));
 return {
  id:'sharp-consensus',name:'Sharp/Public Consensus',family:'MARKET',
  probability:p,weight:.11,confidence:.60+.30*agreement,source:'NATIVE',
  inputs:['sharpProbability','marketProbability','cross-book agreement'],
  explanation:'Uses designated sharp-book consensus as a market-structure signal while retaining the target-book price.'
 };
}

function externalMl(m:Market):ExpertModelOutput|null{
 const p=raw(m,'externalExpertProbability');
 if(p===undefined||p<=0||p>=1)return null;
 const confidence=Math.max(.25,Math.min(.99,raw(m,'externalExpertConfidence')??.70));
 return {
  id:'external-ml-ensemble',name:'External ML Ensemble',family:'MACHINE_LEARNING',
  probability:clamp(p),weight:.16,confidence,source:'EXTERNAL',
  inputs:['normalized external model-service probability'],
  explanation:'Prediction returned by the configured external ML service, allowing XGBoost, LightGBM, CatBoost, PyMC, Stan, or deep-learning models to participate.'
 };
}

export function runExpertModels(m:Market):ExpertModelOutput[]{
 return [
  marketBayes(m),eloModel(m),glickoModel(m),bradleyTerry(m),poissonOutcome(m),
  skellamOutcome(m),dixonColes(m),xgModel(m),playerProjection(m),sharpConsensus(m),externalMl(m)
 ].filter((x):x is ExpertModelOutput=>Boolean(x));
}

export function expertConsensus(m:Market){
 const outputs=runExpertModels(m);
 const effective=outputs.map(x=>({...x,effectiveWeight:x.weight*x.confidence}));
 const weight=effective.reduce((s,x)=>s+x.effectiveWeight,0);
 const probability=effective.reduce((s,x)=>s+x.probability*x.effectiveWeight,0)/Math.max(.0001,weight);
 const mean=outputs.reduce((s,x)=>s+x.probability,0)/Math.max(1,outputs.length);
 const dispersion=Math.sqrt(outputs.reduce((s,x)=>s+(x.probability-mean)**2,0)/Math.max(1,outputs.length));
 const agreement=Math.max(0,Math.min(1,1-dispersion/.14));
 return {
  probability:clamp(probability),
  outputs,
  modelCount:outputs.length,
  nativeCount:outputs.filter(x=>x.source==='NATIVE').length,
  externalCount:outputs.filter(x=>x.source==='EXTERNAL').length,
  agreement,
  dispersion,
  coverage:Math.min(1,outputs.length/8)
 };
}

export function expertModelCatalog():ExpertCatalogEntry[]{
 const externalConfigured=Boolean(process.env.EXPERT_MODEL_SERVICE_URL);
 const vendor=(id:string,name:string,purpose:string,sports:string[],env:string[]):ExpertCatalogEntry=>({
  id,name,family:'DATA',kind:'DATA_PLATFORM',integration:'LICENSED_CONNECTOR',
  status:env.some(k=>Boolean(process.env[k]))?'CONFIGURED':'LICENSE_REQUIRED',
  sports,purpose,requires:['commercial/API access','normalized feed adapter'],env
 });
 return [
  {id:'bayesian-market-prior',name:'Bayesian Market Prior',family:'BAYESIAN',kind:'MODEL',integration:'NATIVE',status:'ACTIVE',sports:['ALL'],purpose:'prior shrinkage and uncertainty control',requires:['market probability','model probability']},
  {id:'elo-rating',name:'Elo',family:'RATING',kind:'MODEL',integration:'NATIVE',status:'ACTIVE',sports:['TEAM','H2H'],purpose:'dynamic strength ratings',requires:['Elo ratings or Elo difference']},
  {id:'glicko-rating',name:'Glicko',family:'RATING',kind:'MODEL',integration:'NATIVE',status:'ACTIVE',sports:['TEAM','H2H'],purpose:'rating plus rating uncertainty',requires:['Glicko ratings','rating deviation']},
  {id:'bradley-terry',name:'Bradley-Terry',family:'RATING',kind:'MODEL',integration:'NATIVE',status:'ACTIVE',sports:['ALL H2H'],purpose:'pairwise strength probability',requires:['relative strengths']},
  {id:'poisson-score',name:'Poisson Score Model',family:'SCORE',kind:'MODEL',integration:'NATIVE',status:'ACTIVE',sports:['SOCCER','NHL','MLB','LOW-SCORE'],purpose:'score and total distributions',requires:['expected scoring rates']},
  {id:'skellam-margin',name:'Skellam Margin',family:'SCORE',kind:'MODEL',integration:'NATIVE',status:'ACTIVE',sports:['SOCCER','NHL','MLB'],purpose:'spread and score-difference distributions',requires:['expected scoring rates','line']},
  {id:'dixon-coles',name:'Dixon-Coles',family:'SCORE',kind:'MODEL',integration:'NATIVE',status:'ACTIVE',sports:['SOCCER'],purpose:'low-score correlated soccer outcomes',requires:['expected goals']},
  {id:'expected-goals',name:'xG / Shot Quality',family:'EXPECTED_VALUE',kind:'MODEL',integration:'NATIVE',status:'ACTIVE',sports:['SOCCER','NHL'],purpose:'chance-quality based strength',requires:['xG or shot-quality inputs']},
  {id:'player-distribution',name:'Player Projection Distribution',family:'PLAYER',kind:'MODEL',integration:'NATIVE',status:'ACTIVE',sports:['PLAYER PROPS'],purpose:'projection distributions for props',requires:['mean','standard deviation','line']},
  {id:'sharp-consensus',name:'Sharp/Public Consensus',family:'MARKET',kind:'MODEL',integration:'NATIVE',status:'ACTIVE',sports:['ALL'],purpose:'market microstructure and book-role signal',requires:['multi-book consensus']},
  {id:'xgboost',name:'XGBoost',family:'MACHINE_LEARNING',kind:'SOFTWARE',integration:'EXTERNAL_BRIDGE',status:externalConfigured?'CONFIGURED':'BRIDGE_READY',sports:['ALL'],purpose:'gradient-boosted tree classification/regression',requires:['trained model service'],env:['EXPERT_MODEL_SERVICE_URL']},
  {id:'lightgbm',name:'LightGBM',family:'MACHINE_LEARNING',kind:'SOFTWARE',integration:'EXTERNAL_BRIDGE',status:externalConfigured?'CONFIGURED':'BRIDGE_READY',sports:['ALL'],purpose:'fast gradient-boosted decision trees',requires:['trained model service'],env:['EXPERT_MODEL_SERVICE_URL']},
  {id:'catboost',name:'CatBoost',family:'MACHINE_LEARNING',kind:'SOFTWARE',integration:'EXTERNAL_BRIDGE',status:externalConfigured?'CONFIGURED':'BRIDGE_READY',sports:['ALL'],purpose:'gradient boosting with strong categorical-feature support',requires:['trained model service'],env:['EXPERT_MODEL_SERVICE_URL']},
  {id:'pymc',name:'PyMC',family:'BAYESIAN',kind:'SOFTWARE',integration:'EXTERNAL_BRIDGE',status:externalConfigured?'CONFIGURED':'BRIDGE_READY',sports:['ALL'],purpose:'hierarchical Bayesian sports models and uncertainty',requires:['Python model service'],env:['EXPERT_MODEL_SERVICE_URL']},
  {id:'stan',name:'Stan',family:'BAYESIAN',kind:'SOFTWARE',integration:'EXTERNAL_BRIDGE',status:externalConfigured?'CONFIGURED':'BRIDGE_READY',sports:['ALL'],purpose:'probabilistic programming and posterior inference',requires:['model service'],env:['EXPERT_MODEL_SERVICE_URL']},
  {id:'sklearn',name:'scikit-learn',family:'MACHINE_LEARNING',kind:'SOFTWARE',integration:'EXTERNAL_BRIDGE',status:externalConfigured?'CONFIGURED':'BRIDGE_READY',sports:['ALL'],purpose:'logistic regression, random forests, calibration and stacking',requires:['Python model service'],env:['EXPERT_MODEL_SERVICE_URL']},
  {id:'pytorch',name:'PyTorch / TensorFlow',family:'MACHINE_LEARNING',kind:'SOFTWARE',integration:'EXTERNAL_BRIDGE',status:externalConfigured?'CONFIGURED':'BRIDGE_READY',sports:['TRACKING','SEQUENCES','ALL'],purpose:'deep learning for tracking, sequence, image, and multimodal models',requires:['GPU/CPU model service'],env:['EXPERT_MODEL_SERVICE_URL']},
  {id:'optuna',name:'Optuna',family:'MLOPS',kind:'MLOPS',integration:'WORKFLOW',status:externalConfigured?'CONFIGURED':'BRIDGE_READY',sports:['ALL'],purpose:'hyperparameter optimization and search',requires:['training pipeline'],env:['EXPERT_MODEL_SERVICE_URL']},
  {id:'mlflow',name:'MLflow',family:'MLOPS',kind:'MLOPS',integration:'WORKFLOW',status:externalConfigured?'CONFIGURED':'BRIDGE_READY',sports:['ALL'],purpose:'experiment tracking, model registry, lineage and promotion through the external training service',requires:['training/model service'],env:['EXPERT_MODEL_SERVICE_URL']},
  {id:'shap',name:'SHAP',family:'MLOPS',kind:'MLOPS',integration:'WORKFLOW',status:externalConfigured?'CONFIGURED':'BRIDGE_READY',sports:['ALL'],purpose:'feature-attribution explainability for ML predictions',requires:['supported trained model'],env:['EXPERT_MODEL_SERVICE_URL']},
  vendor('opta','Stats Perform Opta / Opta Predictions','live and historical sports data plus predictive feeds',['MULTI-SPORT'],['OPTA_NORMALIZED_URL','OPTA_NORMALIZED_KEY']),
  vendor('sportradar','Sportradar Sports Data / Insights','real-time data, tracking, insights, projections and odds context',['MULTI-SPORT'],['SPORTRADAR_NORMALIZED_URL','SPORTRADAR_NORMALIZED_KEY']),
  vendor('synergy','Synergy Basketball','play-type, shot quality, roles, player impact and projections',['BASKETBALL'],['SYNERGY_NORMALIZED_URL','SYNERGY_NORMALIZED_KEY']),
  vendor('second-spectrum','Second Spectrum','optical/player tracking and spatial analytics',['NBA','SOCCER'],['SECOND_SPECTRUM_NORMALIZED_URL','SECOND_SPECTRUM_NORMALIZED_KEY']),
  vendor('pff','PFF Data','football grades, player/team data and advanced football analysis',['NFL','NCAAF'],['PFF_NORMALIZED_URL','PFF_NORMALIZED_KEY']),
  {id:'mlb-statcast',name:'MLB Statcast / Baseball Savant',family:'DATA',kind:'DATA_PLATFORM',integration:'LICENSED_CONNECTOR',status:'ACTIVE',sports:['MLB'],purpose:'pitch, batted-ball, player and team tracking metrics',requires:['Statcast-compatible data ingestion']}
 ];
}

export function expertSuiteStatus(){
 const catalog=expertModelCatalog();
 return {
  nativeModels:catalog.filter(x=>x.kind==='MODEL'&&x.integration==='NATIVE').length,
  bridgeTools:catalog.filter(x=>x.integration==='EXTERNAL_BRIDGE').length,
  configuredBridgeTools:catalog.filter(x=>x.integration==='EXTERNAL_BRIDGE'&&x.status==='CONFIGURED').length,
  premiumDataPlatforms:catalog.filter(x=>x.kind==='DATA_PLATFORM').length,
  configuredPremiumPlatforms:catalog.filter(x=>x.kind==='DATA_PLATFORM'&&(x.status==='CONFIGURED'||x.status==='ACTIVE')).length,
  mlopsTools:catalog.filter(x=>x.kind==='MLOPS').length,
  externalModelServiceConfigured:Boolean(process.env.EXPERT_MODEL_SERVICE_URL)
 };
}
