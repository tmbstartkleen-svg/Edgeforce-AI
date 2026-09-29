import {demoMarkets} from '@/lib/demo';
import {repriceMarket} from '@/lib/repricing';
import {scanMarkets} from '@/lib/scanner';
import {defaultLimits,optimizePortfolio} from '@/lib/portfolio';

export async function POST(req:Request){
 const body=await req.json().catch(()=>({}));
 const market=body?.market||demoMarkets.find(x=>x.id===body?.marketId)||demoMarkets[0];
 const repriced=repriceMarket(market,body?.context||{});
 const scan=scanMarkets([repriced],body?.risk||'Moderate');
 const bankroll=Math.max(1,Number(body?.bankroll)||1000);
 const limits={...defaultLimits(bankroll),...(body?.limits||{}),bankroll};
 const portfolio=optimizePortfolio(scan,limits,Number(body?.drawdownPct)||0);
 return Response.json({readOnly:true,original:market,repriced,scan,portfolio});
}
