import {saveMarketSnapshots} from '@/lib/persistence';

export async function POST(req:Request){
 const auth=req.headers.get('authorization');
 if(process.env.INGEST_SECRET && auth!==`Bearer ${process.env.INGEST_SECRET}`) return Response.json({ok:false,error:'unauthorized'},{status:401});
 const url=process.env.ODDS_API_URL;
 const key=process.env.ODDS_API_KEY;
 if(!url||!key){
  return Response.json({ok:false,mode:'unconfigured',error:'Live odds provider is not configured; no demo prices were persisted as sportsbook data.',snapshots:0,persisted:0,markets:[]},{status:503,headers:{'Cache-Control':'no-store'}});
 }
 try{
  const res=await fetch(url,{headers:{Authorization:`Bearer ${key}`},cache:'no-store'});
  if(!res.ok) throw new Error(`odds provider status ${res.status}`);
  const payload=await res.json();
  const markets=Array.isArray(payload)?payload:Array.isArray(payload?.markets)?payload.markets:[];
  if(!markets.length)return Response.json({ok:false,mode:'live_empty',error:'Provider returned no market rows.',snapshots:0,persisted:0},{status:503,headers:{'Cache-Control':'no-store'}});
  const persisted=await saveMarketSnapshots(markets,'authorized-provider','DraftKings');
  return Response.json({ok:true,mode:'live',snapshots:markets.length,persisted});
 }catch(error){
  return Response.json({ok:false,mode:'failed',error:error instanceof Error?error.message:'provider error',snapshots:0,persisted:0},{status:503,headers:{'Cache-Control':'no-store'}});
 }
}
