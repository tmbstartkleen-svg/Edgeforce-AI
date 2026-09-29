import {hedgeSizing} from '@/lib/hedge';
export async function POST(req:Request){
 const body=await req.json();
 return Response.json(hedgeSizing(body));
}
