import {db} from './db';
import type {Market,ContextProvenance} from './types';
import {RELEASE} from './releaseManifest';
import {getAutomationHealth} from './automationHealth';
import {getValidationLabStatus} from './validationLab';

export type IntelligenceComponentState='HEALTHY'|'DEGRADED'|'WARMING'|'STALE'|'FAILED'|'UNAVAILABLE';
export type IntelligenceComponent={
 id:string;label:string;state:IntelligenceComponentState;required:boolean;
 rows:number;ageMinutes:number|null;detail:string;
};
export type MarketIntelligenceAssessment={
 score:number;criticalCoverage:number;ready:boolean;playerMarket:boolean;
 playerStack:number;environment:number;marketSignal:number;reasons:string[];
};
export type UnifiedIntelligenceCertification={
 state:'HEALTHY'|'DEGRADED'|'BLOCKED';
 score:number;criticalCoverage:number;blockers:string[];warnings:string[];
 components:IntelligenceComponent[];release:{build:string;version:string;modelVersion:string;migrationVersion:number};
 environment:string;generatedAt:string;
};

const clamp=(n:number,min=0,max=1)=>Math.max(min,Math.min(max,n));
const finite=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)?n:undefined};
const stateScore=(s:IntelligenceComponentState)=>s==='HEALTHY' ? 1 : s==='DEGRADED' ? .72 : s==='WARMING' ? .55 : s==='STALE' ? .22 : s==='UNAVAILABLE' ? .30 : 0;
const provenanceNames=(m:Market)=>new Set((m.contextProvenance||[]).flatMap((p:ContextProvenance)=>[String(p.source||'').toLowerCase(),String(p.providerId||'').toLowerCase()]));

function anySource(names:Set<string>,patterns:string[]){
 for(const value of names)for(const p of patterns)if(value.includes(p))return true;
 return false;
}
function featureConfidence(m:Market,key:string,fallback=0){
 const v=finite(m.sportFeatures?.[key]);
 return v===undefined?fallback:clamp(v);
}

export function assessMarketIntelligence(m:Market):MarketIntelligenceAssessment{
 const names=provenanceNames(m);
 const contextScore=clamp(Number(m.contextQuality?.score??Math.min(1,Object.keys(m.sportFeatures||{}).length/10)));
 const criticalBase=clamp(Number(m.contextQuality?.criticalCoverage??contextScore));
 const playerMarket=Boolean(m.playerContext?.name)||anySource(names,['player-history','player-feature','player-calibration','opponent-matchup','lineup-redistribution','starting-lineup']);

 const injurySource=anySource(names,['injur','live-injury'])||Object.prototype.hasOwnProperty.call(m.sportFeatures||{},'injury')||m.playerContext?.availability!==undefined;
 const injury=injurySource ? .90 : .58;

 const playerSignals=[
  anySource(names,['player-history'])?1:0,
  anySource(names,['player-feature'])?1:0,
  anySource(names,['player-calibration'])?1:0,
  anySource(names,['opponent-matchup'])?1:0,
  anySource(names,['lineup-redistribution'])?1:0,
  anySource(names,['starting-lineup'])?1:0
 ];
 const playerStack=playerMarket
  ?clamp(playerSignals.reduce((s,x)=>s+x,0)/playerSignals.length+(m.playerContext?.projection!==undefined ? .12 : 0))
  :1;

 const schedule=featureConfidence(m,'scheduleFatigueConfidence',.58);
 const venue=featureConfidence(m,'venueWeatherConfidence',.62);
 const movement=featureConfidence(m,'marketMovementConfidence',.55);
 const environment=clamp(schedule*.56+venue*.44);
 const marketSignal=movement;

 const score=clamp(
  contextScore*.30+
  injury*.12+
  playerStack*.22+
  schedule*.12+
  venue*.10+
  movement*.08+
  clamp(1-Math.max(0,m.sourceAgeMin)/60)*.06
 );
 const criticalInputs=[criticalBase,injury,...(playerMarket?[playerStack]:[])];
 const criticalCoverage=clamp(criticalInputs.reduce((s,x)=>s+x,0)/criticalInputs.length);
 const ready=score>=.55&&criticalCoverage>=.48&&(!playerMarket||playerStack>=.34);
 const reasons:string[]=[];
 if(contextScore<.55)reasons.push('context coverage is thin');
 if(!injurySource)reasons.push('no explicit injury/availability signal');
 if(playerMarket&&playerStack<.34)reasons.push('player-learning stack is incomplete');
 if(schedule<.45)reasons.push('schedule/fatigue confidence is low');
 if(venue<.45)reasons.push('venue/condition confidence is low');
 if(movement<.35)reasons.push('market movement is still warming');
 if(m.sourceAgeMin>20)reasons.push('source data is aging');
 if(!reasons.length)reasons.push('unified intelligence coverage is healthy');
 return {score,criticalCoverage,ready,playerMarket,playerStack,environment,marketSignal,reasons};
}

