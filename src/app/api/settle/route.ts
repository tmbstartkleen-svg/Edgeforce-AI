import {settle} from '@/lib/settlement';
export async function POST(req:Request){
 const body=await req.json();
 return Response.json(settle(body));
}
