import {fetchCompletedResults} from '@/lib/providers/results';
import {settleCompletedModelRuns} from '@/lib/autoSettlement';
import {runAutomatedLearning} from '@/lib/automatedLearning';

export const dynamic='force-dynamic';
export const maxDuration=60;

export async function GET(req:Request){
 const auth=req.headers.get('authorization');
 if(process.env.CRON_SECRET && auth!==`Bearer ${process.env.CRON_SECRET}`) return Response.json({ok:false},{status:401});
 const fetched=await fetchCompletedResults();
 const settlement=await settleCompletedModelRuns(fetched.results).catch(error=>({configured:true,matchedEvents:0,settled:0,pushes:0,skipped:0,error:error instanceof Error?error.message:'settlement failed'}));
 const learning=await runAutomatedLearning().catch(error=>({configured:true,sampleSize:0,runId:null,error:error instanceof Error?error.message:'learning failed'}));
 return Response.json({ok:true,ranAt:new Date().toISOString(),modelVersion:process.env.MODEL_VERSION||'edgeforce-v23',resultFeed:{mode:fetched.mode,source:fetched.source,count:fetched.results.length,attempts:fetched.attempts},settlement,learning});
}
