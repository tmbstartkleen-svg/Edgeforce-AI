import type {PositiveEvOpportunity} from './edgeScanner';
import {calculateEdgeValue} from './edgeValue';

export type RankedValueBet = {
  rank:number;
  sport:string;
  league:string;
  event:string;
  market:string;
  selection:string;
  startTime:string;
  book:string;
  odds:number;
  modelWinPercent:number;
  breakEvenPercent:number;
  edgePp:number;
  expectedRoiPercent:number;
  expectedProfitOn100:number;
  reference:string;
  referenceBooks:string[];
  evidenceStatus:'MARKET_REFERENCE_ONLY';
  eligibleForVerifiedAlert:false;
};

/**
 * Combines all sports into one value-first board. Scanner reference probabilities
 * are market-derived, NOT independently calibrated model predictions.
 * Treat every row as provisional until source independence and freshness pass.
 */
export function rankValueBets(
  opportunities:PositiveEvOpportunity[],
  options:{maxRows?:number;minEdgePp?:number;minExpectedRoiPercent?:number}={}
):RankedValueBet[]{
  const cap=Math.max(1,Math.min(10000,Math.floor(options.maxRows??1000)));
  const minEdge=options.minEdgePp??0;
  const minRoi=options.minExpectedRoiPercent??0;
  if(!Number.isFinite(minEdge)||!Number.isFinite(minRoi))throw new RangeError('Invalid filter');
  const ranked=opportunities.flatMap(op=>{
    try {
      const v=calculateEdgeValue(op.odds,op.fairProbability);
      if(v.probabilityEdgePp<=minEdge||v.expectedRoiPercent<=minRoi)return [];
      return [{
        rank:0,
        sport:op.sport,
        league:op.league,
        event:op.event,
        market:op.market,
        selection:op.selection,
        startTime:op.startTime,
        book:op.book,
        odds:op.odds,
        modelWinPercent:v.modelProbability*100,
        breakEvenPercent:v.breakEvenProbability*100,
        edgePp:v.probabilityEdgePp,
        expectedRoiPercent:v.expectedRoiPercent,
        expectedProfitOn100:v.expectedProfitPerDollarStaked*100,
        reference:op.reference,
        referenceBooks:op.referenceBooks,
        evidenceStatus:'MARKET_REFERENCE_ONLY' as const,
        eligibleForVerifiedAlert:false as const,
      }];
    }catch{return [];}
  });
  ranked.sort((a,b)=>
    b.expectedRoiPercent-a.expectedRoiPercent ||
    b.edgePp-a.edgePp ||
    a.startTime.localeCompare(b.startTime) ||
    a.event.localeCompare(b.event)
  );
  return ranked.slice(0,cap).map((item,i)=>({...item,rank:i+1}));
}
