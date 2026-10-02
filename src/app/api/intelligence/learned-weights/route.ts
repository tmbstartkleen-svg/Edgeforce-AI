import {loadLearnedWeightMultipliers} from '@/lib/learnedWeights';

export async function GET(){
 const weights=await loadLearnedWeightMultipliers();
 const entries=Object.entries(weights)
  .map(([key,multiplier])=>({key,multiplier}))
  .sort((a,b)=>Math.abs(b.multiplier-1)-Math.abs(a.multiplier-1));
 return Response.json({source:Object.keys(weights).length?'database':'none',count:entries.length,weights:entries});
}
