import {db} from '@/lib/db';

export const dynamic='force-dynamic';

export async function GET(){
 const sql=db();
 if(!sql)return Response.json({ok:true,source:'none',snapshots:[],summary:{rows:0}});
 const snapshots=await sql`
  select event_id as "eventId",market_key as market,selection_key as selection,target_book as "targetBook",
   target_odds as "targetOdds",target_book_found as "targetBookFound",
   consensus_probability::float as "consensusProbability",consensus_fair_odds as "consensusFairOdds",
   provider_count as "providerCount",book_count as "bookCount",dispersion::float,agreement::float,
   best_odds as "bestOdds",best_book as "bestBook",
   sharp_probability::float as "sharpProbability",public_probability::float as "publicProbability",
   sharp_public_gap::float as "sharpPublicGap",market_structure as "marketStructure",
   outlier_books as "outlierBooks",books,captured_at as "capturedAt"
  from market_consensus_snapshots
  where captured_at>=now()-interval '24 hours'
  order by captured_at desc limit 250
 `;
 const rows=snapshots as any[];
 const summary={
  rows:rows.length,
  multiBookRows:rows.filter(x=>Number(x.bookCount)>=2).length,
  targetBookRows:rows.filter(x=>Boolean(x.targetBookFound)).length,
  averageAgreement:rows.length?rows.reduce((s,x)=>s+Number(x.agreement||0),0)/rows.length:0,
  averageDispersion:rows.length?rows.reduce((s,x)=>s+Number(x.dispersion||0),0)/rows.length:0,
  classifiedRows:rows.filter(x=>x.marketStructure&&x.marketStructure!=='UNCLASSIFIED').length,
  priceShopOpportunities:rows.filter(x=>Number(x.bestOdds)>Number(x.targetOdds)).length
 };
 return Response.json({ok:true,source:'database',snapshots,summary},{headers:{'Cache-Control':'no-store'}});
}
