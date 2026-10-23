/**
 * Stage 2 all-sports verified value board. Pure aggregation of externally
 * audited signal evidence; never fabricates prices, models or approvals.
 */
import {evaluateIndependentBetEdge,type EdgeSignalInput} from './verified-value-engine';
export type BoardEntry={id:string;sport:string;league:string;eventName:string;signal:EdgeSignalInput};
const field=(s:unknown)=>typeof s==='string'&&s.trim().length>0;
const marketId=(entry:BoardEntry)=>JSON.stringify([
 entry.signal.quote.bookmaker.trim().toLowerCase(),
 entry.signal.quote.sourceUpstreamId.trim().toLowerCase(),
 entry.signal.quote.eventId,entry.signal.quote.marketType,
 entry.signal.quote.outcomeId,entry.signal.quote.line||'',entry.signal.quote.playerId||''
]);
export function buildVerifiedValueBoard(entries:BoardEntry[],now=Date.now(),limit=50){
 if(!Array.isArray(entries)||entries.length>5000||!Number.isSafeInteger(limit)||limit<1||limit>500||
  !Number.isFinite(now))throw Error('INVALID_VALUE_BOARD_INPUT');
 const eligible:Array<{id:string;sport:string;league:string;eventName:string;bookmaker:string;
  eventId:string;marketType:string;outcomeId:string;americanOdds:number;quoteObservedAt:string;
  startsAt:string;modelId:string;modelVersion:string;calibrationSampleSize:number;
  breakEvenProbability:number;estimatedProbability:number;edgePercentagePoints:number;
  expectedRoiPercent:number;suggestedBankrollFraction:number;
  playerId?:string;line?:string}>=[];
 const blockers:Record<string,number>={};
 let noPositiveEdge=0,invalid=0,duplicates=0;
 const seen=new Set<string>();
 for(const entry of entries){
  if(!entry||![entry.id,entry.sport,entry.league,entry.eventName].every(field)||!entry.signal?.quote){
   invalid++;continue;
  }
  const quote=entry.signal.quote;
  // Do not collapse competing offers from distinct bookmaker/upstream pairs.
  const key=marketId(entry);
  if(seen.has(key)){duplicates++;continue}
  seen.add(key);
  let result:ReturnType<typeof evaluateIndependentBetEdge>;
  try{result=evaluateIndependentBetEdge(entry.signal,now);}
  catch{invalid++;continue}
  if(result.status==='BLOCKED'){
   for(const reason of result.reasons)blockers[reason]=(blockers[reason]||0)+1;
   continue;
  }
  if(!result.eligible){noPositiveEdge++;continue}
  eligible.push({id:entry.id,sport:entry.sport,league:entry.league,eventName:entry.eventName,
   bookmaker:quote.bookmaker,eventId:quote.eventId,marketType:quote.marketType,
   outcomeId:quote.outcomeId,americanOdds:quote.americanOdds,quoteObservedAt:quote.observedAt,
   startsAt:quote.startsAt,modelId:result.modelId!,modelVersion:result.modelVersion!,
   calibrationSampleSize:result.calibrationSampleSize!,
   breakEvenProbability:result.breakEvenProbability!,
   estimatedProbability:result.estimatedProbability!,
   edgePercentagePoints:result.edgePercentagePoints!,
   expectedRoiPercent:result.expectedRoiPercent!,
   suggestedBankrollFraction:result.suggestedBankrollFraction!,
   ...(quote.playerId?{playerId:quote.playerId}:{}),...(quote.line?{line:quote.line}:{})});
 }
 // Highest independently estimated win probability first; ROI breaks ties,
 // preserving the user's stated sorting policy without hiding EV.
 eligible.sort((a,b)=>b.estimatedProbability-a.estimatedProbability||
  b.expectedRoiPercent-a.expectedRoiPercent||a.id.localeCompare(b.id));
 const top=eligible.slice(0,limit);
 return {mode:'AUDITED_INPUT_VALUE_BOARD' as const,asOf:new Date(now).toISOString(),
  evaluated:entries.length,uniqueMarkets:seen.size,duplicateMarkets:duplicates,
  invalidCandidates:invalid,blockedReasons:blockers,nonPositiveEdge:noPositiveEdge,
  eligibleCount:eligible.length,displayedCount:top.length,
  truncated:eligible.length>limit,rows:top,releaseCertified:false,
  warning:'Inputs must come from trusted model and quote verification services, not caller assertions. Empty boards are valid; betting profits are never guaranteed.'};
}
