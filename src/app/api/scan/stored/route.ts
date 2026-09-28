import {latestStoredMarkets,recordModelRuns} from '@/lib/persistence';
import {demoMarkets} from '@/lib/demo';
import {todayTop30,weekTop30} from '@/lib/scanner';

export async function GET(req:Request){
  const {searchParams}=new URL(req.url);
  const view=searchParams.get('view')==='week'?'week':'today';
  const stored=await latestStoredMarkets();
  const source=stored.length?'database':'demo';
  const markets=stored.length?stored:demoMarkets;
  const rows=view==='week'?weekTop30(markets):todayTop30(markets);
  if(stored.length)await recordModelRuns(rows);
  return Response.json({source,view,count:rows.length,rows});
}
