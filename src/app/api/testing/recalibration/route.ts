import {evaluateRecalibration,type RecalibrationOptions} from '@/lib/recalibrationEngine';
import type {HistoricalPrediction} from '@/lib/backtest';

function makeRows(modelName:string,count:number,predicted:number,outcomes:number[]):HistoricalPrediction[]{
 return Array.from({length:count},(_,i)=>({
  occurredAt:new Date(Date.UTC(2026,0,1+i)).toISOString(),
  sport:'TEST',
  marketKey:'Moneyline',
  modelName,
  predicted,
  odds:-110,
  outcome:outcomes[i%outcomes.length] as 0|1,
  closingOdds:-115
 }));
}

export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return new Response(null,{status:404});
 const options:RecalibrationOptions={
  minSample:40,minHoldout:10,shrinkageSamples:60,maxAdjustment:.25,lookbackRows:1000,trainSize:40,testSize:10
 };
 const good=makeRows('Good Model',80,.75,[1,1,1,0]);
 const bad=makeRows('Bad Model',80,.80,[1,0]);
 const small=makeRows('Small Model',12,.70,[1,1,0]);
 const groups=evaluateRecalibration([...good,...bad,...small],options);
 const goodResult=groups.find(x=>x.modelName==='Good Model');
 const badResult=groups.find(x=>x.modelName==='Bad Model');
 const smallResult=groups.find(x=>x.modelName==='Small Model');
 const ok=Boolean(
  goodResult?.promoted&&goodResult.multiplier>1&&
  badResult&&!badResult.promoted&&badResult.multiplier===1&&
  smallResult&&!smallResult.promoted&&smallResult.multiplier===1
 );
 return Response.json({ok,good:goodResult,bad:badResult,small:smallResult});
}
