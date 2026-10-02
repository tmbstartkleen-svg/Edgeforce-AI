import type {Scanned} from './scanner';
import {summarizeParlay,type Parlay} from './parlays';
import type {WeeklyDraftLeg} from './weeklyBuilder';

export type ReplacementCandidate={
  targetMarketId:string;
  targetSelection:string;
  candidateMarketId:string;
  candidateSelection:string;
  candidateSport:string;
  candidateEvent:string;
  candidateMarket:string;
  candidateOdds:number;
  candidateSimulationProbability:number;
  candidateEdge:number;
  originalTargetProbability:number;
  currentTargetProbability:number;
  currentParlayJointProbability:number|null;
  replacementParlayJointProbability:number|null;
  jointProbabilityDelta:number|null;
  replacementJointHits:number|null;
  replacementJointRuns:number|null;
  jointMode:'shared-monte-carlo'|'estimated'|'unavailable';
  correlationDelta:number|null;
  score:number;
  reasons:string[];
};

export type ReplacementGroup={
  target:WeeklyDraftLeg;
  currentParlayJointProbability:number|null;
  currentJointMode:'shared-monte-carlo'|'estimated'|'unavailable';
  candidates:ReplacementCandidate[];
  missingCurrentLegs:string[];
};

const eventKey=(x:Scanned)=>x.eventId||x.event;
const day=(x:Scanned)=>new Date(x.startTime).toISOString().slice(0,10);

function candidateAllowed(candidate:Scanned,target:WeeklyDraftLeg,otherRows:Scanned[]){
  if(candidate.id===target.marketId)return false;
  if(candidate.simulationMode==='probability-fallback'||candidate.simProbability<.65||candidate.grade==='PASS')return false;
  if(new Date(candidate.startTime).getTime()<=Date.now())return false;
  if(otherRows.some(x=>x.id===candidate.id))return false;

  // Avoid duplicating the same market/selection already present in the weekly ticket.
  if(otherRows.some(x=>(x.marketKey||x.market)===(candidate.marketKey||candidate.market)&&x.selection===candidate.selection))return false;

  // For the weekly stretched builder prefer preserving day diversity where possible.
  const candidateDay=day(candidate);
  if(otherRows.some(x=>day(x)===candidateDay))return false;
  return true;
}

function evaluate(picks:Scanned[],hitVectors:Map<string,Uint8Array>,label:string):Parlay|null{
  if(picks.length<2)return null;
  return summarizeParlay(picks,label,hitVectors);
}

export function buildReplacementComparisons(
  weeklyLegs:WeeklyDraftLeg[],
  rows:Scanned[],
  hitVectors:Map<string,Uint8Array>,
  maxPerTarget=8
):ReplacementGroup[]{
  const rowMap=new Map(rows.map(x=>[x.id,x]));
  const groups:ReplacementGroup[]=[];

  for(const target of weeklyLegs.filter(x=>x.decisionStatus!=='KEEP')){
    const otherLegs=weeklyLegs.filter(x=>x.marketId!==target.marketId);
    const otherRows=otherLegs.map(x=>rowMap.get(x.marketId)).filter((x):x is Scanned=>Boolean(x));
    const missingCurrentLegs=otherLegs.filter(x=>!rowMap.has(x.marketId)).map(x=>x.selection);
    const currentTarget=rowMap.get(target.marketId);
    const currentPicks=currentTarget?[...otherRows,currentTarget]:[];
    const currentSummary=missingCurrentLegs.length===0?evaluate(currentPicks,hitVectors,'CURRENT WEEKLY TICKET'):null;
    const currentJoint=currentSummary?.combinedProbability??null;

    const pool=rows
      .filter(x=>candidateAllowed(x,target,otherRows))
      .sort((a,b)=>b.simProbability-a.simProbability||b.edge-a.edge)
      .slice(0,100);

    const candidates:ReplacementCandidate[]=[];
    for(const candidate of pool){
      const replacementPicks=[...otherRows,candidate];
      const replacementSummary=missingCurrentLegs.length===0?evaluate(replacementPicks,hitVectors,'REPLACEMENT WEEKLY TICKET'):null;
      const replacementJoint=replacementSummary?.combinedProbability??null;
      const delta=currentJoint!==null&&replacementJoint!==null?replacementJoint-currentJoint:null;
      const reasons:string[]=[];
      if(candidate.simProbability>=.70)reasons.push('Candidate simulation is 70%+');
      if(candidate.simProbability>target.currentSimProbability)reasons.push('Candidate simulation exceeds the current target leg');
      if(delta!==null&&delta>0)reasons.push('Improves full-ticket joint probability');
      if(candidate.edge>0)reasons.push('Positive model edge versus current book price');
      if(replacementSummary?.jointMode==='shared-monte-carlo')reasons.push('Full-ticket comparison uses shared 10,000-run outcomes');

      const jointComponent=replacementJoint??candidate.simProbability;
      const deltaComponent=delta??0;
      const score=jointComponent*.55+candidate.simProbability*.25+Math.max(-.10,Math.min(.15,candidate.edge))*.12+Math.max(-.10,Math.min(.10,deltaComponent))*.08;
      candidates.push({
        targetMarketId:target.marketId,targetSelection:target.selection,
        candidateMarketId:candidate.id,candidateSelection:candidate.selection,candidateSport:candidate.sport,candidateEvent:candidate.event,
        candidateMarket:candidate.market,candidateOdds:candidate.odds,candidateSimulationProbability:candidate.simProbability,candidateEdge:candidate.edge,
        originalTargetProbability:target.originalSimProbability,currentTargetProbability:target.currentSimProbability,
        currentParlayJointProbability:currentJoint,replacementParlayJointProbability:replacementJoint,jointProbabilityDelta:delta,
        replacementJointHits:replacementSummary?.jointHits??null,replacementJointRuns:replacementSummary?.jointRuns??null,
        jointMode:replacementSummary?.jointMode??'unavailable',correlationDelta:replacementSummary?.correlationDelta??null,
        score,reasons
      });
    }

    candidates.sort((a,b)=>{
      const aj=a.replacementParlayJointProbability??-1,bj=b.replacementParlayJointProbability??-1;
      return bj-aj||b.candidateSimulationProbability-a.candidateSimulationProbability||b.candidateEdge-a.candidateEdge;
    });

    groups.push({
      target,
      currentParlayJointProbability:currentJoint,
      currentJointMode:currentSummary?.jointMode??'unavailable',
      candidates:candidates.slice(0,maxPerTarget),
      missingCurrentLegs
    });
  }

  return groups;
}
