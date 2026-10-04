import {shadowLeagueScore,shadowLeagueWinnerDecision,shadowRecoveryDecision,shadowRecoveryMetrics} from '@/lib/mlShadowRecovery';

export const dynamic='force-dynamic';

export async function GET(){
 const goodRows=Array.from({length:100},(_,i)=>{
  const high=i<50;
  const within=high?i:i-50;
  return {
   probability:high?.80:.20,
   outcome:high?(within<40?1:0):(within<10?1:0),
   marketBaselineProbability:high?.60:.40,
   nativeProbability:high?.70:.30,
   settledAt:new Date(Date.UTC(2026,0,1+i)).toISOString()
  };
 });
 const metrics=shadowRecoveryMetrics(goodRows,.15);
 const insufficient=shadowRecoveryDecision({...metrics,sampleSize:20,priorConfirmations:0,minSample:50});
 const cooldown=shadowRecoveryDecision({...metrics,priorConfirmations:0,cooldownActive:true,minSample:50});
 const firstPass=shadowRecoveryDecision({...metrics,priorConfirmations:0,cooldownActive:false,minSample:50});
 const confirmed=shadowRecoveryDecision({...metrics,priorConfirmations:1,cooldownActive:false,minSample:50});
 const rejected=shadowRecoveryDecision({
  sampleSize:60,marketBrierSkillScore:-.12,nativeBrierSkillScore:-.10,
  liveCalibrationError:.08,brierDegradation:.02,priorConfirmations:0,cooldownActive:false,minSample:50
 });
 const leaderScore=shadowLeagueScore(metrics);
 const runnerScore=leaderScore-.02;
 const clearWinner=shadowLeagueWinnerDecision([
  {id:1,sampleSize:100,score:leaderScore,recoveryAction:'PROMOTE',state:'RECOVERY_READY'},
  {id:2,sampleSize:100,score:runnerScore,recoveryAction:'PROMOTE',state:'RECOVERY_READY'}
 ],{minCompetitors:2,minSample:50,minMargin:.005});
 const closeRace=shadowLeagueWinnerDecision([
  {id:1,sampleSize:100,score:leaderScore,recoveryAction:'PROMOTE',state:'RECOVERY_READY'},
  {id:2,sampleSize:100,score:leaderScore-.001,recoveryAction:'PROMOTE',state:'RECOVERY_READY'}
 ],{minCompetitors:2,minSample:50,minMargin:.005});
 const oneCompetitor=shadowLeagueWinnerDecision([
  {id:1,sampleSize:100,score:leaderScore,recoveryAction:'PROMOTE',state:'RECOVERY_READY'}
 ],{minCompetitors:2,minSample:50,minMargin:.005});
 const unconfirmedLeader=shadowLeagueWinnerDecision([
  {id:1,sampleSize:100,score:leaderScore,recoveryAction:'NONE',state:'READY_CONFIRM'},
  {id:2,sampleSize:100,score:runnerScore,recoveryAction:'PROMOTE',state:'RECOVERY_READY'}
 ],{minCompetitors:2,minSample:50,minMargin:.005});

 const assertions={
  metricsFinite:Object.values(metrics).every(v=>Number.isFinite(v)),
  beatsMarket:metrics.marketBrierSkillScore>0,
  beatsNative:metrics.nativeBrierSkillScore>0,
  insufficientHeld:insufficient.state==='INSUFFICIENT'&&insufficient.action==='NONE',
  cooldownBlocks:cooldown.state==='COOLDOWN'&&cooldown.action==='NONE',
  firstPassConfirms:firstPass.state==='READY_CONFIRM'&&firstPass.action==='NONE',
  repeatedFreshPassPromotes:confirmed.state==='RECOVERY_READY'&&confirmed.action==='PROMOTE',
  badShadowRejected:rejected.state==='REJECTED'&&rejected.action==='REJECT',
  clearLeagueWinnerPromotes:clearWinner.promote===true&&clearWinner.winnerId===1,
  closeLeagueRaceHolds:closeRace.promote===false&&closeRace.winnerId===1,
  minimumCompetitorsRequired:oneCompetitor.promote===false&&oneCompetitor.winnerId===null,
  leagueLeaderMustConfirm:unconfirmedLeader.promote===false&&unconfirmedLeader.winnerId===1
 };
 const ok=Object.values(assertions).every(Boolean);
 return Response.json({ok,build:'V61',assertions,metrics,leaderScore,clearWinner,closeRace,oneCompetitor,unconfirmedLeader,insufficient,cooldown,firstPass,confirmed,rejected},{status:ok?200:500,headers:{'Cache-Control':'no-store'}});
}
