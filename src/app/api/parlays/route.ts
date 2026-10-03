import {demoMarkets} from '@/lib/demo';
import {weekTop30} from '@/lib/scanner';
import {buildParlays} from '@/lib/parlays';
import {loadLearnedSgpCorrelations} from '@/lib/learnedSgpCorrelation';

export async function GET(req:Request){
 const {searchParams}=new URL(req.url);
 const size=searchParams.get('size')==='3'?3:2;
 const [learned]=await Promise.all([loadLearnedSgpCorrelations()]);
 const scanned=weekTop30(demoMarkets);
 return Response.json({
  size,
  learnedProfileCount:Object.keys(learned).length,
  parlays:buildParlays(scanned,size,learned)
 });
}
