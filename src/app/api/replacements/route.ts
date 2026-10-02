import {ingestOdds} from '@/lib/providers/ingest';
import {fetchPredictionMarkets} from '@/lib/predictionMarkets';
import {attachPredictionProbabilities} from '@/lib/predictionLink';
import {hydratePlayerProjections} from '@/lib/projection';
import {enrichMarketContext} from '@/lib/contextEnrichment';
import {scanMarketsWithOutcomes} from '@/lib/scanner';
import {getWeeklyDraft} from '@/lib/weeklyBuilder';
import {buildReplacementComparisons} from '@/lib/replacementEngine';
import {officialScannedEligible} from '@/lib/feedIntegrity';
import type {RiskProfile} from '@/lib/types';

export const dynamic='force-dynamic';

export async function GET(req:Request){
  const {searchParams}=new URL(req.url);
  const requestedRisk=searchParams.get('risk')||'Moderate';
  const risk=(requestedRisk==='Conservative'||requestedRisk==='Aggressive'?requestedRisk:'Moderate') as RiskProfile;

  const [ingestion,weekly]=await Promise.all([ingestOdds(),getWeeklyDraft()]);

  if(!ingestion.integrity.officialEligible){
    return Response.json({
      generatedAt:new Date().toISOString(),risk,source:ingestion.source,providerMode:ingestion.mode,
      officialBoard:false,feedIntegrity:ingestion.integrity,weeklyConfigured:weekly.configured,
      weeklyJointProbability:weekly.combinedProbability,flaggedLegs:weekly.legs.filter(x=>x.decisionStatus!=='KEEP').length,
      groups:[]
    },{headers:{'Cache-Control':'no-store, max-age=0'}});
  }

  const predictions=await fetchPredictionMarkets().catch(()=>({contracts:[],mode:'failed',source:null,attempts:[],error:'prediction provider unavailable'} as any));
  const contextual=await enrichMarketContext(ingestion.markets);
  const linked=attachPredictionProbabilities(contextual.markets,predictions.contracts||[]);
  const projected=await hydratePlayerProjections(linked);
  const simulation=scanMarketsWithOutcomes(projected,risk);
  const eligible=officialScannedEligible(simulation.rows).filter(x=>x.daysOut<=8);
  const groups=weekly.configured?buildReplacementComparisons(weekly.legs,eligible,simulation.hitVectors,8):[];

  return Response.json({
    generatedAt:new Date().toISOString(),risk,source:ingestion.source,providerMode:ingestion.mode,
    officialBoard:true,feedIntegrity:ingestion.integrity,weeklyConfigured:weekly.configured,
    weeklyJointProbability:weekly.combinedProbability,
    flaggedLegs:weekly.legs.filter(x=>x.decisionStatus!=='KEEP').length,
    groups
  },{headers:{'Cache-Control':'no-store, max-age=0'}});
}
