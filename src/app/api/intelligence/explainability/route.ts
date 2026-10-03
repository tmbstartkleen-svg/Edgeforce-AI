import {demoMarkets} from '@/lib/demo';
import {explainMarket} from '@/lib/explainability';
import {loadLearnedWeightMultipliers} from '@/lib/learnedWeights';
import {latestStoredMarkets} from '@/lib/persistence';

export const dynamic='force-dynamic';

export async function GET(req:Request){
 const {searchParams}=new URL(req.url);
 const marketId=searchParams.get('marketId');
 const limit=Math.max(1,Math.min(50,Number(searchParams.get('limit')||20)));
 const [stored,learnedWeights]=await Promise.all([
  latestStoredMarkets(Math.max(100,limit*5)).catch(()=>[]),
  loadLearnedWeightMultipliers()
 ]);
 const sourceMarkets=stored.length?stored:demoMarkets;
 const markets=marketId
  ?sourceMarkets.filter(x=>x.id===marketId).slice(0,1)
  :sourceMarkets.slice(0,limit);
 const fallback=marketId&&!markets.length?demoMarkets.filter(x=>x.id===marketId):[];
 const selected=markets.length?markets:fallback;
 const explanations=selected.map(m=>({
  market:{id:m.id,sport:m.sport,event:m.event,selection:m.selection,market:m.market,startTime:m.startTime},
  explanation:explainMarket(m,learnedWeights)
 }));
 return Response.json({
  ok:true,
  source:stored.length?'database':'demo',
  marketId,
  count:explanations.length,
  explanations
 },{headers:{'Cache-Control':'no-store'}});
}
