import {walkForward,summarizeBacktest} from '@/lib/backtest';
export async function POST(req:Request){
  const body=await req.json().catch(()=>({}));
  const rows=Array.isArray(body?.rows)?body.rows:[];
  const trainSize=Math.max(25,Number(body?.trainSize)||100);
  const testSize=Math.max(10,Number(body?.testSize)||25);
  return Response.json({summary:summarizeBacktest(rows),folds:walkForward(rows,trainSize,testSize)});
}
