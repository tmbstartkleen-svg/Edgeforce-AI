import {shadowRecoveryDecision,shadowRecoveryMetrics} from '@/lib/mlShadowRecovery';

export const dynamic='force-dynamic';

export async function GET(){
 const goodRows=Array.from({length:60},(_,i)=>({
  probability:i%2===0?.76:.24,
  outcome:i%2===0?1:0,
  marketBaselineProbability:i%2===0?.62:.38,
  nativeProbability:i%2===0?.66:.34,
  settledAt:new Date(2026,0,1+i).toISOString()
 }));
 const metrics=shadowRecoveryMetrics(goodRows,.17);
 const insufficient=shadowRecoveryDecision({...metrics,sampleSize:20,priorConfirmations:0,minSample:50});
 const cooldown=shadowRecoveryDecision({...metrics,priorConfirmations:0,cooldownActive:true,minSample:50});
 const firstPass=shadowRecoveryDecision({...metrics,priorConfirmations:0,cooldownActive:false,minSample:50});
 const confirmed=shadowRecoveryDecision({...metrics,priorConfirmations:1,cooldownActive:false,minSample:50});
 const rejected=shadowRecoveryDecision({
  sampleSize:60,marketBrierSkillScore:-.12,nativeBrierSkillScore:-.10,
  liveCalibrationError:.08,brierDegradation:.02,priorConfirmations:0,cooldownActive:false,minSample:50
 });
 const assertions={
  metricsFinite:Object.values(metrics).every(v=>Number.isFinite(v)),
  beatsMarket:metrics.marketBrierSkillScore>0,
  beatsNative:metrics.nativeBrierSkillScore>0,
  insufficientHeld:insufficient.state==='INSUFFICIENT'&&insufficient.action==='NONE',
  cooldownBlocks:cooldown.state==='COOLDOWN'&&cooldown.action==='NONE',
  firstPassConfirms:firstPass.state==='READY_CONFIRM'&&firstPass.action==='NONE',
  repeatedFreshPassPromotes:confirmed.state==='RECOVERY_READY'&&confirmed.action==='PROMOTE',
  badShadowRejected:rejected.state==='REJECTED'&&rejected.action==='REJECT'
 };
 const ok=Object.values(assertions).every(Boolean);
 return Response.json({ok,build:'V60',assertions,metrics,insufficient,cooldown,firstPass,confirmed,rejected},{status:ok?200:500,headers:{'Cache-Control':'no-store'}});
}
