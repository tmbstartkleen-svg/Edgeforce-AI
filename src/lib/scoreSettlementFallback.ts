import {db} from './db';
import {fetchLiveScoreMesh} from './liveScoreMesh';

export type ScoreSettlementRow={
 eventId:string;
 marketKey:string;
 selectionKey:string;
 result:'win'|'loss'|'push';
 settledAt:string;
};

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
}>{
 const sql=db();
 if(!sql)return {rows:[],matchedGames:0,candidateLegs:0,warnings:['Database unavailable for final-score settlement fallback']};

 const legs=await sql`
  select bl.event_id as "eventId",bl.event_label as "eventLabel",bl.market_type as "marketType",bl.selection
  from bet_legs bl
  join bet_slips bs on bs.id=bl.bet_slip_id
  where bs.result='open' and bl.result='unknown'
   and bl.event_id is not null and bl.event_label is not null
 `;
 if(!(legs as any[]).length)return {rows:[],matchedGames:0,candidateLegs:0,warnings:[]};

 const mesh=await fetchLiveScoreMesh();
 const finals=(mesh.games||[]).filter((g:any)=>
  g?.status==='FINAL'&&typeof g?.home?.score==='number'&&typeof g?.away?.score==='number'
 );
 const byLabel=new Map<string,any[]>();
 for(const g of finals){
  const label=canon(`${g.away.name} @ ${g.home.name}`);
  const list=byLabel.get(label)||[];
  list.push(g);
  byLabel.set(label,list);
 }

 const rows:ScoreSettlementRow[]=[];
 let matchedGames=0;
 const warnings:string[]=[];
 for(const leg of legs as any[]){
  const matches=byLabel.get(canon(String(leg.eventLabel)))||[];
  if(matches.length!==1){
   if(matches.length>1)warnings.push(`Ambiguous final scoreboard match for ${String(leg.eventLabel)}`);
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
  rows.push({
   eventId:String(leg.eventId),
   marketKey:String(leg.marketType||''),
   selectionKey:String(leg.selection||''),
   result,
   settledAt:String(g.observedAt||new Date().toISOString())
  });
 }
 return {
  available:true,
  rows,
  matchedGames,
  candidateLegs:(legs as any[]).length,
  warnings:[...new Set(warnings)].slice(0,20)
 };
}