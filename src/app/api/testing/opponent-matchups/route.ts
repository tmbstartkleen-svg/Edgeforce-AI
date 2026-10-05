import {buildOpponentMatchupProfiles,buildPlayerOpponentProfiles} from '@/lib/opponentMatchupLearning';

export const dynamic='force-dynamic';

export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return new Response(null,{status:404});
 const rows=Array.from({length:4},(_,athleteIndex)=>{
  const athleteId='ath-'+athleteIndex;
  const position=athleteIndex<3?'G':'F';
  const high=Array.from({length:7},(_,i)=>({
   athleteId,sport:'NBA',opponent:'Defense A',position,
   statDate:new Date(Date.now()-(athleteIndex*30+i)*86400000).toISOString(),
   stats:{points:28+athleteIndex+(i%3)}
  }));
  const low=Array.from({length:10},(_,i)=>({
   athleteId,sport:'NBA',opponent:'Defense B',position,
   statDate:new Date(Date.now()-(150+athleteIndex*30+i)*86400000).toISOString(),
   stats:{points:19+athleteIndex+(i%3)}
  }));
  return [...high,...low];
 }).flat();
 const profiles=buildOpponentMatchupProfiles(rows);
 const playerProfiles=buildPlayerOpponentProfiles(rows);
 const exact=profiles.find(x=>x.opponentName==='Defense A'&&x.positionKey==='g'&&x.statKey==='points');
 const fallback=profiles.find(x=>x.opponentName==='Defense A'&&x.positionKey==='*'&&x.statKey==='points');
 const player=playerProfiles.find(x=>x.athleteId==='ath-0'&&x.opponentName==='Defense A'&&x.statKey==='points');
 const ok=Boolean(
  exact&&fallback&&player&&exact.sampleSize===21&&fallback.sampleSize===28&&
  exact.relativeSignal>0&&fallback.relativeSignal>0&&player.sampleSize===7&&player.relativeSignal>0&&player.confidence>0
 );
 return Response.json({ok,build:'V64',schemaVersion:'v64-opponent-matchup-2',exact,fallback,player,count:profiles.length,playerCount:playerProfiles.length},{headers:{'Cache-Control':'no-store'}});
}