export function enrichMarketsWithUnifiedIntelligence(markets:Market[]){
 let ready=0,playerMarkets=0,score=0,critical=0;
 const rows=markets.map(m=>{
  const assessment=assessMarketIntelligence(m);
  if(assessment.ready)ready++;
  if(assessment.playerMarket)playerMarkets++;
  score+=assessment.score;critical+=assessment.criticalCoverage;
  const observedAt=new Date().toISOString();
  return {
   ...m,
   sportFeatures:{
    ...(m.sportFeatures||{}),
    intelligenceStackScore:assessment.score,
    intelligenceCriticalCoverage:assessment.criticalCoverage,
    intelligenceStackReady:assessment.ready?1:0,
    intelligencePlayerStack:assessment.playerStack,
    intelligenceEnvironment:assessment.environment,
    intelligenceMarketSignal:assessment.marketSignal
   },
   contextSources:[...new Set([...(m.contextSources||[]),'unified-intelligence'])],
   contextProvenance:[...(m.contextProvenance||[]),{
    source:'unified-intelligence',providerId:'edgeforce-v71-unified',field:'intelligenceStackScore',
    observedAt,confidence:assessment.score,status:assessment.ready?'LIVE':'DEGRADED',
    detail:{criticalCoverage:assessment.criticalCoverage,playerMarket:assessment.playerMarket,playerStack:assessment.playerStack,reasons:assessment.reasons}
   } as ContextProvenance]
  };
 });
 return {
  markets:rows,
  diagnostics:{
   total:markets.length,ready,notReady:markets.length-ready,playerMarkets,
   readyRate:markets.length?ready/markets.length:0,
   averageScore:markets.length?score/markets.length:0,
   averageCriticalCoverage:markets.length?critical/markets.length:0
  }
 };
}

async function queryComponent(
 id:string,label:string,required:boolean,
 query:()=>Promise<{rows:number;ageMinutes:number|null}>,
 healthyAge:number|null,degradedAge:number|null,
 options:{emptyState?:IntelligenceComponentState}={}
):Promise<IntelligenceComponent>{
 try{
  const result=await query();
  let state:IntelligenceComponentState='HEALTHY';
  if(result.rows<=0)state=options.emptyState??'WARMING';
  else if(result.ageMinutes!==null&&healthyAge!==null&&result.ageMinutes>healthyAge){
   state=degradedAge!==null&&result.ageMinutes>degradedAge?'STALE':'DEGRADED';
  }
  return {id,label,state,required,rows:result.rows,ageMinutes:result.ageMinutes,detail:result.rows?`${result.rows} row(s)`:'No durable evidence yet'};
 }catch(error){
  return {id,label,state:'UNAVAILABLE',required,rows:0,ageMinutes:null,detail:error instanceof Error?error.message:'query unavailable'};
 }
}

