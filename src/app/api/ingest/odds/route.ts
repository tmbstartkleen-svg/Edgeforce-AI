import {demoMarkets} from '@/lib/demo';

export async function POST(req:Request){
 const auth=req.headers.get('authorization');
 if(process.env.INGEST_SECRET && auth!==`Bearer ${process.env.INGEST_SECRET}`) return Response.json({ok:false,error:'unauthorized'},{status:401});
 const url=process.env.ODDS_API_URL;
 const key=process.env.ODDS_API_KEY;
 if(!url||!key) return Response.json({ok:true,mode:'demo',snapshots:demoMarkets.length,markets:demoMarkets});
 try{
  const res=await fetch(url,{headers:{Authorization:`Bearer ${key}`},cache:'no-store'});
  if(!res.ok) throw new Error(`odds provider status ${res.status}`);
  const payload=await res.json();
  const count=Array.isArray(payload)?payload.length:Array.isArray(payload?.markets)?payload.markets.length:0;
  return Response.json({ok:true,mode:'live',snapshots:count,payload});
 }catch(error){
  return Response.json({ok:false,mode:'fallback',error:error instanceof Error?error.message:'provider error',snapshots:demoMarkets.length,markets:demoMarkets});
 }
}
