import {demoMarkets} from '@/lib/demo';
import {weekTop30} from '@/lib/scanner';
import {defaultLimits} from '@/lib/portfolio';
import {runDecisionEngine} from '@/lib/decisionEngine';
import {writeDecisionJournal} from '@/lib/decisionJournal';

export async function POST(req:Request){
 const body=await req.json().catch(()=>({}));
 const bankroll=Math.max(1,Number(body?.bankroll)||1000);
 const limits={...defaultLimits(bankroll),...(body?.limits||{}),bankroll};
 const rows=Array.isArray(body?.rows)&&body.rows.length?body.rows:weekTop30(demoMarkets,body?.risk||'Moderate');
 const result=runDecisionEngine(rows,limits,Array.isArray(body?.existing)?body.existing:[],Number(body?.drawdownPct)||0);
 const journal=await writeDecisionJournal(result.decisions.map(d=>({marketId:d.marketId,action:d.action,reason:d.reason,after:{expectedValue:d.expectedValue,stake:d.stake}})));
 return Response.json({...result,journal});
}
