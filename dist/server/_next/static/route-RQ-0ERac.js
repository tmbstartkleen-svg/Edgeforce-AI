import{t as e}from"./db-9LtqYd6N.js";var t=`force-dynamic`;async function n(){let t=e();if(!t)return Response.json({ok:!0,source:`none`,snapshots:[],summary:{rows:0}});let n=await t`
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
 `,r=n,i={rows:r.length,multiBookRows:r.filter(e=>Number(e.bookCount)>=2).length,targetBookRows:r.filter(e=>!!e.targetBookFound).length,averageAgreement:r.length?r.reduce((e,t)=>e+Number(t.agreement||0),0)/r.length:0,averageDispersion:r.length?r.reduce((e,t)=>e+Number(t.dispersion||0),0)/r.length:0,classifiedRows:r.filter(e=>e.marketStructure&&e.marketStructure!==`UNCLASSIFIED`).length,priceShopOpportunities:r.filter(e=>Number(e.bestOdds)>Number(e.targetOdds)).length};return Response.json({ok:!0,source:`database`,snapshots:n,summary:i},{headers:{"Cache-Control":`no-store`}})}export{n as GET,t as dynamic};