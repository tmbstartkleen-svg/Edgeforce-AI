import {demoMarkets} from '@/lib/demo';

export async function GET(){
 const url=process.env.ODDS_API_URL;
 const key=process.env.ODDS_API_KEY;
 if(!url||!key){
  return Response.json({mode:'demo',source:'local-demo',markets:demoMarkets});
 }
 try{
  const res=await fetch(url,{headers:{Authorization:`Bearer ${key}`},cache:'no-store'});
  if(!res.ok) throw new Error(`provider status ${res.status}`);
  const payload=await res.json();
  return Response.json({mode:'live',source:url,markets:payload});
 }catch(error){
  return Response.json({mode:'fallback',error:error instanceof Error?error.message:'provider error',markets:demoMarkets},{status:200});
 }
}
