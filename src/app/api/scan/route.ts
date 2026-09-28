import {demoMarkets} from '@/lib/demo';
import {todayTop30,weekTop30} from '@/lib/scanner';
export async function GET(req:Request){
 const {searchParams}=new URL(req.url);
 const view=searchParams.get('view')==='week'?'week':'today';
 const rows=view==='week'?weekTop30(demoMarkets):todayTop30(demoMarkets);
 return Response.json({view,count:rows.length,horizonDays:8,rows});
}
