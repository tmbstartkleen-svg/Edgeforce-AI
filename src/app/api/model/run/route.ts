import {demoMarkets} from '@/lib/demo';
import {rankMarkets} from '@/lib/engine';
import type {RiskProfile} from '@/lib/types';

export async function POST(req:Request){
 let risk:RiskProfile='Moderate';
 let rows=demoMarkets;
 try{
  const body=await req.json();
  if(body?.risk==='Conservative'||body?.risk==='Moderate'||body?.risk==='Aggressive') risk=body.risk;
  if(Array.isArray(body?.markets)&&body.markets.length) rows=body.markets;
 }catch{}
 const ranked=rankMarkets(rows,risk);
 return Response.json({risk,count:ranked.length,ranked});
}
