import {cashoutDecision} from '@/lib/cashout';
export async function POST(req:Request){
 const body=await req.json();
 return Response.json(cashoutDecision(body));
}
