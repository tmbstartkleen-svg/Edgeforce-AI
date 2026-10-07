import {reconcileLiveGames,summarizeLiveScoreConsensus} from '@/lib/liveScoreMesh';

export const dynamic='force-dynamic';

export async function GET(){
 const now=Date.now();
 const iso=(delta:number)=>new Date(now+delta).toISOString();
 const base={
  id:'v148-test',sport:'NBA',league:'NBA',status:'LIVE' as const,detail:'4th Quarter',period:'4',
  startTime:iso(-3600000),
  home:{name:'Consensus Home',score:102},away:{name:'Consensus Away',score:99}
 };
 const cdn={...base,source:'espn-cdn',clock:'01:22',observedAt:iso(0)};
 const publicSame={...base,source:'espn-public',clock:'01:24',observedAt:iso(-1000)};
 const lagging={...base,source:'thesportsdb',home:{...base.home,score:100},away:{...base.away,score:98},clock:'01:40',observedAt:iso(-6000)};
 const corroborated=reconcileLiveGames([lagging],[publicSame],[cdn])[0];

 const activeConflict={...base,source:'api-sports',home:{...base.home,score:101},clock:'01:23',observedAt:iso(-500)};
 const conflicted=reconcileLiveGames([publicSame],[activeConflict],[cdn])[0];
 const conflictSummary=summarizeLiveScoreConsensus([conflicted]);

 const assertions={
  highConfidenceCorroboration:corroborated?.consensus?.confidence==='HIGH'&&corroborated.consensus.agreeingSources>=2,
  lagSeparatedFromConflict:corroborated?.consensus?.activeConflict===false&&corroborated.consensus.laggingSources.includes('thesportsdb'),
  highTrustSourceSelected:corroborated?.source==='espn-cdn',
  activeConflictDetected:conflicted?.consensus?.activeConflict===true&&conflicted.consensus.scoreConflict===true,
  conflictSummaryRecorded:conflictSummary.activeConflicts===1&&conflictSummary.conflictRate===1
 };
 return Response.json({
  ok:Object.values(assertions).every(Boolean),
  build:'V148',
  schemaVersion:'v148-live-score-consensus-1',
  assertions,
  corroborated,
  conflicted,
  conflictSummary
 },{headers:{'Cache-Control':'no-store'}});
}
