/**
 * Research-only cross-provider all-sports board.
 * Match market-specific source quotes to a supplied model forecast and
 * calculate EV only after actual comparable prices are found.
 * This module is NOT a certification authority for upstream ownership,
 * provider entitlement or held-out model calibration.
 */
import {analyzeIndependentQuoteAgreement,type SourceQuote} from './independent-quote-agreement';
import {americanBreakEven,type ProbabilityEvidence} from './verified-value-engine';
export type CorroboratedResearchInput={
 id:string;sport:string;league:string;eventName:string;primary:SourceQuote;
 competitors:SourceQuote[];forecast:ProbabilityEvidence;
};
const same=(a:SourceQuote,b:SourceQuote)=>[
 a.bookmaker.toLowerCase(),a.eventId,a.marketType,a.outcomeId,a.line??'',a.playerId??''
 ].every((v,i)=>v===[
 b.bookmaker.toLowerCase(),b.eventId,b.marketType,b.outcomeId,b.line??'',b.playerId??''
 ][i]);
export function buildCorroboratedResearchBoard(items:CorroboratedResearchInput[],
 now=Date.now(),limit=50){
 if(!Array.isArray(items)||items.length>500||!Number.isFinite(now)||
  !Number.isSafeInteger(limit)||limit<1||limit>100)throw Error('INVALID_RESEARCH_BOARD_INPUT');
 const rows: Array<{id:string;sport:string;league:string;eventName:string;
  marketType:string;bookmaker:string;americanOdds:number;outcomeId:string;
  modelId:string;probability:number;breakEvenProbability:number;
  edgePercentagePoints:number;expectedRoiPercent:number;
  independentUpstreamCount:number;priceSpreadPoints:number;
  status:'RESEARCH_ONLY';reasons:string[]}>=[];
 const blocked:Record<string,number>={};
 const note=(k:string)=>{blocked[k]=(blocked[k]||0)+1};
 for(const item of items){
  if(!item||!item.primary||!Array.isArray(item.competitors)||item.competitors.length>20||
    !item.forecast||![item.id,item.sport,item.league,item.eventName].every(x=>typeof x==='string'&&x.trim())){
   note('INVALID_RESEARCH_ENTRY');continue;
  }
  const {primary,forecast}=item;
  const quotes=[primary,...item.competitors.filter(q=>q&&same(primary,q))];
  const agreement=analyzeIndependentQuoteAgreement(quotes,now);
  const key=JSON.stringify([primary.eventId.trim().toLowerCase(),primary.marketType.trim().toLowerCase(),
   primary.outcomeId.trim().toLowerCase(),primary.line?.trim().toLowerCase()||'',
   primary.playerId?.trim().toLowerCase()||'',primary.bookmaker.trim().toLowerCase()]);
  const comparison=agreement.comparisons.find(c=>c.identity===key&&c.priceAgreement);
  if(!comparison){note('NO_COMPARABLE_INDEPENDENT_PRICE');continue}
  const p=forecast.probability;
  if(typeof p!=='number'||!Number.isFinite(p)||p<=0||p>=1||
   typeof forecast.modelId!=='string'||!forecast.modelId.trim()||
   !forecast.independentlyDerived||!forecast.calibrated||
   !Number.isSafeInteger(forecast.sampleSize)||forecast.sampleSize<100||
   typeof forecast.calibrationMeanAbsoluteError!=='number'||
   forecast.calibrationMeanAbsoluteError>0.1||forecast.calibrationMeanAbsoluteError<0||
   !Number.isFinite(Date.parse(forecast.asOf))||Date.parse(forecast.asOf)>now||
   now-Date.parse(forecast.asOf)>24*60*60*1000){
   note('MODEL_EVIDENCE_NOT_SUPPORTED');continue;
  }
  const breakeven=americanBreakEven(primary.americanOdds);
  const b=primary.americanOdds>0?primary.americanOdds/100:100/(-primary.americanOdds);
  const roi=p*b-(1-p);
  rows.push({id:item.id,sport:item.sport,league:item.league,eventName:item.eventName,
   marketType:primary.marketType,bookmaker:primary.bookmaker,
   americanOdds:primary.americanOdds,outcomeId:primary.outcomeId,
   modelId:forecast.modelId,probability:p,breakEvenProbability:breakeven,
   edgePercentagePoints:(p-breakeven)*100,expectedRoiPercent:roi*100,
   independentUpstreamCount:comparison.independentUpstreams,
   priceSpreadPoints:comparison.impliedProbabilitySpreadPoints,
   status:'RESEARCH_ONLY',reasons:['UPSTREAM_IDENTITY_NOT_AUTHENTICATED',
    'STORAGE_ENTITLEMENT_NOT_CERTIFIED','MODEL_PROVENANCE_NOT_AUDITED']});
 }
 rows.sort((a,b)=>b.probability-a.probability||b.expectedRoiPercent-a.expectedRoiPercent||
  a.id.localeCompare(b.id));
 return {mode:'CROSS_PROVIDER_RESEARCH_ONLY' as const,rows:rows.slice(0,limit),
  analyzed:items.length,qualifiedForResearch:rows.length,
  blockedReasons:blocked,releaseCertified:false,verifiedBetCount:0,
  note:'Comparison of supplied quotes cannot establish true independence, provenance or executable sportsbook prices. No bet is certified.'};
}
