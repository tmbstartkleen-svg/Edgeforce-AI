import {latestStoredMarkets} from '@/lib/persistence';
import {demoMarkets} from '@/lib/demo';
import {weekTop30} from '@/lib/scanner';
import {defaultLimits} from '@/lib/portfolio';
import {runDecisionEngine} from '@/lib/decisionEngine';
import {writeDecisionJournal} from '@/lib/decisionJournal';
import {writeAlerts} from '@/lib/alertStore';
import {loadLearnedWeightMultipliers} from '@/lib/learnedWeights';
import {loadDynamicCalibrationProfiles} from '@/lib/regimeConfidence';
import {recordAutomationRun} from '@/lib/automationHealth';

export const dynamic='force-dynamic';

export async function GET(req:Request){
 const auth=req.headers.get('authorization');
 if(process.env.CRON_SECRET&&auth!==`Bearer ${process.env.CRON_SECRET}`)return Response.json({ok:false,error:'unauthorized'},{status:401});
 const started=Date.now();
 try{
  const [stored,learnedWeights,dynamicCalibration]=await Promise.all([
   latestStoredMarkets(),loadLearnedWeightMultipliers(),loadDynamicCalibrationProfiles()
  ]);
  const markets=stored.length?stored:demoMarkets;
  const rows=weekTop30(markets,'Moderate',new Date(),learnedWeights,dynamicCalibration);
  const bankroll=Math.max(1,Number(process.env.DEFAULT_BANKROLL)||1000);
  const result=runDecisionEngine(rows,defaultLimits(bankroll),[],0);
  const journal=await writeDecisionJournal(result.decisions.map(d=>({
   marketId:d.marketId,action:d.action,reason:d.reason,after:{expectedValue:d.expectedValue,stake:d.stake}
  })));
  const alerts=await writeAlerts(result.alerts as any[]);
  await recordAutomationRun('decision','success',started,{
   source:stored.length?'database':'demo',decisions:result.decisions.length,journal,alerts
  });
  return Response.json({
   ok:true,source:stored.length?'database':'demo',ranAt:new Date().toISOString(),
   decisions:result.decisions.length,journal,alerts
  },{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  const message=error instanceof Error?error.message:'decision automation failed';
  await recordAutomationRun('decision','failed',started,{},message);
  return Response.json({ok:false,error:message},{status:500,headers:{'Cache-Control':'no-store'}});
 }
}
