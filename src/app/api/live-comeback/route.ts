import {ingestOdds} from '@/lib/providers/ingest';
import {scanMarkets} from '@/lib/scanner';
import {loadLearnedWeightMultipliers} from '@/lib/learnedWeights';
import {loadDynamicCalibrationProfiles} from '@/lib/regimeConfidence';
import {enrichMarketsWithContext} from '@/lib/providers/contextFusion';
import {loadLineMovement} from '@/lib/lineMovement';
import {buildLiveComebackWatch} from '@/lib/liveComeback';

export const dynamic='force-dynamic';

export async function GET(){
 const [ingestion,learnedWeights,dynamicCalibration]=await Promise.all([
  ingestOdds(),
  loadLearnedWeightMultipliers(),
  loadDynamicCalibrationProfiles()
 ]);

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

 const context=await enrichMarketsWithContext(ingestion.markets);
 const scanned=scanMarkets(context.markets,'Moderate',new Date(),learnedWeights,dynamicCalibration);
 const lineMovement=await loadLineMovement(context.markets).catch(()=>new Map());

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
  contextDiagnostics:context.diagnostics,
  ...watch
 },{headers:{'Cache-Control':'no-store, max-age=0'}});
}
