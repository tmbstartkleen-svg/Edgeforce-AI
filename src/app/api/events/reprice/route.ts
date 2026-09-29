import {demoMarkets} from '@/lib/demo';
import {repriceMarket} from '@/lib/repricing';
import {scanMarkets} from '@/lib/scanner';
import {defaultLimits} from '@/lib/portfolio';
import {runDecisionEngine} from '@/lib/decisionEngine';

export async function POST(req:Request){
 const body=await req.json().catch(()=>({}));
 const market=body?.market||demoMarkets.find(x=>x.id===body?.marketId)||demoMarkets[0];
 const repriced=repriceMarket(market,body?.context||{});
 const scanned=scanMarkets([repriced],body?.risk||'Moderate');
 const bankroll=Math.max(1,Number(body?.bankroll)||1000);
 const decision=runDecisionEngine(scanned,{...defaultLimits(bankroll),bankroll},body?.existing||[],Number(body?.drawdownPct)||0);
 return Response.json({market,repriced,decision});
}