export async function buildUnifiedIntelligenceCertification():Promise<UnifiedIntelligenceCertification>{
 const sql=db();
 const environment=process.env.DEPLOYMENT_ENV||process.env.VERCEL_ENV||'local';
 if(!sql){
  return {
   state:'DEGRADED',score:.30,criticalCoverage:.30,blockers:[],warnings:['Database is not configured; durable intelligence certification is unavailable'],
   components:[],release:{build:RELEASE.build,version:RELEASE.appVersion,modelVersion:RELEASE.modelVersion,migrationVersion:RELEASE.migrationVersion},
   environment,generatedAt:new Date().toISOString()
  };
 }
 const components=await Promise.all([
  queryComponent('injuries','Intraday injury snapshots',true,async()=>{
   const [r]=await sql`select count(*) filter(where observed_at>now()-interval '24 hours')::int as rows,extract(epoch from (now()-max(observed_at)))/60::float as age from injury_context_snapshots`;
   return {rows:Number(r?.rows||0),ageMinutes:r?.age===null?null:Number(r.age)};
  },35,75),
  queryComponent('player-frames','Player feature frames',false,async()=>{
   const [r]=await sql`select count(*) filter(where observed_hour>now()-interval '72 hours')::int as rows,extract(epoch from (now()-max(observed_hour)))/60::float as age from player_feature_frames`;
   return {rows:Number(r?.rows||0),ageMinutes:r?.age===null?null:Number(r.age)};
  },1440,4320),
  queryComponent('player-calibration','Player calibration',false,async()=>{
   const [r]=await sql`select count(*)::int as rows,extract(epoch from (now()-max(updated_at)))/60::float as age from player_calibration_profiles`;
   return {rows:Number(r?.rows||0),ageMinutes:r?.age===null?null:Number(r.age)};
  },2880,10080),
  queryComponent('matchups','Opponent matchup learning',false,async()=>{
   const [r]=await sql`select count(*)::int as rows,extract(epoch from (now()-max(updated_at)))/60::float as age from opponent_matchup_profiles`;
   return {rows:Number(r?.rows||0),ageMinutes:r?.age===null?null:Number(r.age)};
  },2880,10080),
  queryComponent('redistribution','Lineup role redistribution',false,async()=>{
   const [r]=await sql`select count(*)::int as rows,extract(epoch from (now()-max(updated_at)))/60::float as age from lineup_redistribution_profiles`;
   return {rows:Number(r?.rows||0),ageMinutes:r?.age===null?null:Number(r.age)};
  },2880,10080),
  queryComponent('depth-charts','Starting lineups / depth charts',false,async()=>{
   const [r]=await sql`select count(*)::int as rows,extract(epoch from (now()-max(updated_at)))/60::float as age from depth_chart_profiles`;
   return {rows:Number(r?.rows||0),ageMinutes:r?.age===null?null:Number(r.age)};
  },2880,10080),
  queryComponent('schedule','Schedule / fatigue profiles',false,async()=>{
   const [r]=await sql`select count(*)::int as rows,extract(epoch from (now()-max(updated_at)))/60::float as age from schedule_fatigue_profiles`;
   return {rows:Number(r?.rows||0),ageMinutes:r?.age===null?null:Number(r.age)};
  },2880,10080),
  queryComponent('venue','Venue / condition profiles',false,async()=>{
   const [r]=await sql`select count(*)::int as rows,extract(epoch from (now()-max(updated_at)))/60::float as age from venue_condition_profiles`;
   return {rows:Number(r?.rows||0),ageMinutes:r?.age===null?null:Number(r.age)};
  },2880,10080),
  queryComponent('movement','Market movement profiles',false,async()=>{
   const [r]=await sql`select count(*)::int as rows,extract(epoch from (now()-max(updated_at)))/60::float as age from market_movement_profiles`;
   return {rows:Number(r?.rows||0),ageMinutes:r?.age===null?null:Number(r.age)};
  },2880,10080),
  queryComponent('optimizer','Cross-sport optimizer',false,async()=>{
   const [r]=await sql`select count(*) filter(where promoted)::int as rows,extract(epoch from (now()-max(updated_at)))/60::float as age from cross_sport_optimizer_profiles`;
   return {rows:Number(r?.rows||0),ageMinutes:r?.age===null?null:Number(r.age)};
  },2880,10080,{emptyState:'WARMING'})
 ]);
 const [automation,validation]=await Promise.all([
  getAutomationHealth(),
  getValidationLabStatus()
 ]);
 const injuryJob=automation.jobs.find(x=>x.jobName==='injuries');
 const automationComponent:IntelligenceComponent={
  id:'automation',label:'Intelligence automation',required:true,
  state:automation.failedCount||automation.staleCount?'FAILED':automation.pendingCount?'WARMING':'HEALTHY',
  rows:automation.healthyCount,ageMinutes:injuryJob?.ageHours===null||injuryJob?.ageHours===undefined?null:injuryJob.ageHours*60,
   detail:`${automation.healthyCount} healthy / ${automation.failedCount} failed / ${automation.staleCount} stale / ${automation.pendingCount} pending`
 };
 const validationComponent:IntelligenceComponent={
  id:'validation',label:'Out-of-sample validation',required:true,
  state:validation.latestRun?.status==='failed'?'FAILED':validation.latestRun?'HEALTHY':'WARMING',
  rows:Number(validation.report?.sampleSize||0),ageMinutes:null,
  detail:validation.latestRun?`latest ${validation.latestRun.status}; ${validation.report.evidence.promotionEligible} group(s) promotion-eligible`:'No durable validation run yet'
 };
 const all=[...components,automationComponent,validationComponent];
 const blockers=all.filter(x=>x.required&&(x.state==='FAILED'||x.state==='STALE')).map(x=>`${x.label}: ${x.state.toLowerCase()}`);
 const warnings=all.filter(x=>x.state==='DEGRADED'||x.state==='WARMING'||x.state==='UNAVAILABLE').map(x=>`${x.label}: ${x.state.toLowerCase()} (${x.detail})`);
 const score=all.reduce((s,x)=>s+stateScore(x.state),0)/Math.max(1,all.length);
 const required=all.filter(x=>x.required);
 const criticalCoverage=required.reduce((s,x)=>s+stateScore(x.state),0)/Math.max(1,required.length);
 const state:UnifiedIntelligenceCertification['state']=blockers.length?'BLOCKED':score>=.82&&warnings.length===0?'HEALTHY':'DEGRADED';
 return {
  state,score,criticalCoverage,blockers,warnings,components:all,
  release:{build:RELEASE.build,version:RELEASE.appVersion,modelVersion:RELEASE.modelVersion,migrationVersion:RELEASE.migrationVersion},
  environment,generatedAt:new Date().toISOString()
 };
}

export async function persistUnifiedIntelligenceCertification(report:UnifiedIntelligenceCertification){
 const sql=db();if(!sql)return {persisted:false,id:null};
 const [row]=await sql`
  insert into intelligence_stack_certifications(
   release_version,model_version,migration_version,environment,state,score,critical_coverage,blockers,warnings,components,metadata
  ) values(
   ${RELEASE.appVersion},${RELEASE.modelVersion},${RELEASE.migrationVersion},${report.environment},${report.state},
   ${report.score},${report.criticalCoverage},${sql.json(report.blockers)},${sql.json(report.warnings)},${sql.json(report.components as any)},
   ${sql.json({build:RELEASE.build})}
  ) returning id
 `;
 return {persisted:true,id:Number(row?.id||0)||null};
}

export async function latestUnifiedIntelligenceCertification(){
 const sql=db();if(!sql)return null;
 try{
  const [row]=await sql`
   select id,release_version as "releaseVersion",model_version as "modelVersion",migration_version as "migrationVersion",
    environment,state,score::float,critical_coverage::float as "criticalCoverage",blockers,warnings,components,observed_at as "observedAt"
   from intelligence_stack_certifications order by observed_at desc limit 1
  `;
  return row||null;
 }catch{return null}
}
