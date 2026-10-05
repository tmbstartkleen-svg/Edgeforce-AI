import {applyOptimizerBlend,buildCrossSportOptimizerProfiles,optimizerProfileKey} from '@/lib/crossSportOptimizer';

export const dynamic='force-dynamic';

export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return new Response(null,{status:404});
 const rows=[] as any[];
 for(let i=0;i<240;i++){
  const outcome=i%10<6?1:0;
  const council=outcome===1 ? 0.66 : 0.44;
  const simulation=outcome===1 ? 0.58 : 0.48;
  rows.push({
   occurredAt:new Date(Date.UTC(2026,0,1)+i*86400000).toISOString(),
   sport:i%2===0?'NFL':'NBA',marketKey:i%3===0?'spread':'moneyline',
   councilProbability:council,simulationProbability:simulation,marketProbability:.52,outcome
  });
 }
 const profiles=buildCrossSportOptimizerProfiles(rows);
 const promoted=profiles.filter(x=>x.promoted);
 const exact=profiles.find(x=>x.sport==='NFL'&&x.marketKey==='spread');
 const map=Object.fromEntries(promoted.map(x=>[optimizerProfileKey(x.sport,x.marketKey),x]));
 const selected=map[optimizerProfileKey('NFL','spread')]||map[optimizerProfileKey('NFL','*')]||map[optimizerProfileKey('*','*')];
 const blend=applyOptimizerBlend(selected,.66,.58,.52);
 const sums=profiles.every(x=>Math.abs(x.councilWeight+x.simulationWeight+x.marketWeight-1)<1e-9);
 const bounded=profiles.every(x=>x.marketWeight<=.250001&&x.simulationWeight>=.399999&&x.councilWeight<=.550001);
 const ok=sums&&bounded&&promoted.length>0&&profiles.some(x=>x.scope==='GLOBAL')&&profiles.some(x=>x.scope==='SPORT')&&Boolean(exact)&&blend.applied&&blend.probability>0&&blend.probability<1;
 return Response.json({ok,build:'V70',schemaVersion:'v70-cross-sport-optimizer-1',profileCount:profiles.length,promoted:promoted.length,exact,blend},{headers:{'Cache-Control':'no-store'}});
}
