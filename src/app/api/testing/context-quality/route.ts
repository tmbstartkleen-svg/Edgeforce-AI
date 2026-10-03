import {assessContextQuality,contextRequirements,summarizeContextQuality} from '@/lib/contextQuality';
import type {Market} from '@/lib/types';

export const dynamic='force-dynamic';

const base:Market={
 id:'ctx-test',sport:'NFL',league:'NFL',event:'Away @ Home',selection:'Home',
 market:'h2h',startTime:new Date(Date.now()+3600000).toISOString(),home:'Home',away:'Away',
 odds:-150,marketProb:.60,modelProb:.64,confidence:.8,sourceAgeMin:1,period:'PM'
};

export async function GET(){
 if(process.env.ENABLE_TEST_ENDPOINTS!=='true')return new Response(null,{status:404});

 const nfl:Market={
  ...base,
  contextSources:['injuries','stats','weather'],
  sportFeatures:{quarterback:.3,injury:0,trenches:.2,efficiency:.4,rest:.1,travel:0,weather:0}
 };
 nfl.contextQuality=assessContextQuality(nfl,{injuries:.9,stats:.92,weather:.88});

 const mlb:Market={
  ...base,id:'mlb',sport:'MLB',league:'MLB',event:'Away MLB @ Home MLB',
  contextSources:['stats'],sportFeatures:{starter:.4}
 };
 mlb.contextQuality=assessContextQuality(mlb,{stats:.85});

 const player:Market={
  ...base,id:'player',sport:'NBA',league:'NBA',selection:'Player A Over 24.5 Points',
  market:'player points',contextSources:['injuries','stats'],
  sportFeatures:{injury:0,lineup:.2,pace:.1,efficiency:.3,shooting:.2,rest:.1,travel:0},
  playerContext:{name:'Player A',status:'active',starter:true,availability:.98,projection:27.2,stdDev:5.4}
 };
 player.contextQuality=assessContextQuality(player,{injuries:.9,stats:.95});

 const summary=summarizeContextQuality([nfl,mlb,player]);
 const playerRequirements=contextRequirements(player).map(x=>x.key);

 const ok=
  nfl.contextQuality.recommendationReady===true &&
  nfl.contextQuality.coverage>.95 &&
  mlb.contextQuality.recommendationReady===false &&
  mlb.contextQuality.missingCritical.includes('lineup') &&
  playerRequirements.includes('playerProjection') &&
  playerRequirements.includes('playerAvailability') &&
  player.contextQuality.recommendationReady===true &&
  summary.totalRows===3;

 return Response.json({ok,nfl:nfl.contextQuality,mlb:mlb.contextQuality,player:player.contextQuality,summary,playerRequirements},{headers:{'Cache-Control':'no-store'}});
}
