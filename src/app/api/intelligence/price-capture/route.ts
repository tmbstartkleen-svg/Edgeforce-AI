import {ingestOdds} from '@/lib/providers/ingest';
import {fetchPredictionMarkets} from '@/lib/predictionMarkets';
import {buildUniversalSnapshot} from '@/lib/universalMarkets';
import {buildBestPriceBoard} from '@/lib/bestPrice';
import {buildPriceCaptureReport} from '@/lib/priceCapture';

export const dynamic='force-dynamic';

export async function GET(){
 const [odds,prediction]=await Promise.all([ingestOdds(),fetchPredictionMarkets()]);
 const universal=buildUniversalSnapshot(odds.markets,prediction.contracts);
 const best=buildBestPriceBoard({consensus:odds.markets,panel:odds.panelMarkets||[],universal:universal.markets});
 const report=await buildPriceCaptureReport(best.rows);
 return Response.json({
  ok:true,
  analyticsOnly:true,
  executionEnabled:false,
  ...report,
  notes:[
   'Price capture measures how earlier EdgeForce best-price observations compare with later market prices.',
   'Positive capture is a market-quality benchmark, not a guarantee of winning outcomes.',
   'Venue rankings are sample-size weighted so small histories do not dominate.'
  ]
 },{headers:{'Cache-Control':'no-store, max-age=0'}});
}
