import{t as e}from"./db-9LtqYd6N.js";async function t(t){let n=t.headers.get(`authorization`);if(process.env.INGEST_SECRET&&n!==`Bearer ${process.env.INGEST_SECRET}`)return Response.json({ok:!1,error:`unauthorized`},{status:401});let r=await t.json().catch(()=>({})),i=Array.isArray(r)?r:Array.isArray(r?.rows)?r.rows:[],a=e();if(!a)return Response.json({ok:!0,mode:`dry-run`,received:i.length});let o=0;for(let e of i)await a`
   insert into historical_predictions(
    occurred_at,sport,market_key,selection_key,model_name,model_version,
    predicted_probability,offered_odds,closing_odds,outcome,features
   ) values(
    ${e.occurredAt},${e.sport},${e.marketKey},${e.selectionKey??null},${e.modelName},
    ${e.modelVersion??process.env.MODEL_VERSION??`edgeforce-v9`},${e.predicted},
    ${e.odds},${e.closingOdds??null},${e.outcome??null},${a.json(e.features||{})}
   )
  `,o++;return Response.json({ok:!0,mode:`database`,written:o})}export{t as POST};