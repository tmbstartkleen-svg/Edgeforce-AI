import {demoMarkets} from '@/lib/demo';
import {saveMarketSnapshots} from '@/lib/persistence';

export async function POST(req:Request){
 const auth=req.headers.get('authorization');
 if(process.env.INGEST_SECRET && auth!==`Bearer ${process.env.INGEST_SECRET}`) return Response.json({ok:false,error:'unauthorized'},{status:401});
 const url=process.env.ODDS_API_URL;
 const key=process.env.ODDS_API_KEY;
 if(!url||!key){
  const persisted=await saveMarketSnapshots(demoMarkets,'demo','DraftKings');
  return Response.json({ok:true,mode:'demo',snapshots:demoMarkets.length,persisted,markets:demoMarkets});
 }
 try{
  const res=await fetch(url,{headers:{Authorization:`Bearer ${key}`},cache:'no-store'});
  if(!res.ok) throw new Error(`odds provider status ${res.status}`);
  const payload=await res.json();
  const markets=Array.isArray(payload)?payload:Array.isArray(payload?.markets)?payload.markets:[];
  const persisted=await saveMarketSnapshots(markets,'authorized-provider','DraftKings');
  return Response.json({ok:true,mode:'live',snapshots:markets.length,persisted});
 }catch(error){
  const persisted=await saveMarketSnapshots(demoMarkets,'fallback','DraftKings');
  return Response.json({ok:false,mode:'fallback',error:error instanceof Error?error.message:'provider error',snapshots:demoMarkets.length,persisted});
 }
}
