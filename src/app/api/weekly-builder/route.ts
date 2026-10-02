import {addWeeklyLeg,getWeeklyDraft,updateWeeklyLeg} from '@/lib/weeklyBuilder';
import type {Scanned} from '@/lib/scanner';

export const dynamic='force-dynamic';

function authorized(req:Request){
 const key=process.env.EDGEFORCE_WRITE_KEY;
 return !key||req.headers.get('x-edgeforce-write-key')===key;
}

export async function GET(){return Response.json(await getWeeklyDraft(),{headers:{'Cache-Control':'no-store'}})}

export async function POST(req:Request){
 if(!authorized(req))return Response.json({ok:false,error:'Unauthorized'},{status:401});
 const body=await req.json().catch(()=>({})) as {action?:'add'|'remove'|'lock'|'unlock';marketId?:string;row?:Scanned};
 if(body.action==='add'&&body.row)return Response.json(await addWeeklyLeg(body.row));
 if(body.marketId&&(body.action==='remove'||body.action==='lock'||body.action==='unlock'))return Response.json(await updateWeeklyLeg(body.marketId,body.action));
 return Response.json({ok:false,error:'Invalid weekly-builder request'},{status:400});
}
