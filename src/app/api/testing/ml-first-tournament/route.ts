import {buildFirstTournamentLeaderboard,championChanges,firstTournamentEvidence} from '@/lib/mlFirstTournament';

export const dynamic='force-dynamic';

export async function GET(){
 const candidates:any[]=[
  {tournamentRunId:1,sport:'NFL',marketKey:'h2h',algorithm:'xgboost',serviceModelId:'x1',role:'CHAMPION',sampleSize:500,holdoutSize:75,holdoutBrier:.19,marketBaselineBrier:.23,brierSkillScore:.174,calibrationError:.04,compositeScore:.31},
  {tournamentRunId:1,sport:'NFL',marketKey:'h2h',algorithm:'catboost',serviceModelId:'c1',role:'MONITORED',sampleSize:500,holdoutSize:75,holdoutBrier:.205,marketBaselineBrier:.23,brierSkillScore:.109,calibrationError:.05,compositeScore:.25},
  {tournamentRunId:1,sport:'NBA',marketKey:'spread',algorithm:'lightgbm',serviceModelId:'l1',role:'CHAMPION',sampleSize:600,holdoutSize:90,holdoutBrier:.20,marketBaselineBrier:.235,brierSkillScore:.149,calibrationError:.045,compositeScore:.29}
 ];
 const leaderboard=buildFirstTournamentLeaderboard(candidates);
 const changes=championChanges(
  [{sport:'NFL',marketKey:'h2h',algorithm:'catboost',serviceModelId:'old',compositeScore:.24,brierSkillScore:.08,holdoutBrier:.21,holdoutLogLoss:.62,calibrationError:.06}],
  [
   {sport:'NFL',marketKey:'h2h',algorithm:'xgboost',serviceModelId:'x1',compositeScore:.31,brierSkillScore:.174,holdoutBrier:.19,holdoutLogLoss:.58,calibrationError:.04},
   {sport:'NBA',marketKey:'spread',algorithm:'lightgbm',serviceModelId:'l1',compositeScore:.29,brierSkillScore:.149,holdoutBrier:.20,holdoutLogLoss:.59,calibrationError:.045}
  ]
 );
 const verified=firstTournamentEvidence({activationState:'ACTIVE',candidates:3,champions:2,sports:2,artifactsVerified:2,artifactsMissing:0});
 const mismatch=firstTournamentEvidence({activationState:'ACTIVE',candidates:3,champions:2,sports:2,artifactsVerified:1,artifactsMissing:1});
 const waiting=firstTournamentEvidence({activationState:'READY_AWAITING_EVIDENCE',candidates:3,champions:0,sports:0,artifactsVerified:0,artifactsMissing:0});
 const assertions={
  ranksWinner:leaderboard[0]?.winner?.serviceModelId==='x1'||leaderboard[1]?.winner?.serviceModelId==='x1',
  replacementDetected:changes.some(x=>x.action==='REPLACED'&&x.serviceModelId==='x1'),
  newChampionDetected:changes.some(x=>x.action==='PROMOTED'&&x.serviceModelId==='l1'),
  verifiedLaunch:verified.launchReady===true&&verified.grade==='VERIFIED',
  blocksMissingArtifact:mismatch.launchReady===false&&mismatch.grade==='ARTIFACT_MISMATCH',
  awaitsChampion:waiting.launchReady===false&&waiting.grade==='AWAITING_CHAMPION'
 };
 const ok=Object.values(assertions).every(Boolean);
 return Response.json({ok,build:'V61',assertions,leaderboard,changes,verified,mismatch,waiting},{status:ok?200:500,headers:{'Cache-Control':'no-store'}});
}
