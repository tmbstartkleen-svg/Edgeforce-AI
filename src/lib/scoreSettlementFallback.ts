import {db} from './db';
import {fetchLiveScoreMesh} from './liveScoreMesh';

export type SettlementProvenance={
 schemaVersion:'v151-settlement-provenance-1';
 evidenceClass:'PROVIDER_NATIVE'|'CORROBORATED_SCORE'|'TRUSTED_PRIMARY_SINGLE';
 source:string;
 confidence:'HIGH'|'MEDIUM'|'LOW'|'SINGLE_SOURCE'|'UNKNOWN'|'PROVIDER_NATIVE';
 sourceCount:number;
 agreeingSources:number;
 reason:string;
 observedAt:string;
 finalScore?:{
  homeTeam:string;
  awayTeam:string;
  homeScore:number;
  awayScore:number;
 };
};
export type ScoreSettlementRow={
 eventId:string;
 marketKey:string;
 selectionKey:string;
 result:'win'|'loss'|'push';
 settledAt:string;
 settlementProvenance:SettlementProvenance;
};

export type SettlementEvidenceDecision={
 accepted:boolean;
 reason:string;
 source:string;
 confidence:'HIGH'|'MEDIUM'|'LOW'|'SINGLE_SOURCE'|'UNKNOWN';
 sourceCount:number;
 agreeingSources:number;
 activeConflict:boolean;
 trustedSingleSource:boolean;
};

type SettlementGame={
 status?:string;
 source?:string;
 home?:{name?:string;score?:number|null};
 away?:{name?:string;score?:number|null};
 consensus?:{
  confidence?:'HIGH'|'MEDIUM'|'LOW'|'SINGLE_SOURCE';
  sourceCount?:number;
  agreeingSources?:number;
  activeConflict?:boolean;
  statusConflict?:boolean;
  scoreConflict?:boolean;
  laggingSources?:string[];
 };
};

const TRUSTED_FINAL_SCORE_SOURCES=new Set(['nhl-web','mlb-statsapi','espn-cdn','espn-public']);

export function evaluateFinalScoreSettlementEvidence(game:SettlementGame):SettlementEvidenceDecision{
 const source=String(game.source||'unknown');
 const consensus=game.consensus;
 const confidence=consensus?.confidence||'UNKNOWN';
 const sourceCount=Math.max(1,Number(consensus?.sourceCount||1));
 const agreeingSources=Math.max(0,Number(consensus?.agreeingSources||0));
 const activeConflict=Boolean(consensus?.activeConflict||consensus?.statusConflict);
 const scoresKnown=typeof game.home?.score==='number'&&typeof game.away?.score==='number';

 if(String(game.status||'').toUpperCase()!=='FINAL'){
  return {accepted:false,reason:'game is not final',source,confidence,sourceCount,agreeingSources,activeConflict,trustedSingleSource:false};
 }
 if(!scoresKnown){
  return {accepted:false,reason:'final score is incomplete',source,confidence,sourceCount,agreeingSources,activeConflict,trustedSingleSource:false};
 }
 if(activeConflict){
  return {accepted:false,reason:'contemporaneous score or status conflict is unresolved',source,confidence,sourceCount,agreeingSources,activeConflict:true,trustedSingleSource:false};
 }
 if(confidence==='LOW'){
  return {accepted:false,reason:'cross-source confidence is low',source,confidence,sourceCount,agreeingSources,activeConflict:false,trustedSingleSource:false};
 }
 if(confidence==='HIGH'||confidence==='MEDIUM'){
  return {accepted:true,reason:confidence==='HIGH'?'cross-source final score is corroborated':'cross-source final score passed bounded consensus',source,confidence,sourceCount,agreeingSources,activeConflict:false,trustedSingleSource:false};
 }
 const trustedSingleSource=TRUSTED_FINAL_SCORE_SOURCES.has(source);
 if(trustedSingleSource){
  return {accepted:true,reason:'trusted primary final-score source accepted without contradictory evidence',source,confidence:confidence==='UNKNOWN'?'SINGLE_SOURCE':confidence,sourceCount,agreeingSources,activeConflict:false,trustedSingleSource:true};
 }
 return {accepted:false,reason:'single-source final score is not from an approved primary provider',source,confidence:confidence==='UNKNOWN'?'SINGLE_SOURCE':confidence,sourceCount,agreeingSources,activeConflict:false,trustedSingleSource:false};
}

