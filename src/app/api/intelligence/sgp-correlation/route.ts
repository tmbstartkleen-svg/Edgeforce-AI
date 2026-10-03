import {runEventJointSimulation} from '@/lib/eventJointSimulation';
import {loadLearnedSgpCorrelations,rebuildLearnedSgpCorrelations} from '@/lib/learnedSgpCorrelation';
import type {Scanned} from '@/lib/scanner';

export const dynamic='force-dynamic';

export async function GET(){
 const learned=await loadLearnedSgpCorrelations();
 const profiles=Object.values(learned);
 return Response.json({
  ok:true,
  profileCount:profiles.length,
  activeProfiles:profiles.filter(x=>Math.abs(x.learnedRho)>0).length,
  profiles:profiles.slice(0,250)
 },{headers:{'Cache-Control':'no-store'}});
}

export async function POST(req:Request){
 const body=await req.json().catch(()=>({}));
 const legs=Array.isArray(body?.legs)?body.legs as Scanned[]:[];
 if(legs.length<2)return Response.json({ok:false,error:'At least two legs are required'},{status:400});
 if(legs.length>20)return Response.json({ok:false,error:'At most 20 legs are supported'},{status:400});
 const learned=await loadLearnedSgpCorrelations();
 const authorized=!process.env.INGEST_SECRET||req.headers.get('authorization')===`Bearer ${process.env.INGEST_SECRET}`;
 const maxRuns=authorized?100000:10000;
 const runs=Math.max(1000,Math.min(maxRuns,Number(body?.runs||10000)));
 const joint=runEventJointSimulation(legs,learned,runs);
 return Response.json({ok:true,...joint},{headers:{'Cache-Control':'no-store'}});
}

export async function PUT(req:Request){
 const auth=req.headers.get('authorization');
 if(process.env.INGEST_SECRET&&auth!==`Bearer ${process.env.INGEST_SECRET}`)return Response.json({ok:false,error:'unauthorized'},{status:401});
 const result=await rebuildLearnedSgpCorrelations();
 return Response.json(result,{headers:{'Cache-Control':'no-store'}});
}
