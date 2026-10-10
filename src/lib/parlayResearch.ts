import type {Scanned} from './scanner';

export type ParlayResearchLeg=Scanned;
export type ParlayGate={eligible:boolean;reasons:string[];score:number};
export type ParlayStrategy='BALANCED'|'HIGH_PROBABILITY'|'VALUE'|'UPSIDE';

const validOdds=(odds:number)=>Number.isFinite(odds)&&Math.abs(odds)>=100;
const safe=(v:number)=>Number.isFinite(v)?v:0;
const lower=(s:string)=>s.trim().toLowerCase().replace(/\s+/g,' ');
const eventKey=(row:Scanned)=>[lower(row.sport),lower(row.event),row.startTime].join('|');

export function assessResearchLeg(row:Scanned,nowMs=Date.now()):ParlayGate{
 const reasons:string[]=[];
 if(row.grade!=='ELITE'&&row.grade!=='STRONG')reasons.push('Model has not passed strict grade');
 if(row.freshness!=='FRESH'||!Number.isFinite(row.sourceAgeMin)||row.sourceAgeMin>5)reasons.push('Price is aging or stale');
 if(!validOdds(row.odds))reasons.push('Offered American odds are invalid');
 if(!Number.isFinite(row.simProbability)||row.simProbability<=0||row.simProbability>=1)reasons.push('Invalid projected probability');
 if(!Number.isFinite(row.dynamicConfidence)||row.dynamicConfidence<.60)reasons.push('Low model confidence');
 if(row.reliabilityMode&&row.reliabilityMode!=='NORMAL'||row.reliabilityCriticalOpen)reasons.push('Reliability guard active');
 if(row.contextQuality?.recommendationReady===false)reasons.push('Injury, lineup or context check incomplete');
 if(row.intelligenceStackReady===false)reasons.push('Incomplete model inputs');
 if((row.consensus?.bookCount??0)<2)reasons.push('Independent bookmaker coverage is insufficient');
 if(!Number.isFinite(Date.parse(row.startTime))||Date.parse(row.startTime)<=nowMs)reasons.push('Event has started or time is invalid');
 const confidence=safe(row.dynamicConfidence);
 const expectedValue=safe(row.expectedValue);
 const score=Math.round(Math.max(0,Math.min(100,
  confidence*35+Math.max(0,Math.min(.20,expectedValue))/.20*35+
  Math.max(0,Math.min(1,safe(row.simProbability)))*20+
  Math.min(10,Math.max(0,(row.consensus?.bookCount??0)-1)*3)
  )));
 return {eligible:reasons.length===0,score,reasons};
}
export function analyzeParlayConflicts(legs:readonly Scanned[]):string[]{
 const issues:string[]=[];
 const ids=new Set<string>();
 for(const leg of legs){
  if(ids.has(leg.id))issues.push('Duplicate selection in the slip');
  ids.add(leg.id);
 }
 for(let i=0;i<legs.length;i++){
  for(let j=i+1;j<legs.length;j++){
   const a=legs[i],b=legs[j];
   if(eventKey(a)!==eventKey(b))continue;
   const marketA=lower(a.market),marketB=lower(b.market);
   const propA=Boolean(a.playerContext?.name),propB=Boolean(b.playerContext?.name);
   if(!propA&&!propB&&marketA===marketB&&lower(a.selection)!==lower(b.selection)){
    issues.push('Conflicting/overlapping selections in the same game market: verify mutual exclusivity');
   }
   if(propA&&propB&&lower(a.playerContext?.name||'')===lower(b.playerContext?.name||'')&&
    marketA===marketB&&lower(a.selection)!==lower(b.selection)){
    issues.push('Same-player, same-stat overlapping lines require settlement validation');
   }
  }
 }
 return [...new Set(issues)];
}
export function rankResearchPool(rows:readonly Scanned[],strategy:ParlayStrategy='BALANCED',nowMs=Date.now()){
 return rows.map(row=>({row,gate:assessResearchLeg(row,nowMs)}))
  .sort((a,b)=>{
   if(a.gate.eligible!==b.gate.eligible)return a.gate.eligible?-1:1;
   const s=(x:typeof a)=>{
    const prob=safe(x.row.simProbability);
    const ev=Math.max(-1,Math.min(1,safe(x.row.expectedValue)));
    return strategy==='HIGH_PROBABILITY'?prob*80+x.gate.score*.20:
      strategy==='VALUE'?ev*80+x.gate.score*.25:
      strategy==='UPSIDE'?Math.max(0,safe(x.row.odds))*0.005+ev*24+x.gate.score*.48:
      x.gate.score;
   };
   return s(b)-s(a)||a.row.id.localeCompare(b.row.id);
  });
}
