import {reconcileLiveGames,summarizeLiveScoreConsensus} from '@/lib/liveScoreMesh';

export const dynamic='force-dynamic';

export async function GET(){
 const base={
  id:'v148-test',sport:'NBA',league:'NBA',status:'LIVE' as const,detail:'4th Quarter',period:'4',
  startTime:'2026-10-07T11:00:00Z',
  home:{name:'Consensus Home',score:102},away:{name:'Consensus Away',score:99}
 };
 const cdn={...base,source:'espn-cdn',clock:'01:22',observedAt:'2026-10-07T12:00:10.000Z'};
 const publicSame={...base,source:'espn-public',clock:'01:24',observedAt:'2026-10-07T12:00:09.000Z'};
 const lagging={...base,source:'thesportsdb',home:{...base.home,score:100},away:{...base.away,score:98},clock:'01:40',observedAt:'2026-10-07T12:00:04.000Z'};
 const corroborated=reconcileLiveGames([lagging],[publicSame],[cdn])[0];

 const activeConflict={...base,source:'api-sports',home:{...base.home,score:101},clock:'01:23',observedAt:'2026-10-07T12:00:09.500Z'};
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
