import {buildValidationReport,pairedProbabilityComparison} from '@/lib/validationLab';
import type {HistoricalPrediction} from '@/lib/backtest';

export const dynamic='force-dynamic';

function row(i:number,good:boolean,contextRich:boolean):HistoricalPrediction{
 const cycle=i%20;
 const highSignal=cycle<10;
 const outcome:(0|1)=highSignal?(cycle<8?1:0):(cycle<15?1:0);
 const predicted=good ? .65 : .88;
 const sim=highSignal ? .80 : .50;
 return {
  occurredAt:new Date(Date.UTC(2024,0,1+i)).toISOString(),
  sport:'NFL',marketKey:'h2h',modelName:good?'Good Model':'Bad Model',modelVersion:'edgeforce-v51',
  predicted,odds:-105,closingOdds:-115,outcome,
  features:{
   simProbability:sim,
   contextQuality:contextRich?{coverage:.82,criticalCoverage:.88,recommendationReady:true}:{coverage:.20,criticalCoverage:.25,recommendationReady:false}
  }
 };
}

export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return new Response(null,{status:404});

 const good=Array.from({length:400},(_,i)=>row(i,true,i%4!==0));
 const bad=Array.from({length:120},(_,i)=>row(i,false,i%3===0));
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
