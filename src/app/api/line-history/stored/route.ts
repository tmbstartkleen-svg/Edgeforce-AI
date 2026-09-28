import {lineHistory} from '@/lib/persistence';
import {movement} from '@/lib/lineMovement';

export async function GET(req:Request){
  const {searchParams}=new URL(req.url);
  const eventId=searchParams.get('eventId');
  const marketKey=searchParams.get('marketKey');
  const selectionKey=searchParams.get('selectionKey');
  if(!eventId||!marketKey||!selectionKey)return Response.json({error:'eventId, marketKey and selectionKey are required'},{status:400});
  const points=await lineHistory(eventId,marketKey,selectionKey);
  return Response.json({points,movement:movement(points as any)});
}
