import {evaluateValueBet} from './firstPartyMarketMath';

/** Transparent ranking of supplied research candidates, never a source of live odds or predictions. */
export type RankedResearchCandidate={
 id:string;sport:string;league:string;eventId:string;marketType:string;outcomeId:string;
 bookmaker:string;americanOdds:number;quoteObservedAt:string;
 startsAt:string;modelProbability:number;modelId:string;modelEvidenceRef:string;
 upstreamOwner:string;playerId?:string;line?:string;
};
export type RankedResearchResult={
 id:string;sport:string;league:string;eventId:string;marketType:string;outcomeId:string;
 bookmaker:string;breakEvenProbability:number|null;modelProbability:number|null;
 edgeProbabilityPoints:number|null;grossExpectedRoi:number|null;
 status:'RESEARCH_ONLY';reasons:string[];
};
/**
 * Research board sorts independently supplied model signals by gross expected ROI,
 * but NEVER promotes uncorroborated prices or self-described model IDs to verified picks.
 */
export function rankResearchCandidates(candidates:RankedResearchCandidate[],nowIso:string,limit=50){
 if(!Array.isArray(candidates)||candidates.length>5000)throw Error('INVALID_CANDIDATE_BATCH');
 if(!Number.isSafeInteger(limit)||limit<1||limit>500)throw Error('INVALID_RANK_LIMIT');
 const now=Date.parse(nowIso);
 if(!Number.isFinite(now))throw Error('INVALID_NOW');
 const seen=new Set<string>();
 const results:RankedResearchResult[]=[];
 for(const c of candidates){
  if(!c||typeof c.id!=='string'||!c.id.trim())continue;
  const key=JSON.stringify([c.bookmaker,c.eventId,c.marketType,c.outcomeId,c.playerId||'',c.line||'']);
  if(seen.has(key))continue;
  seen.add(key);
  const r=evaluateValueBet({americanOdds:c.americanOdds,modelProbability:c.modelProbability,
   observedAt:c.quoteObservedAt,nowIso,bankroll:0,maxAgeMs:60000});
  const reasons=[...r.reasons];
  if(![c.sport,c.league,c.eventId,c.marketType,c.outcomeId,c.bookmaker,c.modelId,c.modelEvidenceRef,c.upstreamOwner,c.startsAt]
    .every(s=>typeof s==='string'&&s.trim().length>0))reasons.push('MISSING_PROVENANCE');
  const starts=Date.parse(c.startsAt);
  if(!Number.isFinite(starts)||starts<=now)reasons.push('EVENT_STARTED_OR_INVALID');
  // Independent model history and executable price cannot be authenticated from
  // caller-supplied labels alone. A separate certification service must verify them.
  reasons.push('MODEL_AND_EXECUTION_UNCERTIFIED');
  results.push({id:c.id,sport:c.sport,league:c.league,eventId:c.eventId,marketType:c.marketType,
   outcomeId:c.outcomeId,bookmaker:c.bookmaker,breakEvenProbability:r.breakEvenProbability,
   modelProbability:r.modelProbability,edgeProbabilityPoints:r.edgeProbabilityPoints,
   grossExpectedRoi:r.grossExpectedRoi,status:'RESEARCH_ONLY',reasons});
 }
 return results.sort((a,b)=>(b.grossExpectedRoi??-Infinity)-(a.grossExpectedRoi??-Infinity)||a.id.localeCompare(b.id)).slice(0,limit);
}