const canon=(v:string)=>v.toLowerCase().replace(/[^a-z0-9@.+-]+/g,' ').replace(/\s+/g,' ').trim();
const compare=(a:number,b:number):'win'|'loss'|'push'=>a>b?'win':a<b?'loss':'push';
const pointFrom=(selection:string)=>{
 const m=selection.trim().match(/([+-]?\d+(?:\.\d+)?)$/);
 return m?Number(m[1]):null;
};
const teamFrom=(selection:string)=>selection.replace(/\s+[+-]?\d+(?:\.\d+)?$/,'').trim();

export function gradeScoreLeg(
 marketType:string,
 selection:string,
 home:string,
 away:string,
 homeScore:number,
 awayScore:number
):'win'|'loss'|'push'|null{
 const market=marketType.toLowerCase();
 const sel=selection.trim();
 if(/h2h|moneyline|money line|winner/.test(market)){
  if(canon(sel)===canon(home))return compare(homeScore,awayScore);
  if(canon(sel)===canon(away))return compare(awayScore,homeScore);
  return null;
 }
 if(/spread|handicap|run line|puck line/.test(market)){
  const point=pointFrom(sel);
  if(point===null)return null;
  const team=teamFrom(sel);
  if(canon(team)===canon(home))return compare(homeScore+point,awayScore);
  if(canon(team)===canon(away))return compare(awayScore+point,homeScore);
  return null;
 }
 if(/total|over.?under|o\/u/.test(market)){
  const point=pointFrom(sel);
  if(point===null)return null;
  const total=homeScore+awayScore;
  if(/^over\b/i.test(sel))return compare(total,point);
  if(/^under\b/i.test(sel))return compare(point,total);
  return null;
 }
 return null;
}

