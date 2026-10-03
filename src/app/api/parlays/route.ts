import {ingestOdds} from '@/lib/providers/ingest';
import {scanMarkets} from '@/lib/scanner';
import {buildParlays} from '@/lib/parlays';
import {loadLearnedSgpCorrelations} from '@/lib/learnedSgpCorrelation';
import {loadLearnedWeightMultipliers} from '@/lib/learnedWeights';
import {loadDynamicCalibrationProfiles} from '@/lib/regimeConfidence';

export const dynamic='force-dynamic';

const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));

export async function GET(req:Request){
 const {searchParams}=new URL(req.url);
 const size=searchParams.get('size')==='3'?3:2;
 const view=searchParams.get('view')==='today'?'today':'week';
 const minJoint=clamp(Number(searchParams.get('minJoint')||0),0,.95);

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
 const parlays=buildParlays(eligible,size,learned).filter(x=>x.combinedProbability>=minJoint);

 return Response.json({
  ok:true,
  generatedAt:new Date().toISOString(),
  source:ingestion.source,
  providerId:ingestion.providerId||null,
  providerName:ingestion.providerName||null,
  targetBook:ingestion.targetBook,
  size,
  view,
  minJoint,
  candidateLegs:eligible.length,
  learnedProfileCount:Object.keys(learned).length,
  warnings:ingestion.warnings,
  parlays
 },{headers:{'Cache-Control':'no-store'}});
}
