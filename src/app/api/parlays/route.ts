import {ingestOdds} from '@/lib/providers/ingest';
import {scanMarkets} from '@/lib/scanner';
import {buildParlayBoards,selectParlayPool,DEFAULT_PARLAY_THRESHOLDS} from '@/lib/parlays';
import {loadLearnedSgpCorrelations} from '@/lib/learnedSgpCorrelation';
import {loadLearnedWeightMultipliers} from '@/lib/learnedWeights';
import {loadDynamicCalibrationProfiles} from '@/lib/regimeConfidence';

export const dynamic='force-dynamic';
const PARLAY_SCHEMA_VERSION='v48-recommendation-quality-1';

const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const numberParam=(value:string|null,fallback:number,min:number,max:number)=>{
 if(value===null||value.trim()==='')return fallback;
 const n=Number(value);
 return Number.isFinite(n)?clamp(n,min,max):fallback;
};

export async function GET(req:Request){
 const {searchParams}=new URL(req.url);
 const size=searchParams.get('size')==='3'?3:2;
 const view=searchParams.get('view')==='today'?'today':'week';

 const thresholds={
  recommendedMinJoint:numberParam(searchParams.get('minJoint'),DEFAULT_PARLAY_THRESHOLDS.recommendedMinJoint,.05,.95),
  recommendedMinLeg:numberParam(searchParams.get('minLeg'),DEFAULT_PARLAY_THRESHOLDS.recommendedMinLeg,.05,.99),
  recommendedMinConfidence:numberParam(searchParams.get('minConfidence'),DEFAULT_PARLAY_THRESHOLDS.recommendedMinConfidence,.05,.99),
  recommendedMaxModelSimulationGap:numberParam(searchParams.get('maxSimGap'),DEFAULT_PARLAY_THRESHOLDS.recommendedMaxModelSimulationGap,.01,.50),
  recommendedMinContextCoverage:numberParam(searchParams.get('minContext'),DEFAULT_PARLAY_THRESHOLDS.recommendedMinContextCoverage,0,1),
  valueMinJoint:numberParam(searchParams.get('valueMinJoint'),DEFAULT_PARLAY_THRESHOLDS.valueMinJoint,.01,.90),
  extremeUnderdogOdds:numberParam(searchParams.get('extremeOdds'),DEFAULT_PARLAY_THRESHOLDS.extremeUnderdogOdds,100,5000),
  hailMaryCombinedOdds:numberParam(searchParams.get('hailOdds'),DEFAULT_PARLAY_THRESHOLDS.hailMaryCombinedOdds,200,100000)
 };

 const [ingestion,learned,learnedWeights,dynamicCalibration]=await Promise.all([
  ingestOdds(),
  loadLearnedSgpCorrelations(),
  loadLearnedWeightMultipliers(),
  loadDynamicCalibrationProfiles()
 ]);

 if(!ingestion.markets.length){
  return Response.json({
   ok:false,
   source:ingestion.source,
   providerId:ingestion.providerId||null,
   error:'No live or fresh stored sportsbook markets are available',
   warnings:ingestion.warnings
  },{status:503,headers:{'Cache-Control':'no-store'}});
 }

 const all=scanMarkets(ingestion.markets,'Moderate',new Date(),learnedWeights,dynamicCalibration);
 const eligible=view==='today'?all.filter(x=>x.bucket==='TODAY'):all;
 const gradeCounts={
  ELITE:eligible.filter(x=>x.grade==='ELITE').length,
  STRONG:eligible.filter(x=>x.grade==='STRONG').length,
  WATCH:eligible.filter(x=>x.grade==='WATCH').length,
  PASS:eligible.filter(x=>x.grade==='PASS').length
 };
 const pool=selectParlayPool(eligible,size);
 const boards=buildParlayBoards(eligible,size,learned,thresholds);
 const recommendationStatus=boards.recommended.length
  ?'QUALIFIED'
  :pool.strictCount<size
    ?'NO_STRICT_LEGS'
    :'NO_COMBINATION_CLEARED_RISK_GATES';

 return Response.json({
  ok:true,
  generatedAt:new Date().toISOString(),
  build:'V48',
  schemaVersion:PARLAY_SCHEMA_VERSION,
  source:ingestion.source,
  providerId:ingestion.providerId||null,
  providerName:ingestion.providerName||null,
  targetBook:ingestion.targetBook,
  size,
  view,
  candidateLegs:eligible.length,
  gradeCounts,
  strictEligible:pool.strictCount,
  watchEligible:pool.watchCount,
  fallbackUsed:pool.fallbackUsed,
  qualification:pool.qualification,
  learnedProfileCount:Object.keys(learned).length,
  recommendationStatus,
  thresholds:boards.thresholds,
  generatedParlayCandidates:boards.generated,
  rejectedParlayCandidates:boards.rejected,
  recommended:boards.recommended,
  valueWatchlist:boards.valueWatchlist,
  hailMary:boards.hailMary,
  parlays:boards.recommended,
  warnings:ingestion.warnings
 },{headers:{'Cache-Control':'no-store'}});
}
