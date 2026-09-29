import {demoMarkets} from '@/lib/demo';
import {scanMarkets} from '@/lib/scanner';
import {applyQualityGate} from '@/lib/qualityGate';

export async function POST(req:Request){
 const body=await req.json().catch(()=>({}));
 const markets=Array.isArray(body?.markets)&&body.markets.length?body.markets:demoMarkets;
 const rows=scanMarkets(markets,body?.risk||'Moderate');
 return Response.json({rows:applyQualityGate(rows,body?.observations||{})});
}
