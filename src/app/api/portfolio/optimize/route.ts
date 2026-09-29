import {demoMarkets} from '@/lib/demo';
import {weekTop30} from '@/lib/scanner';
import {defaultLimits,optimizePortfolio} from '@/lib/portfolio';

export async function POST(req:Request){
 const body=await req.json().catch(()=>({}));
 const bankroll=Math.max(1,Number(body?.bankroll)||1000);
 const limits={...defaultLimits(bankroll),...(body?.limits||{}),bankroll};
 const rows=Array.isArray(body?.rows)&&body.rows.length?body.rows:weekTop30(demoMarkets,body?.risk||'Moderate');
 return Response.json({limits,result:optimizePortfolio(rows,limits,Number(body?.drawdownPct)||0)});
}
