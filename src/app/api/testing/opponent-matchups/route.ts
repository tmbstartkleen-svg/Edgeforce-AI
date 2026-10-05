import {buildOpponentMatchupProfiles} from '@/lib/opponentMatchupLearning';

export const dynamic='force-dynamic';

export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return new Response(null,{status:404});
 const rows=[
  ...Array.from({length:12},(_,i)=>({sport:'NBA',opponent:'Defense A',position:'G',statDate:new Date(Date.now()-i*86400000).toISOString(),stats:{points:30+i%3}})),
  ...Array.from({length:20},(_,i)=>({sport:'NBA',opponent:'Defense B',position:'G',statDate:new Date(Date.now()-(i+20)*86400000).toISOString(),stats:{points:18+i%3}}))
 ];
 const profiles=buildOpponentMatchupProfiles(rows);
 const exact=profiles.find(x=>x.opponentName==='Defense A'&&x.positionKey==='g'&&x.statKey==='points');
 const fallback=profiles.find(x=>x.opponentName==='Defense A'&&x.positionKey==='*'&&x.statKey==='points');
 const ok=Boolean(exact&&fallback&&exact.sampleSize===12&&exact.relativeSignal>0&&exact.confidence>0);
 return Response.json({ok,build:'V64',schemaVersion:'v64-opponent-matchup-1',exact,fallback,count:profiles.length},{headers:{'Cache-Control':'no-store'}});
}
