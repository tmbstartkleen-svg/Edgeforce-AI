import {latestStoredMarkets} from '@/lib/persistence';
import {demoMarkets} from '@/lib/demo';
import {weekTop30} from '@/lib/scanner';
import {defaultLimits} from '@/lib/portfolio';
import {runDecisionEngine} from '@/lib/decisionEngine';
import {writeDecisionJournal} from '@/lib/decisionJournal';
import {writeAlerts} from '@/lib/alertStore';

export async function GET(req:Request){
 const auth=req.headers.get('authorization');
 if(process.env.CRON_SECRET && auth!==`Bearer ${process.env.CRON_SECRET}`)return Response.json({ok:false},{status:401});
 const stored=await latestStoredMarkets();
 const markets=stored.length?stored:demoMarkets;
 const rows=weekTop30(markets,'Moderate');
 const bankroll=Math.max(1,Number(process.env.DEFAULT_BANKROLL)||1000);
 const result=runDecisionEngine(rows,defaultLimits(bankroll),[],0);
 const journal=await writeDecisionJournal(result.decisions.map(d=>({marketId:d.marketId,action:d.action,reason:d.reason,after:{expectedValue:d.expectedValue,stake:d.stake}})));
 const alerts=await writeAlerts(result.alerts as any[]);
 return Response.json({ok:true,source:stored.length?'database':'demo',ranAt:new Date().toISOString(),decisions:result.decisions.length,journal,alerts});
}
