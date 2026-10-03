import {evaluateModelGovernance,populationStabilityIndex} from '@/lib/modelGovernance';
import type {HistoricalPrediction} from '@/lib/backtest';

export const dynamic='force-dynamic';

function rows(modelName:string,baselineP:number,recentP:number){
 const out:HistoricalPrediction[]=[];
 for(let i=0;i<120;i++){
  const recent=i>=80;
  const predicted=recent?recentP:baselineP;
  const outcome=(i%4===0?0:1) as 0|1;
  out.push({
   occurredAt:new Date(Date.UTC(2026,0,1+i)).toISOString(),
   sport:'NFL',
   marketKey:'moneyline',
   modelName,
   predicted,
   odds:-110,
   closingOdds:-115,
   outcome
  });
 }
 return out;
}

export async function GET(){
 const history=[
  ...rows('Stable Champion',.75,.75),
  ...rows('Qualified Challenger',.64,.64),
  ...rows('Drifting Model',.74,.96)
 ];
 const profiles=evaluateModelGovernance(history,{
  minBaseline:40,minRecent:20,recentFraction:.33,promotionMargin:.015,lookbackRows:1000
 });
 const champion=profiles.find(x=>x.role==='CHAMPION');
 const challenger=profiles.find(x=>x.role==='CHALLENGER');
 const drifting=profiles.find(x=>x.modelName==='Drifting Model');
 const stable=profiles.find(x=>x.modelName==='Stable Champion');
 const psiDirection=populationStabilityIndex(Array(50).fill(.72),Array(50).fill(.93));
 const ok=champion?.modelName==='Stable Champion'
  &&challenger?.modelName==='Qualified Challenger'
  &&drifting?.driftStatus==='CRITICAL'
  &&Number(drifting.runtimeMultiplier)<Number(stable?.runtimeMultiplier||0)
  &&psiDirection>.30;
 return Response.json({ok,champion,challenger,drifting,stable,psiDirection,profiles});
}
