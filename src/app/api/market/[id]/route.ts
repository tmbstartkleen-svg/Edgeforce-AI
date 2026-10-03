import {db} from '@/lib/db';
import {demoMarkets} from '@/lib/demo';
import {modelCouncil} from '@/lib/modelCouncil';
import {scanMarkets} from '@/lib/scanner';
import {explainMarket} from '@/lib/explainability';
import {loadLearnedWeightMultipliers} from '@/lib/learnedWeights';
import {loadDynamicCalibrationProfiles} from '@/lib/regimeConfidence';

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const [learnedWeights,dynamicCalibration]=await Promise.all([
  loadLearnedWeightMultipliers(),
  loadDynamicCalibrationProfiles()
 ]);
 const sql=db();
 if(!sql){
  const market=demoMarkets.find(x=>x.id===id)||null;
  return Response.json({
   source:'demo',
   market,
   council:market?modelCouncil(market,learnedWeights):null,
   explanation:market?explainMarket(market,learnedWeights):null,
   scan:market?scanMarkets([market],'Moderate',new Date(),learnedWeights,dynamicCalibration):[]
  });
 }
 const rows=await sql`
  select distinct on (ms.event_id,ms.market_key,ms.selection_key)
   ms.event_id as id,e.sport,e.league,
   coalesce(e.away_team_id,'Away') || ' @ ' || coalesce(e.home_team_id,'Home') as event,
   ms.selection_key as selection,ms.market_key as market,e.start_time as "startTime",
   coalesce(e.home_team_id,'Home') as home,coalesce(e.away_team_id,'Away') as away,
   ms.american_odds as odds,
   ms.implied_probability::float as "rawImpliedProb",
   coalesce(ms.raw->>'sourceBook',ms.bookmaker) as "sourceBook",
   coalesce(ms.raw->>'sourceProviderId',ms.provider) as "sourceProviderId",
   ms.raw->'consensus' as consensus,
   coalesce(ms.no_vig_probability,ms.implied_probability,0.5)::float as "marketProb",
   coalesce((ms.raw->>'modelProb')::float,coalesce(ms.no_vig_probability,ms.implied_probability,0.5)::float) as "modelProb",
   coalesce((ms.raw->>'confidence')::float,0.6) as confidence,
   greatest(0,extract(epoch from (now()-ms.pulled_at))/60)::float as "sourceAgeMin",
   case when extract(hour from e.start_time at time zone 'America/Chicago')<12 then 'AM' else 'PM' end as period,
   coalesce(ms.raw->'sportFeatures','{}'::jsonb) as "sportFeatures",
   coalesce(ms.raw->'contextSources','[]'::jsonb) as "contextSources",
   ms.raw->'playerContext' as "playerContext"
  from market_snapshots ms join events e on e.id=ms.event_id
  where ms.event_id=${id}
  order by ms.event_id,ms.market_key,ms.selection_key,ms.pulled_at desc
  limit 1
 `;
 const market=rows[0]||null;
 return Response.json({
  source:'database',
  market,
  council:market?modelCouncil(market as any,learnedWeights):null,
  explanation:market?explainMarket(market as any,learnedWeights):null,
  scan:market?scanMarkets([market as any],'Moderate',new Date(),learnedWeights,dynamicCalibration):[]
 });
}
