import {demoMarkets} from '@/lib/demo';
import {weekTop30} from '@/lib/scanner';
import {buildParlays} from '@/lib/parlays';
export async function GET(req:Request){
 const {searchParams}=new URL(req.url);
 const size=searchParams.get('size')==='3'?3:2;
 const scanned=weekTop30(demoMarkets);
 return Response.json({size,parlays:buildParlays(scanned,size)});
}