export async function finalScoreSettlementRows():Promise<{
 available:boolean;
 rows:ScoreSettlementRow[];
 matchedGames:number;
 candidateLegs:number;
 warnings:string[];
 evidence:{
  totalFinalGames:number;
  acceptedFinalGames:number;
  blockedFinalGames:number;
  highConfidence:number;
  mediumConfidence:number;
  trustedSingleSource:number;
  blockedConflict:number;
  blockedLowConfidence:number;
  blockedSingleSource:number;
 };
}>{
 const emptyEvidence={totalFinalGames:0,acceptedFinalGames:0,blockedFinalGames:0,highConfidence:0,mediumConfidence:0,trustedSingleSource:0,blockedConflict:0,blockedLowConfidence:0,blockedSingleSource:0};
 const sql=db();
 if(!sql)return {available:false,rows:[],matchedGames:0,candidateLegs:0,warnings:['Database unavailable for final-score settlement fallback'],evidence:emptyEvidence};

 const legs=await sql`
  select
   bl.event_id as "eventId",
   bl.event_label as "eventLabel",
   bl.sport,
   bl.market_type as "marketType",
   bl.selection,
   nullif(e.provider_event_id,'') as "sourceEventId"
  from bet_legs bl
  join bet_slips bs on bs.id=bl.bet_slip_id
  left join events e on e.id=bl.event_id
  where bs.result='open' and bl.result='unknown'
   and bl.event_id is not null and bl.event_label is not null
 `;
 if(!(legs as any[]).length)return {available:true,rows:[],matchedGames:0,candidateLegs:0,warnings:[],evidence:emptyEvidence};

 const mesh=await fetchLiveScoreMesh();
 const allFinals=(mesh.games||[]).filter((g:any)=>g?.status==='FINAL');
 const evidenceDecisions=allFinals.map((game:any)=>({game,decision:evaluateFinalScoreSettlementEvidence(game)}));
 const accepted=evidenceDecisions.filter(x=>x.decision.accepted);
 const blocked=evidenceDecisions.filter(x=>!x.decision.accepted);
 const evidence={
  totalFinalGames:allFinals.length,
  acceptedFinalGames:accepted.length,
  blockedFinalGames:blocked.length,
  highConfidence:accepted.filter(x=>x.decision.confidence==='HIGH').length,
  mediumConfidence:accepted.filter(x=>x.decision.confidence==='MEDIUM').length,
  trustedSingleSource:accepted.filter(x=>x.decision.trustedSingleSource).length,
  blockedConflict:blocked.filter(x=>x.decision.activeConflict).length,
  blockedLowConfidence:blocked.filter(x=>x.decision.confidence==='LOW').length,
  blockedSingleSource:blocked.filter(x=>x.decision.confidence==='SINGLE_SOURCE'&&!x.decision.trustedSingleSource).length
 };
 const finals=accepted.map(x=>x.game);
 const bySourceId=new Map<string,any[]>();
 const byLabel=new Map<string,any[]>();
 const sourceKey=(sport:string,id:string)=>[canon(sport),String(id).trim().toLowerCase()].join('|');
 for(const g of finals){
  if(g.id){
   for(const sport of [String(g.sport||''),String(g.league||'')].filter(Boolean)){
    const key=sourceKey(sport,String(g.id));
    const list=bySourceId.get(key)||[];
    list.push(g);
    bySourceId.set(key,list);
   }
  }
  const label=canon(`${g.away.name} @ ${g.home.name}`);
  const list=byLabel.get(label)||[];
  list.push(g);
  byLabel.set(label,list);
 }

 const rows:ScoreSettlementRow[]=[];
 let matchedGames=0;
 const warnings:string[]=blocked.slice(0,12).map(({game,decision}:any)=>`Blocked final-score settlement for ${String(game?.away?.name||'Away')} @ ${String(game?.home?.name||'Home')}: ${decision.reason}`);
 for(const leg of legs as any[]){
  const exact=leg.sourceEventId
   ?bySourceId.get(sourceKey(String(leg.sport||''),String(leg.sourceEventId)))||[]
   :[];
  const labelMatches=byLabel.get(canon(String(leg.eventLabel)))||[];
  const matches=exact.length===1?exact:labelMatches;
  if(matches.length!==1){
   if(exact.length>1)warnings.push(`Ambiguous source event id match for ${String(leg.sourceEventId)} (${String(leg.sport||'Unknown')})`);
   else if(labelMatches.length>1)warnings.push(`Ambiguous final scoreboard match for ${String(leg.eventLabel)}`);
   continue;
  }
  const g=matches[0];
  const result=gradeScoreLeg(
   String(leg.marketType||''),
   String(leg.selection||''),
   String(g.home.name),
   String(g.away.name),
   Number(g.home.score),
   Number(g.away.score)
  );
  if(!result)continue;
  matchedGames++;
  const decision=evaluateFinalScoreSettlementEvidence(g);
  rows.push({
   eventId:String(leg.eventId),
   marketKey:String(leg.marketType||''),
   selectionKey:String(leg.selection||''),
   result,
   settledAt:String(g.observedAt||new Date().toISOString()),
   settlementProvenance:{
    schemaVersion:'v151-settlement-provenance-1',
    evidenceClass:decision.trustedSingleSource?'TRUSTED_PRIMARY_SINGLE':'CORROBORATED_SCORE',
    source:decision.source,
    confidence:decision.confidence,
    sourceCount:decision.sourceCount,
    agreeingSources:decision.agreeingSources,
    reason:exact.length===1?`${decision.reason}; exact provider event identity matched`:decision.reason,
    observedAt:String(g.observedAt||new Date().toISOString()),
    finalScore:{
     homeTeam:String(g.home.name),
     awayTeam:String(g.away.name),
     homeScore:Number(g.home.score),
     awayScore:Number(g.away.score)
    }
   }
  });
 }
 return {
  available:true,
  rows,
  matchedGames,
  candidateLegs:(legs as any[]).length,
  warnings:[...new Set(warnings)].slice(0,20),
  evidence
 };
}