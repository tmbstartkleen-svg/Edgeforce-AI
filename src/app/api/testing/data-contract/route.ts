import {demoMarkets} from '@/lib/demo';
import {auditMarketBatch} from '@/lib/dataQuality';
import type {Market} from '@/lib/types';

export const dynamic='force-dynamic';

export async function GET(){
 const clean=auditMarketBatch(demoMarkets);
 const duplicate={...demoMarkets[0]} as Market;
 const invalid={
  ...demoMarkets[1],
  id:'',
  odds:25,
  marketProb:1.2,
  modelProb:-.1,
  confidence:2,
  sourceAgeMin:180
 } as Market;
 const broken=auditMarketBatch([...demoMarkets,duplicate,invalid]);
 const ok=
  clean.grade!=='REJECT'
  &&broken.invalidRows>=2
  &&broken.duplicateRows>=1
  &&broken.staleRows>=1
  &&broken.issues.some(x=>x.code==='INVALID_AMERICAN_ODDS')
  &&broken.issues.some(x=>x.code==='INVALID_MARKET_PROBABILITY');
 return Response.json({ok,clean,broken});
}
