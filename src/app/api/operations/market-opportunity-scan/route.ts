import {scanArbitrage,screenValueEdges} from '@/lib/intelligence-core/market-opportunity-engine.mjs';
import {buildSportsResearchPipeline} from '@/lib/intelligence-core/sports-research-pipeline.mjs';
export const dynamic='force-dynamic';
/** Owner-only analysis of client supplied verified source observations. No network requests or bets. */
export async function POST(request:Request){
 const secret=process.env.CRON_SECRET;
 if(!secret||secret.length<32)return Response.json({ok:false,reason:'NOT_CONFIGURED'},{status:503,headers:{'Cache-Control':'no-store'}});
 if(request.headers.get('authorization')!==`Bearer ${secret}`)return Response.json({ok:false,reason:'UNAUTHORIZED'},{status:401,headers:{'Cache-Control':'no-store'}});
 try{
  const limit=4*1024*1024;
  if(Number(request.headers.get('content-length'))>limit)
   return Response.json({ok:false,reason:'REQUEST_TOO_LARGE'},{status:413,headers:{'Cache-Control':'no-store'}});
  const reader=request.body?.getReader();
  const chunks:Uint8Array[]=[];
  let size=0;
  try{
   if(reader)while(true){
    const {value,done}=await reader.read();
    if(done)break;
    size+=value.byteLength;
    if(size>limit){await reader.cancel();return Response.json({ok:false,reason:'REQUEST_TOO_LARGE'},{status:413,headers:{'Cache-Control':'no-store'}})}
    chunks.push(value);
   }
  }finally{reader?.releaseLock()}
  const bytes=new Uint8Array(size);
  let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
  const body=JSON.parse(new TextDecoder().decode(bytes));
  if(!body||typeof body!=='object'||Array.isArray(body)||!Array.isArray(body.quotes)||body.quotes.length>10000||
   (body.forecasts!==undefined&&(!Array.isArray(body.forecasts)||body.forecasts.length>5000))||
   (body.playerResearch!==undefined&&(!Array.isArray(body.playerResearch)||body.playerResearch.length>100)))throw Error('INVALID_INPUT');
  const now=Date.now();
  const arb=scanArbitrage(body.quotes,{bankroll:body.bankroll??100,now});
  const edges=screenValueEdges(body.quotes,body.forecasts??[],{now});
  const research=buildSportsResearchPipeline({quotes:body.quotes,forecasts:body.forecasts??[],playerResearch:body.playerResearch??[]},{now});
  return Response.json({ok:true,mode:'EVIDENCE_ONLY_OPPORTUNITY_SCAN',arbitrage:arb,value:edges,
   research,inputOrigin:'OPERATOR_SUPPLIED',sourceAuthenticityCertified:false,
   productionBetRecommendationAuthorized:false,
   disclaimer:'Theoretical opportunities require independent live venue confirmation, fees, limits, liquidity and settlement verification before use.',
   ordersPlaced:0,externalApiRequests:0,databaseWrites:0},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({ok:false,reason:'INVALID_OPPORTUNITY_SCAN'},{status:400,headers:{'Cache-Control':'no-store'}})}
}
