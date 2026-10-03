import {buildValidationReport,pairedProbabilityComparison} from '@/lib/validationLab';
import type {HistoricalPrediction} from '@/lib/backtest';

export const dynamic='force-dynamic';

function row(i:number,good:boolean,contextRich:boolean):HistoricalPrediction{
 const outcome:(0|1)=i%10<6?1:0;
 const base=good?(outcome ? .68 : .42):(outcome ? .82 : .74);
 const predicted=Math.max(.05,Math.min(.95,base+(i%5-2)*.006));
 const sim=Math.max(.05,Math.min(.95,(outcome ? .72 : .34)+(i%3-1)*.004));
 return {
  occurredAt:new Date(Date.UTC(2026,0,1+i)).toISOString(),
  sport:'NFL',marketKey:'h2h',modelName:good?'Good Model':'Bad Model',modelVersion:'edgeforce-v51',
  predicted,odds:outcome?-115:105,closingOdds:outcome?-125:115,outcome,
  features:{
   simProbability:sim,
   contextQuality:contextRich?{coverage:.82,criticalCoverage:.88,recommendationReady:true}:{coverage:.20,criticalCoverage:.25,recommendationReady:false}
  }
 };
}

export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return new Response(null,{status:404});

 const good=Array.from({length:240},(_,i)=>row(i,true,i%4!==0));
 const bad=Array.from({length:100},(_,i)=>row(i,false,i%3===0));
 const report=buildValidationReport([...good,...bad]);
 const goodGroup=report.groups.find(x=>x.modelName==='Good Model');
 const badGroup=report.groups.find(x=>x.modelName==='Bad Model');
 const paired=pairedProbabilityComparison(good,x=>Number((x.features as any)?.simProbability));

 const ok=
  Boolean(goodGroup)&&
  Boolean(badGroup)&&
  goodGroup!.promotionEligible===true&&
  ['VERIFIED','QUALIFIED'].includes(goodGroup!.evidenceGrade)&&
  badGroup!.promotionEligible===false&&
  badGroup!.evidenceGrade==='FAILED'&&
  paired.sampleSize===good.length&&
  paired.better==='ALTERNATIVE'&&
  report.overall.confidenceBands.some(x=>x.sampleSize>0)&&
  report.diagnostics.contextTaggedRows===good.length+bad.length;

 return Response.json({ok,good:goodGroup,bad:badGroup,paired,evidence:report.evidence,diagnostics:report.diagnostics},{headers:{'Cache-Control':'no-store'}});
}
