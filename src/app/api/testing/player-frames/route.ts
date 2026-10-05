import {derivePlayerFeatureSignals,type PlayerFrameGame} from '@/lib/playerFeatureFrames';

export const dynamic='force-dynamic';

const game=(i:number,value:number,homeAway:'home'|'away',opponent:string,team='Home Team'):PlayerFrameGame=>({
 statDate:new Date(Date.now()-i*86400000).toISOString(),
 opponent,homeAway,team,usageRate:.20+i*.002,minutes:30+i*.1,stats:{points:value}
});

export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return new Response(null,{status:404});
 const games=[
  game(0,30,'home','Rival'),game(1,29,'away','Other'),game(2,28,'home','Rival'),game(3,27,'away','Other'),game(4,26,'home','Rival'),
  game(5,22,'away','Other'),game(6,21,'home','Other'),game(7,20,'away','Other'),game(8,19,'home','Other'),game(9,18,'away','Other')
 ];
 const frame=derivePlayerFeatureSignals(games,'points','home','Rival');
 const ok=Boolean(frame&&frame.sampleSize===10&&frame.playerForm>0&&frame.playerHomeAway>0&&frame.playerOpponent>0&&frame.playerRosterContinuity===1&&frame.playerSampleConfidence===.5);
 return Response.json({ok,build:'V62',schemaVersion:'v62-player-feature-frames-1',frame},{headers:{'Cache-Control':'no-store'}});
}
