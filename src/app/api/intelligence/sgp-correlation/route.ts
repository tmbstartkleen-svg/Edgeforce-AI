import {sameGameCorrelation,correlationAdjustedJoint} from '@/lib/sameGameCorrelation';
import type {Scanned} from '@/lib/scanner';

export async function POST(req:Request){
 const body=await req.json().catch(()=>({}));
 const legs=Array.isArray(body?.legs)?body.legs as Scanned[]:[];
 if(legs.length<2)return Response.json({ok:false,error:'At least two legs are required'},{status:400});
 const pairs=[];
 for(let i=0;i<legs.length;i++){
  for(let j=i+1;j<legs.length;j++){
   pairs.push({
    a:legs[i].id,
    b:legs[j].id,
    correlation:sameGameCorrelation(legs[i],legs[j])
   });
  }
 }
 const joint=correlationAdjustedJoint(legs);
 return Response.json({ok:true,independentProbability:joint.independent,adjustedProbability:joint.adjusted,correlationAdjustment:joint.adjustment,pairs});
}
