import {ingestOdds} from '@/lib/providers/ingest';
import {fetchPredictionMarkets} from '@/lib/predictionMarkets';
import {attachPredictionProbabilities} from '@/lib/predictionLink';
import {hydratePlayerProjections} from '@/lib/projection';
import {enrichMarketContext} from '@/lib/contextEnrichment';
import {weekTop30} from '@/lib/scanner';
import {applyQualityGate} from '@/lib/qualityGate';
import {recordModelRuns} from '@/lib/persistence';

export async function GET(req:Request){
 const auth=req.headers.get('authorization');
 if(process.env.CRON_SECRET&&auth!==`Bearer ${process.env.CRON_SECRET}`)return Response.json({ok:false},{status:401});
 const [ingestion,predictions]=await Promise.all([ingestOdds(),fetchPredictionMarkets().catch(()=>({contracts:[]} as any))]);
 const contextual=await enrichMarketContext(ingestion.markets);
 const linked=attachPredictionProbabilities(contextual.markets,predictions.contracts||[]);
 const projected=await hydratePlayerProjections(linked);
 const scanned=weekTop30(projected);
 const rows=applyQualityGate(scanned);
 const recorded=await recordModelRuns(rows).catch(()=>0);
 return Response.json({ok:true,ranAt:new Date().toISOString(),source:ingestion.source,mode:ingestion.mode,providerId:ingestion.providerId,attempts:ingestion.attempts,qualified:rows.length,recorded,contextStatus:contextual.status,top:rows.slice(0,10)});
}
