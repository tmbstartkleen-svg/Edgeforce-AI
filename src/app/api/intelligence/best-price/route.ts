import {ingestOdds} from '@/lib/providers/ingest';
import {fetchPredictionMarkets} from '@/lib/predictionMarkets';
import {buildUniversalSnapshot} from '@/lib/universalMarkets';
import {buildBestPriceBoard,persistBestPriceRows} from '@/lib/bestPrice';

export const dynamic='force-dynamic';

export async function GET(){
 const [odds,prediction]=await Promise.all([ingestOdds(),fetchPredictionMarkets()]);
 const universal=buildUniversalSnapshot(odds.markets,prediction.contracts);
 const report=buildBestPriceBoard({consensus:odds.markets,panel:odds.panelMarkets||[],universal:universal.markets});
 const persistence=await persistBestPriceRows(report.rows);
 return Response.json({
  ok:true,
  analyticsOnly:true,
  executionEnabled:false,
  persisted:persistence.persisted,
  source:{sportsbook:odds.providerName,predictionMarkets:prediction.source},
  ...report
 },{headers:{'Cache-Control':'no-store, max-age=0'}});
}
