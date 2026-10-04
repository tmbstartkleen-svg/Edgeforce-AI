import {fetchPredictionMarkets} from '@/lib/predictionMarkets';
import {evaluatePredictionPositions} from '@/lib/predictionPositionIntelligence';
import {loadOpenPredictionPositions} from '@/lib/predictionPositions';

export const dynamic='force-dynamic';

export async function GET(){
 try{
  const [positions,predictions]=await Promise.all([
   loadOpenPredictionPositions(),
   fetchPredictionMarkets()
  ]);
  const intelligence=evaluatePredictionPositions(positions,predictions.contracts);
  const summary={
   openPositions:positions.length,
   add:intelligence.filter(x=>x.action==='ADD').length,
   hold:intelligence.filter(x=>x.action==='HOLD').length,
   trim:intelligence.filter(x=>x.action==='TRIM').length,
   takeProfit:intelligence.filter(x=>x.action==='TAKE_PROFIT').length,
   exit:intelligence.filter(x=>x.action==='EXIT').length,
   noSignal:intelligence.filter(x=>x.action==='NO_SIGNAL').length,
   unrealizedPnl:intelligence.reduce((s,x)=>s+x.unrealizedPnl,0),
   entryCost:intelligence.reduce((s,x)=>s+x.entryCost,0),
   currentExitValue:intelligence.reduce((s,x)=>s+x.currentExitValue,0)
  };
  return Response.json({
   ok:true,
   generatedAt:new Date().toISOString(),
   source:predictions.source,
   summary,
   intelligence,
   warnings:predictions.warnings||[]
  },{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  return Response.json({ok:false,error:error instanceof Error?error.message:'position intelligence failed'},{status:500,headers:{'Cache-Control':'no-store'}});
 }
}