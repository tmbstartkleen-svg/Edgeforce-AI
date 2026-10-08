import {ingestOdds} from '@/lib/providers/ingest';
import {scanMarkets} from '@/lib/scanner';
import {loadLearnedWeightMultipliers} from '@/lib/learnedWeights';
import {loadDynamicCalibrationProfiles} from '@/lib/regimeConfidence';
import {loadLineMovement} from '@/lib/lineMovement';
import {buildLiveComebackWatch,prepareWorkerSafeLiveComebackMarkets} from '@/lib/liveComeback';

export const dynamic='force-dynamic';

export async function GET(){
 const ingestion=await ingestOdds();

 if(!ingestion.markets.length){
  return Response.json({
   ok:false,
   degraded:true,
   build:'V52',
   schemaVersion:'v52-live-comeback-1',
   source:ingestion.source,
   error:'No live or fresh stored sportsbook markets are available',
   warnings:ingestion.warnings
  },{status:503,headers:{'Cache-Control':'no-store'}});
 }

 const prepared=prepareWorkerSafeLiveComebackMarkets(ingestion.markets);
 if(!prepared.markets.length){
  return Response.json({
   ok:true,
   build:'V52',
   schemaVersion:'v52-live-comeback-1',
   source:ingestion.source,
   providerId:ingestion.providerId||null,
   providerName:ingestion.providerName||null,
   targetBook:ingestion.targetBook,
   contextDiagnostics:prepared.diagnostics,
   ...buildLiveComebackWatch([])
  },{headers:{'Cache-Control':'no-store, max-age=0'}});
 }

 const [learnedWeights,dynamicCalibration]=await Promise.all([
  loadLearnedWeightMultipliers(),
  loadDynamicCalibrationProfiles()
 ]);
 const scanned=scanMarkets(
  prepared.markets,
  'Moderate',
  new Date(),
  learnedWeights,
  dynamicCalibration,
  {simulationRunCap:1000,minDaysOut:-.25,maxDaysOut:.01}
 );
 const lineMovement=await loadLineMovement(prepared.markets).catch(()=>new Map());

 const rows=scanned.map(row=>({
  id:row.id,
  sport:row.sport,
  league:row.league,
  event:row.event,
  selection:row.selection,
  market:row.market,
  startTime:row.startTime,
  odds:row.odds,
  marketProb:row.marketProb,
  simProbability:row.simProbability,
  dynamicConfidence:row.dynamicConfidence,
  agreement:row.agreement,
  grade:row.grade,
  regime:row.regime,
  freshness:row.freshness,
  contextQuality:row.contextQuality,
  lineMovement:lineMovement.get(row.id)||null
 }));

 const watch=buildLiveComebackWatch(rows);

 return Response.json({
  ok:true,
  build:'V52',
  schemaVersion:'v52-live-comeback-1',
  source:ingestion.source,
  providerId:ingestion.providerId||null,
  providerName:ingestion.providerName||null,
  targetBook:ingestion.targetBook,
  contextDiagnostics:prepared.diagnostics,
  ...watch
 },{headers:{'Cache-Control':'no-store, max-age=0'}});
}
